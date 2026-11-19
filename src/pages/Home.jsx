import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, isLocalDb } from "@/api/db";
import { toast } from "sonner";
import { acquireBrowserSession } from "@/lib/browser-session";
import {
  Home as HomeIcon,
  LifeBuoy,
  LogOut,
  MessageSquarePlus,
  PanelLeft,
  RefreshCw,
  Search,
  Settings,
  SunMoon,
} from "lucide-react";

import GuestRegistration from "@/components/chat/GuestRegistration";
import PublicChat, { PUBLIC_CHAT_ID } from "@/components/chat/PublicChat";
import InactivityMonitor from "@/components/chat/InactivityMonitor";
import { ClassicWindow, NewChatDialog, PresenceList, ProfileDialog, ToolButton, TreeNav } from "@/components/chat/ClassicLayout";

import { t } from "@/components/utils/translations";
import { useTheme } from "@/hooks/use-theme";
import { createPageUrl } from "@/utils";

const STORAGE_AUTH_PROFILE_ID = "auth_profile_id";
const STORAGE_ADMIN_PROFILE_ID = "admin_profile_id";
const STORAGE_GUEST_RESTORE = "guest_restore_v1";
const STORAGE_LANGUAGE = "chat_language";

function getInitialLanguage() {
  if (typeof window === "undefined") return "sl";

  try {
    const params = new URLSearchParams(window.location.search);
    const langParam = (params.get("lang") || "").toLowerCase();
    if (langParam === "sl" || langParam === "en") return langParam;

    const stored = (localStorage.getItem(STORAGE_LANGUAGE) || "").toLowerCase();
    if (stored === "sl" || stored === "en") return stored;

    const browserLanguage = (navigator.language || "").toLowerCase();
    return browserLanguage.includes("sl") ? "sl" : "en";
  } catch {
    return "sl";
  }
}

// How long a user is considered online without heartbeat updates.
// Keep reasonably short; we use 60s so users remain visible as "recently active" for one minute.
const ONLINE_STALE_MS = 60 * 1000;
// How long offline users stay visible in Users tab before they are hidden.
const OFFLINE_VISIBLE_MS = 3 * 60 * 1000;
// Auto-delete groups after 3 minutes with no active members.
const GROUP_INACTIVE_DELETE_MS = 3 * 60 * 1000;

const AVATAR_COLORS = [
  "#8b5cf6",
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#a855f7",
];

function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function getGenderAvatarColor(gender) {
  const normalized = String(gender || "").trim().toLocaleLowerCase("sl");
  if (normalized === "moški" || normalized === "moski") return "#3b82f6";
  if (normalized === "ženska" || normalized === "zenska") return "#ec4899";
  return randomAvatarColor();
}

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeStorageGet(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeStorageSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeStorageRemove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // ignore
  }
}

function isProfileOnline(profile) {
  // Online = recently active heartbeat.
  // Without a valid last_activity timestamp we treat the user as offline to avoid "ghost" users.
  if (!profile?.is_online) return false;
  if (!profile?.last_activity) return false;

  const last = new Date(profile.last_activity).getTime();
  if (Number.isNaN(last)) return false;
  return Date.now() - last < ONLINE_STALE_MS;
}

// Izbriše vse zasebne pogovore uporabnika; sporočila izbriše baza (on delete cascade) ali lokalno spodaj.
async function deleteRoomsOf(profileId) {
  if (!profileId) return;
  try {
    const all = await db.entities.ChatRoom.list("-updated_date", 500);
    const mine = (all || []).filter((r) => Array.isArray(r?.participant_ids) && r.participant_ids.includes(profileId));
    await Promise.all(
      mine.map(async (room) => {
        if (isLocalDb) {
          // Lokalna baza nima kaskadnega brisanja – sporočila izbrišemo sami.
          try {
            const msgs = await db.entities.ChatMessage.filter({ room_id: room.id }, "created_date", 1000);
            await Promise.all((msgs || []).map((m) => db.entities.ChatMessage.delete(m.id).catch(() => {})));
          } catch {
            // ignore
          }
        }
        await db.entities.ChatRoom.delete(room.id).catch(() => {});
      })
    );
  } catch (err) {
    console.error("Error deleting conversations on logout:", err);
  }
}

function isRecentlyOffline(profile) {
  if (!profile?.last_activity) return false;
  const last = new Date(profile.last_activity).getTime();
  if (Number.isNaN(last)) return false;
  const age = Date.now() - last;
  return age >= ONLINE_STALE_MS && age < OFFLINE_VISIBLE_MS;
}

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

function isOtherCountry(value) {
  const normalized = normalizeCountry(value);
  return !normalized || normalized === "drugo" || normalized === "other" || normalized === "ostalo";
}

function getCountryPriority(profileCountry, myCountry) {
  const mine = normalizeCountry(myCountry);
  const theirs = normalizeCountry(profileCountry);
  if (mine && theirs && mine === theirs) return 0;
  if (isOtherCountry(profileCountry)) return 1;
  return 2;
}

function getCountryGroupKey(profileCountry, myCountry) {
  const priority = getCountryPriority(profileCountry, myCountry);
  if (priority === 0) return normalizeCountry(myCountry);
  if (priority === 1) return "other";
  return normalizeCountry(profileCountry);
}

function normalizeName(value) {
  return String(value || "").trim().toLocaleLowerCase("sl");
}

const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const ChatWindow = lazy(() => import("@/components/chat/ChatWindow"));
const GroupList = lazy(() => import("@/components/chat/GroupList"));
const GroupChat = lazy(() => import("@/components/chat/GroupChat"));
const ChatHistory = lazy(() => import("@/components/chat/ChatHistory"));
const ProfileSettings = lazy(() => import("@/components/chat/ProfileSettings"));
const SupportForm = lazy(() => import("@/components/chat/SupportForm"));

async function fetchIpLocation() {
  // Prefer same-origin API on Vercel (more reliable than direct browser call to third-party service).
  try {
    const localRes = await fetch("/api/ip-location");
    if (localRes.ok) {
      const localData = await localRes.json();
      if (localData && (localData.ip || localData.country || localData.city || localData.region)) {
        return {
          ip: localData.ip || null,
          country: localData.country || null,
          city: localData.city || null,
          region: localData.region || null,
          source: localData.source || "api",
        };
      }
    }
  } catch {
    // fallback below
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ip: data?.ip || null,
      country: data?.country_name || data?.country || null,
      city: data?.city || null,
      region: data?.region || null,
      source: "ipapi-direct",
    };
  } catch {
    return null;
  }
}

export default function Home() {
  const { isDark, toggleTheme } = useTheme();
  const darkMode = isDark;

  // Guest session must be per-tab so we can test multiple guests locally.
  // localStorage is shared across tabs and would overwrite auth in other tab.
  const sessionLock = useRef(null);
  const guestStorage = typeof window !== "undefined" ? window.sessionStorage : null;

  const [language, setLanguage] = useState(getInitialLanguage);
  const [activeTab, setActiveTab] = useState("public");
  const [refreshing, setRefreshing] = useState(false);

  const [myProfile, setMyProfile] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);

  const [loadingRestore, setLoadingRestore] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      if (localStorage.getItem(STORAGE_ADMIN_PROFILE_ID)) return true;
      const session = window.sessionStorage;
      const authId = session?.getItem(STORAGE_AUTH_PROFILE_ID) || localStorage.getItem(STORAGE_AUTH_PROFILE_ID);
      const restoreRaw = session?.getItem(STORAGE_GUEST_RESTORE) || localStorage.getItem(STORAGE_GUEST_RESTORE);
      return Boolean(authId || restoreRaw);
    } catch {
      return true;
    }
  });
  const [registering, setRegistering] = useState(false);

  const [profiles, setProfiles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [unreadByProfileId, setUnreadByProfileId] = useState({});
  const [unreadByGroupId, setUnreadByGroupId] = useState({});

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine !== false;
  });

  const [view, setView] = useState("main");
  const [treeOpen, setTreeOpen] = useState(() => typeof window === "undefined" || !window.matchMedia?.("(max-width: 640px)").matches);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileDialog, setProfileDialog] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const activityIntervalRef = useRef(null);
  const lastUnreadByProfileIdRef = useRef({});
  const unreadInitRef = useRef(false);
  const audioContextRef = useRef(null);
  const lastMessageSoundAtRef = useRef(0);

  const prioritizedProfiles = useMemo(() => {
    const online = [];
    const offline = [];

    (profiles || []).forEach((profile, idx) => {
      const item = { profile, idx };
      if (isProfileOnline(profile)) online.push(item);
      else offline.push(item);
    });

    const sortByUnreadThenIndex = (list) =>
      list.sort((a, b) => {
        const bUnread = unreadByProfileId?.[b.profile?.id] || 0;
        const aUnread = unreadByProfileId?.[a.profile?.id] || 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
        return a.idx - b.idx;
      });

    return [...sortByUnreadThenIndex(online), ...sortByUnreadThenIndex(offline)].map((item) => item.profile);
  }, [profiles, unreadByProfileId]);

  const persistLanguage = useCallback(
    (next) => {
      setLanguage(next);
      try {
        localStorage.setItem(STORAGE_LANGUAGE, next);
      } catch {
        // ignore
      }
    },
    [setLanguage]
  );

  const playIncomingMessageSound = useCallback(() => {
    try {
      const now = Date.now();
      if (now - lastMessageSoundAtRef.current < 700) return;
      lastMessageSoundAtRef.current = now;

      const legacyWindow = /** @type {Window & { webkitAudioContext?: typeof AudioContext }} */ (window);
      const AudioCtx = window.AudioContext || legacyWindow.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(920, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    } catch {
      // ignore audio errors
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get("lang");
    if (langParam === "sl" || langParam === "en") {
      persistLanguage(langParam);
    }
  }, [persistLanguage]);

  useEffect(() => {
    const isEn = language === "en";
    const manifestHref = isEn ? "/manifest.en.json" : "/manifest.sl.json";
    const appTitle = "Chattko";
    const chromeThemeColor = darkMode ? "#0e1116" : "#efe3d0";
    const seoTitle = isEn
      ? "Chattko | Free web chat and online chat rooms"
      : "Chattko – slovenska spletna klepetalnica";
    const seoDescription = isEn
      ? "Join Chattko for free anonymous web chat. Meet new people, chat instantly, and enjoy a safe experience without registration."
      : "Vpiši vzdevek in se pridruži klepetu v živo. Pogovarjaj se v skupnem kanalu ali odpri zaseben pogovor.";
    const canonicalUrl = `https://www.chattko.com/?lang=${isEn ? "en" : "sl"}`;

    const manifestLink = document.querySelector('link#app-manifest[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute("href", manifestHref);
    }

    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.setAttribute("content", chromeThemeColor);

    let navButtonMeta = document.querySelector('meta[name="msapplication-navbutton-color"]');
    if (!navButtonMeta) {
      navButtonMeta = document.createElement("meta");
      navButtonMeta.setAttribute("name", "msapplication-navbutton-color");
      document.head.appendChild(navButtonMeta);
    }
    navButtonMeta.setAttribute("content", chromeThemeColor);

    let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement("meta");
      appleTitleMeta.setAttribute("name", "apple-mobile-web-app-title");
      document.head.appendChild(appleTitleMeta);
    }
    appleTitleMeta.setAttribute("content", appTitle);

    document.documentElement.setAttribute("lang", isEn ? "en" : "sl");
    document.title = seoTitle;

    let faviconLink = document.querySelector('link#app-favicon[rel="icon"]');
    if (!faviconLink) {
      faviconLink = document.createElement("link");
      faviconLink.setAttribute("id", "app-favicon");
      faviconLink.setAttribute("rel", "icon");
      faviconLink.setAttribute("type", "image/png");
      document.head.appendChild(faviconLink);
    }
    faviconLink.setAttribute("href", "/icons/icon-192.png");

    let descriptionMeta = document.querySelector('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement("meta");
      descriptionMeta.setAttribute("name", "description");
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.setAttribute("content", seoDescription);

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonicalUrl);

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute("content", seoTitle);

    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement("meta");
      ogDescription.setAttribute("property", "og:description");
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute("content", seoDescription);

    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement("meta");
      ogUrl.setAttribute("property", "og:url");
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute("content", canonicalUrl);

    let twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (!twitterTitle) {
      twitterTitle = document.createElement("meta");
      twitterTitle.setAttribute("name", "twitter:title");
      document.head.appendChild(twitterTitle);
    }
    twitterTitle.setAttribute("content", seoTitle);

    let twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (!twitterDescription) {
      twitterDescription = document.createElement("meta");
      twitterDescription.setAttribute("name", "twitter:description");
      document.head.appendChild(twitterDescription);
    }
    twitterDescription.setAttribute("content", seoDescription);
  }, [language, darkMode]);

  const loadProfileById = useCallback(async (id) => {
    if (!id) return null;
    const matches = await db.entities.ChatProfile.filter({ id });
    const profile = matches?.[0] || null;
    
    // Migration: Add is_banned field to old profiles
    if (profile && profile.is_banned === undefined) {
      try {
        await db.entities.ChatProfile.update(profile.id, { is_banned: false });
        profile.is_banned = false;
      } catch (error) {
        console.error("Migration error for is_banned:", error);
      }
    }
    
    return profile;
  }, []);

  const markProfileOnline = useCallback(async (id) => {
    if (!id) return;
    try {
      const now = new Date().toISOString();
      await db.entities.ChatProfile.update(id, {
        is_online: true,
        last_activity: now,
      });
    } catch (err) {
      console.error("Error marking profile online:", err);
    }
  }, []);

  const markProfileOffline = useCallback(async (id) => {
    if (!id) return;
    try {
      await db.entities.ChatProfile.update(id, {
        is_online: false,
        is_typing: false,
        last_activity: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  }, []);

  const clearGuestAuth = useCallback(() => {
    safeStorageRemove(guestStorage, STORAGE_AUTH_PROFILE_ID);
    safeStorageRemove(guestStorage, STORAGE_GUEST_RESTORE);
  }, []);

  const clearAdminAuth = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_ADMIN_PROFILE_ID);
    } catch {
      // ignore
    }
  }, []);

  const logoutGuest = useCallback(async (options = {}) => {
    const release = sessionLock.current;
    // By default preserve the profile but mark it offline and block immediate re-login
    const { preserveProfile = true } = options;
    const id = myProfile?.id;
    const adminId = adminProfile?.id;
    setMyProfile(null);
    setAdminProfile(null);
    setSelectedRoom(null);
    setSelectedGroup(null);
    setView("main");
    clearGuestAuth();
    clearAdminAuth();
    if (id) {
      // Ob odjavi se izbrišejo vsi tvoji zasebni pogovori (sporočila se izbrišejo skupaj s pogovorom).
      await deleteRoomsOf(id);
      try {
        // Mark offline and set a temporary logout block to prevent immediate re-login (5 minutes)
        const blockUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await db.entities.ChatProfile.update(id, {
          is_online: false,
          is_typing: false,
          last_activity: new Date().toISOString(),
          logout_block_until: blockUntil,
        });
      } catch (err) {
        console.error("Error marking profile offline on logout:", err);
      }
      if (!preserveProfile) {
        try {
          await db.entities.ChatProfile.delete(id);
        } catch (err) {
          console.error("Error deleting profile:", err);
        }
      }
    }
    if (adminId && adminId !== id) {
      await markProfileOffline(adminId);
    }
    release?.();
    if (sessionLock.current === release) sessionLock.current = null;
  }, [adminProfile?.id, myProfile?.id, clearAdminAuth, clearGuestAuth, markProfileOffline]);

  const logoutAdmin = useCallback(async () => {
    const release = sessionLock.current;
    const id = adminProfile?.id || myProfile?.id;
    setAdminProfile(null);
    setMyProfile(null);
    setSelectedRoom(null);
    setSelectedGroup(null);
    setView("main");
    clearAdminAuth();
    clearGuestAuth();
    if (id) await markProfileOffline(id);
    release?.();
    if (sessionLock.current === release) sessionLock.current = null;
  }, [adminProfile?.id, myProfile?.id, clearAdminAuth, clearGuestAuth, markProfileOffline]);

  const restoreSession = useCallback(async () => {
    const hasStoredSession = (() => {
      try {
        if (localStorage.getItem(STORAGE_ADMIN_PROFILE_ID)) return true;
        const authId = safeStorageGet(guestStorage, STORAGE_AUTH_PROFILE_ID) || localStorage.getItem(STORAGE_AUTH_PROFILE_ID);
        const restoreRaw = safeStorageGet(guestStorage, STORAGE_GUEST_RESTORE) || localStorage.getItem(STORAGE_GUEST_RESTORE);
        return Boolean(authId || restoreRaw);
      } catch {
        return true;
      }
    })();

    if (!hasStoredSession) {
      setLoadingRestore(false);
      return;
    }

    setLoadingRestore(true);
    let release;
    let restoredSession = false;
    try {
      release = await acquireBrowserSession();
      if (!release) return;
      sessionLock.current = release;
      const adminId = localStorage.getItem(STORAGE_ADMIN_PROFILE_ID);
      if (adminId) {
        const restoredAdmin = await loadProfileById(adminId);
        if (restoredAdmin) {
          restoredSession = true;
          setAdminProfile(restoredAdmin);
          setView("admin");
          await markProfileOnline(restoredAdmin.id);
          return;
        }
        clearAdminAuth();
      }

      // Prefer per-tab session storage for guests.
      // Backwards compatibility: migrate old localStorage guest session if present.
      let authId = safeStorageGet(guestStorage, STORAGE_AUTH_PROFILE_ID);
      let restoreRaw = safeStorageGet(guestStorage, STORAGE_GUEST_RESTORE);

      const legacyAuthId = localStorage.getItem(STORAGE_AUTH_PROFILE_ID);
      const legacyRestoreRaw = localStorage.getItem(STORAGE_GUEST_RESTORE);
      if (!authId && legacyAuthId) {
        authId = legacyAuthId;
        safeStorageSet(guestStorage, STORAGE_AUTH_PROFILE_ID, legacyAuthId);
        safeStorageRemove(window.localStorage, STORAGE_AUTH_PROFILE_ID);
      }
      if (!restoreRaw && legacyRestoreRaw) {
        restoreRaw = legacyRestoreRaw;
        safeStorageSet(guestStorage, STORAGE_GUEST_RESTORE, legacyRestoreRaw);
        safeStorageRemove(window.localStorage, STORAGE_GUEST_RESTORE);
      }

      const restoreBlob = safeJsonParse(restoreRaw, null);
      const restoreId = authId || restoreBlob?.profile_id || restoreBlob?.id || null;
      if (!restoreId) return;

      const scheduleKey = `logout_scheduled_${restoreId}`;
      const schedule = safeJsonParse(safeStorageGet(window.localStorage, scheduleKey));
      safeStorageRemove(window.localStorage, scheduleKey);
      if (schedule && Date.now() - schedule.scheduledTime >= 10 * 60 * 1000) {
        await deleteRoomsOf(restoreId);
        await db.entities.ChatProfile.delete(restoreId).catch(console.error);
        clearGuestAuth();
        return;
      }

      const restored = await loadProfileById(restoreId);
      if (restored?.is_banned === true) {
        toast.error(language === "sl" ? "Tvoj dostop je bil blokiran." : "Your access has been blocked.");
        clearGuestAuth();
        setLoadingRestore(false);
        return;
      }

      if (restored) {
        restoredSession = true;
        setMyProfile(restored);
        await markProfileOnline(restored.id);
        safeStorageSet(guestStorage, STORAGE_AUTH_PROFILE_ID, restored.id);
        safeStorageSet(guestStorage, STORAGE_GUEST_RESTORE, JSON.stringify({ profile_id: restored.id, at: Date.now() }));
      } else {
        clearGuestAuth();
      }
    } catch (error) {
      console.error("Could not restore the chat session:", error);
      toast.error(language === "sl" ? "Seje ni bilo mogoče obnoviti. Poskusi znova." : "Could not restore the session. Try again.");
    } finally {
      if (release && !restoredSession) {
        release();
        sessionLock.current = null;
      }
      setLoadingRestore(false);
    }
  }, [clearAdminAuth, clearGuestAuth, loadProfileById, markProfileOnline]);

  useEffect(() => {
    const release = () => {
      sessionLock.current?.();
      sessionLock.current = null;
    };
    const onPageShow = (event) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", release);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", release);
      window.removeEventListener("pageshow", onPageShow);
      release();
    };
  }, []);

  useEffect(() => {
    restoreSession();
     
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Store loadData ref for cross-tab communication
  const loadDataRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  
  // Global BroadcastChannel listener - always active to detect new profiles
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannelRef.current = new BroadcastChannel('local_db_updates');
      broadcastChannelRef.current.onmessage = (event) => {
        const entity = event.data?.entity;
        const action = event.data?.action;
        // Always reload on entity changes
        if (loadDataRef.current && ["ChatProfile", "ChatRoom", "ChatMessage", "ChatGroup", "GroupMessage"].includes(entity)) {
          // If ChatMessage was updated (e.g. marked as read), reload unread counts
          if (entity === "ChatMessage" && action === "update") {
            // Only reload unread counts, not all data
            if (typeof reloadUnreadCounts === 'function') reloadUnreadCounts();
          } else {
            loadDataRef.current();
          }
        }
      };
    }

    // Also listen to storage events as fallback
    const onStorageChange = (e) => {
      if (e.key && e.key.includes('ChatProfile')) {
        if (loadDataRef.current) {
          loadDataRef.current();
        }
      }
    };
    window.addEventListener("storage", onStorageChange);

    return () => {
      window.removeEventListener("storage", onStorageChange);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
    };
  }, []);

  // Helper to reload unread counts only
  const reloadUnreadCounts = async () => {
    if (!myProfile?.id) return;
    try {
      const allRooms = await db.entities.ChatRoom.list("-updated_date", 300);
      const myRooms = (allRooms || []).filter((r) =>
        Array.isArray(r?.participant_ids) ? r.participant_ids.includes(myProfile.id) : false
      );
      const counts = {};
      await Promise.all(
        myRooms.map(async (room) => {
          const partnerId = room?.participant_ids?.find((id) => id !== myProfile.id) || null;
          if (!partnerId || !room?.id) return;
          const messages = await db.entities.ChatMessage.filter(
            { room_id: room.id },
            "created_date",
            100
          );
          const unread = (messages || []).filter(
            (msg) =>
              msg.sender_profile_id !== myProfile.id &&
              (!msg.read_by || !msg.read_by.includes(myProfile.id))
          ).length;
          if (unread > 0) {
            counts[partnerId] = (counts[partnerId] || 0) + unread;
          }
        })
      );
      setUnreadByProfileId(counts);
    } catch (error) {
      console.error("Error reloading unread counts:", error);
    }
  };
  
  // Activity monitoring for current profile
  useEffect(() => {
    const id = myProfile?.id || adminProfile?.id;
    if (!id) return;

    const updateAndBroadcast = async () => {
      await markProfileOnline(id);
      // Broadcast every activity update so other tabs know we're online
      try {
        broadcastChannelRef.current?.postMessage({ entity: 'ChatProfile', action: 'update', id });
      } catch (e) {
        console.error('Activity broadcast error:', e);
      }
    };

    updateAndBroadcast();
    // Update every 1 second for fastest possible sync
    activityIntervalRef.current = setInterval(updateAndBroadcast, 1000);

    const onBeforeUnload = () => {
      markProfileOffline(id);
    };

    // pagehide is more reliable than beforeunload in modern browsers.
    const onPageHide = (event) => {
      if (event?.persisted) return; // bfcache
      markProfileOffline(id);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [adminProfile?.id, myProfile?.id, markProfileOnline, markProfileOffline]);

  const loadData = useCallback(async () => {
    if (!myProfile?.id || view === "admin") return false;
    try {
      const [allProfiles, allGroups, allRooms] = await Promise.all([
        db.entities.ChatProfile.list("-last_activity", 300),
        db.entities.ChatGroup.list("-created_date", 200),
        db.entities.ChatRoom.list("-updated_date", 300),
      ]);

      // Migration: Add is_banned field to all old profiles
      const profilesToMigrate = (allProfiles || []).filter(p => p?.is_banned === undefined);
      if (profilesToMigrate.length > 0) {
        for (const profile of profilesToMigrate) {
          try {
            await db.entities.ChatProfile.update(profile.id, { is_banned: false });
            profile.is_banned = false;
          } catch (error) {
            console.error("Migration error for profile:", profile.id, error);
          }
        }
      }

      const myRecord = (allProfiles || []).find((p) => p?.id === myProfile.id);
      if (myRecord?.is_banned === true) {
        toast.error(language === "sl" ? "Tvoj dostop je bil blokiran." : "Your access has been blocked.");
        await logoutGuest({ preserveProfile: true });
        return false;
      }

      const myCountry = myProfile?.country || "";
      const nowTs = Date.now();
      const profilesById = new Map((allProfiles || []).map((p) => [p?.id, p]));
      const supportsGroupLivenessColumns = (allGroups || []).some(
        (g) =>
          Object.prototype.hasOwnProperty.call(g || {}, "status") ||
          Object.prototype.hasOwnProperty.call(g || {}, "inactive_since")
      );

      const processedGroups = [];
      for (const group of allGroups || []) {
        if (!group?.id || group.id === PUBLIC_CHAT_ID) continue;

        const memberIds = Array.isArray(group.member_ids) ? group.member_ids : [];
        const activeMembers = memberIds.filter((id) => {
          const profile = profilesById.get(id);
          return Boolean(profile && isProfileOnline(profile));
        });

        if (activeMembers.length === 0) {
          if (supportsGroupLivenessColumns) {
            const inactiveSinceTs = group?.inactive_since ? new Date(group.inactive_since).getTime() : NaN;
            const normalizedInactiveTs = Number.isFinite(inactiveSinceTs) ? inactiveSinceTs : nowTs;
            const inactiveElapsed = nowTs - normalizedInactiveTs;

            if (inactiveElapsed >= GROUP_INACTIVE_DELETE_MS) {
              try {
                await db.entities.ChatGroup.delete(group.id);
              } catch (error) {
                console.error("Group auto-delete error:", error);
                processedGroups.push(group);
              }
              continue;
            }

            if (group?.status !== "inactive" || !Number.isFinite(inactiveSinceTs)) {
              const inactiveIso = new Date(normalizedInactiveTs).toISOString();
              try {
                await db.entities.ChatGroup.update(group.id, {
                  status: "inactive",
                  inactive_since: inactiveIso,
                });
                processedGroups.push({ ...group, status: "inactive", inactive_since: inactiveIso });
              } catch (error) {
                console.error("Group set inactive error:", error);
                processedGroups.push(group);
              }
              continue;
            }
          } else {
            const fallbackSinceTs = new Date(group?.updated_date || group?.created_date || 0).getTime();
            if (Number.isFinite(fallbackSinceTs) && nowTs - fallbackSinceTs >= GROUP_INACTIVE_DELETE_MS) {
              try {
                await db.entities.ChatGroup.delete(group.id);
              } catch (error) {
                console.error("Group fallback auto-delete error:", error);
                processedGroups.push(group);
              }
              continue;
            }
          }
        } else if (supportsGroupLivenessColumns && (group?.status === "inactive" || group?.inactive_since)) {
          try {
            await db.entities.ChatGroup.update(group.id, {
              status: "active",
              inactive_since: null,
            });
            processedGroups.push({ ...group, status: "active", inactive_since: null });
          } catch (error) {
            console.error("Group set active error:", error);
            processedGroups.push(group);
          }
          continue;
        }

        processedGroups.push(group);
      }

      // Show online users first, then recently offline users (up to 3 minutes) at the bottom.
      const candidates = (allProfiles || [])
        .filter((p) => p?.id && p.id !== myProfile.id)
        .filter((p) => !p?.is_admin)
        .filter((p) => p?.is_banned !== true)
        .filter((p) => {
          const myBlocked = myProfile?.blocked_users || [];
          const theirBlocked = p?.blocked_users || [];
          if (myBlocked.includes(p.id)) return false;
          if (theirBlocked.includes(myProfile.id)) return false;
          return true;
        });

      const online = [];
      const offlineRecent = [];
      for (const profile of candidates) {
        if (isProfileOnline(profile)) online.push(profile);
        else if (isRecentlyOffline(profile)) offlineRecent.push(profile);
      }

      const sortProfiles = (list) =>
        (list || [])
          .map((profile, idx) => ({ profile, idx }))
          .sort((a, b) => {
            const aPriority = getCountryPriority(a.profile?.country, myCountry);
            const bPriority = getCountryPriority(b.profile?.country, myCountry);
            if (aPriority !== bPriority) return aPriority - bPriority;

            const aGroup = getCountryGroupKey(a.profile?.country, myCountry);
            const bGroup = getCountryGroupKey(b.profile?.country, myCountry);
            if (aGroup !== bGroup) return aGroup.localeCompare(bGroup, "sl");

            const aName = normalizeName(a.profile?.display_name);
            const bName = normalizeName(b.profile?.display_name);
            if (aName !== bName) return aName.localeCompare(bName, "sl");

            return a.idx - b.idx;
          })
          .map((item) => item.profile);

      const sortedProfiles = [...sortProfiles(online), ...sortProfiles(offlineRecent)];

      const visibleGroups = (processedGroups || []).filter((g) => g?.id);

      const myRooms = (allRooms || []).filter((r) =>
        Array.isArray(r?.participant_ids) ? r.participant_ids.includes(myProfile.id) : false
      );

      setGroups(visibleGroups);
      setRooms(myRooms);
      
      // Load unread counts inline
      let directUnreadCounts = {};
      if (Array.isArray(myRooms) && myRooms.length > 0) {
        try {
          const counts = {};
          await Promise.all(
            myRooms.map(async (room) => {
              const partnerId = room?.participant_ids?.find((id) => id !== myProfile.id) || null;
              if (!partnerId || !room?.id) return;

              const messages = await db.entities.ChatMessage.filter(
                { room_id: room.id },
                "created_date",
                100
              );

              const unread = (messages || []).filter(
                (msg) =>
                  msg.sender_profile_id !== myProfile.id &&
                  (!msg.read_by || !msg.read_by.includes(myProfile.id))
              ).length;

              if (unread > 0) {
                counts[partnerId] = (counts[partnerId] || 0) + unread;
              }
            })
          );
          if (unreadInitRef.current) {
            const openedPartnerId =
              selectedRoom?.participant_ids?.find((id) => id !== myProfile.id) || null;
            let shouldPlaySound = false;

            Object.entries(counts).forEach(([partnerId, count]) => {
              const previous = lastUnreadByProfileIdRef.current?.[partnerId] || 0;
              if (count > previous && partnerId !== openedPartnerId) {
                shouldPlaySound = true;
              }
            });

            if (shouldPlaySound) {
              playIncomingMessageSound();
            }
          }

          lastUnreadByProfileIdRef.current = counts;
          unreadInitRef.current = true;
          directUnreadCounts = counts;
          setUnreadByProfileId(counts);
        } catch (error) {
          console.error("Error loading unread counts:", error);
        }
      } else {
        lastUnreadByProfileIdRef.current = {};
        unreadInitRef.current = true;
        directUnreadCounts = {};
        setUnreadByProfileId({});
      }

      const onlinePrioritized = (online || [])
        .map((profile, idx) => ({ profile, idx }))
        .sort((a, b) => {
          const bUnread = directUnreadCounts?.[b.profile?.id] || 0;
          const aUnread = directUnreadCounts?.[a.profile?.id] || 0;
          if (aUnread !== bUnread) return bUnread - aUnread;
          return a.idx - b.idx;
        })
        .map((item) => item.profile);

      const offlinePrioritized = (offlineRecent || [])
        .map((profile, idx) => ({ profile, idx }))
        .sort((a, b) => {
          const bUnread = directUnreadCounts?.[b.profile?.id] || 0;
          const aUnread = directUnreadCounts?.[a.profile?.id] || 0;
          if (aUnread !== bUnread) return bUnread - aUnread;
          return a.idx - b.idx;
        })
        .map((item) => item.profile);

      const prioritizedProfiles = [...onlinePrioritized, ...offlinePrioritized];

      setProfiles(prioritizedProfiles);

      // Load unread group counts
      if (Array.isArray(visibleGroups) && visibleGroups.length > 0) {
        try {
          const groupCounts = {};
          const memberGroups = visibleGroups.filter((g) =>
            Array.isArray(g?.member_ids) ? g.member_ids.includes(myProfile.id) : false
          );

          await Promise.all(
            memberGroups.map(async (group) => {
              if (!group?.id) return;
              const messages = await db.entities.GroupMessage.filter(
                { group_id: group.id },
                "created_date",
                200
              );
              const unread = (messages || []).filter(
                (msg) =>
                  msg.sender_profile_id !== myProfile.id &&
                  (!msg.read_by || !msg.read_by.includes(myProfile.id))
              ).length;
              if (unread > 0) {
                groupCounts[group.id] = unread;
              }
            })
          );
          setUnreadByGroupId(groupCounts);
        } catch (error) {
          console.error("Error loading group unread counts:", error);
        }
      } else {
        setUnreadByGroupId({});
      }
      return true;
    } catch (error) {
      console.error("Error loading data:", error);
      return false;
    }
  }, [myProfile?.id, myProfile?.blocked_users, view, logoutGuest, language, activeTab, selectedRoom, selectedGroup, playIncomingMessageSound]);

  // Update ref for cross-tab communication
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    loadData();
    if (!myProfile?.id || view !== "main") return;
    // Mobile-friendly refresh cadence with lower CPU/battery impact.
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData, myProfile?.id, view]);

  const onCheckName = useCallback(async (name) => {
    const trimmed = String(name || "").trim();
    if (trimmed.length < 3) return false;
    // Only block the name if someone with that name is actually online.
    // We avoid relying on is_online alone because stale/ghost profiles can remain true.
    const allProfiles = await db.entities.ChatProfile.list("-last_activity", 300);
    const needle = trimmed.toLocaleLowerCase("sl");
    const now = Date.now();
    return (allProfiles || []).some((p) => {
      const n = String(p?.display_name || "").trim().toLocaleLowerCase("sl");
      if (!n || n !== needle) return false;
      if (p?.is_banned === true) return false;
      // Consider name taken if the profile is currently online or has a recent logout block
      if (isProfileOnline(p)) return true;
      if (p?.logout_block_until) {
        const until = new Date(p.logout_block_until).getTime();
        if (!Number.isNaN(until) && until > now) return true;
      }
      return false;
    });
  }, []);

  const onRegister = useCallback(
    async (name) => {
      setRegistering(true);
      let release;
      let registered = false;
      try {
        const trimmedName = name.trim();
        if (trimmedName.length < 3 || trimmedName.length > 15) {
          return language === "sl" ? "Vzdevek mora imeti od 3 do 15 znakov." : "Use 3 to 15 characters for your nickname.";
        }

        if (!navigator.locks) {
          return language === "sl" ? "Za vstop uporabi novejši brskalnik." : "Use a newer browser to join.";
        }
        release = await acquireBrowserSession();
        if (!release) {
          return language === "sl"
            ? "V tem brskalniku si že prijavljen v drugem zavihku. Odjavi se tam ali zapri zavihek."
            : "You are already signed in in another tab. Sign out there or close that tab.";
        }
        sessionLock.current = release;

        if (await onCheckName(trimmedName)) {
          return language === "sl" ? "Ta vzdevek je že zaseden." : "This nickname is already taken.";
        }

        const sessionProfile = await db.entities.ChatProfile.create({
          display_name: trimmedName,
          avatar_color: getGenderAvatarColor(""),
          avatar_url: "",
          gallery_images: [],
          is_online: true,
          last_activity: new Date().toISOString(),
          is_typing: false,
          blocked_users: [],
          is_admin: false,
          is_banned: false,
        });

        registered = true;
        setMyProfile(sessionProfile);
        setActiveTab("public");
        setView("main");
        safeStorageSet(guestStorage, STORAGE_AUTH_PROFILE_ID, sessionProfile.id);
        safeStorageSet(guestStorage, STORAGE_GUEST_RESTORE, JSON.stringify({ profile_id: sessionProfile.id, at: Date.now() }));

        // Ensure profile is marked online immediately after registration
        await markProfileOnline(sessionProfile.id);
        
        // Trigger update in other tabs via multiple channels
        try {
          broadcastChannelRef.current?.postMessage({ entity: 'ChatProfile', action: 'create', id: sessionProfile.id });
        } catch (e) {
          console.error('BroadcastChannel send error:', e);
        }

        if (db?.entities?.LoginEvent?.create) {
          void (async () => {
            try {
              const ipLocation = await fetchIpLocation();
              const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
              await db.entities.LoginEvent.create({
                profile_id: sessionProfile.id,
                display_name: sessionProfile.display_name,
                type: "guest",
                auth_provider: "guest",
                ip: ipLocation?.ip || null,
                user_agent: JSON.stringify({
                  ua: userAgent,
                  country: ipLocation?.country || null,
                  city: ipLocation?.city || null,
                  region: ipLocation?.region || null,
                  location_source: ipLocation?.source || null,
                }),
                created_date: new Date().toISOString(),
              });
            } catch {
              // ignore
            }
          })();
        }
      } catch (error) {
        console.error("Register error:", error);
        return language === "sl" ? "Vstop ni uspel. Poskusi znova." : "Could not join the chat. Try again.";
      } finally {
        if (release && !registered) {
          release();
          sessionLock.current = null;
        }
        setRegistering(false);
      }
    },
    [language, onCheckName]
  );

  const openOrCreateRoom = useCallback(
    async (targetProfile) => {
      if (!myProfile?.id || !targetProfile?.id) return;
      try {
        const allRooms = await db.entities.ChatRoom.list("-updated_date", 300);
        const existing = (allRooms || []).find((r) => {
          const ids = r?.participant_ids;
          if (!Array.isArray(ids) || ids.length !== 2) return false;
          return ids.includes(myProfile.id) && ids.includes(targetProfile.id);
        });

        if (existing) {
          setSelectedRoom(existing);
          return;
        }

        const created = await db.entities.ChatRoom.create({
          participant_ids: [myProfile.id, targetProfile.id],
          participant_names: [myProfile.display_name, targetProfile.display_name],
          status: "active",
          last_message: "",
        });
        setSelectedRoom(created);
      } catch (error) {
        console.error("Open room error:", error);
        toast.error(language === "sl" ? "Ne morem odpreti pogovora" : "Cannot open chat");
      }
    },
    [language, myProfile?.display_name, myProfile?.id]
  );

  const onCreateGroup = useCallback(
    async (groupData) => {
      if (!myProfile?.id) return;
      const payload = {
        name: String(groupData?.name || "").trim(),
        description: String(groupData?.description || "").trim(),
        creator_profile_id: myProfile.id,
        creator_name: myProfile.display_name,
        member_ids: [myProfile.id],
        member_count: 1,
        status: "active",
        inactive_since: null,
        avatar_color: groupData?.avatar_color || randomAvatarColor(),
      };
      if (!payload.name) return;

      try {
        await db.entities.ChatGroup.create(payload);
        await loadData();
        toast.success(language === "sl" ? "Skupina ustvarjena" : "Group created");
      } catch (error) {
        console.error("Create group error:", error);
        toast.error(
          error?.message ||
            (language === "sl" ? "Ustvarjanje skupine ni uspelo" : "Failed to create group")
        );
        throw error;
      }
    },
    [language, loadData, myProfile?.display_name, myProfile?.id]
  );

  const onJoinGroup = useCallback(
    async (group) => {
      if (!myProfile?.id || !group?.id) return;
      try {
        const memberIds = Array.isArray(group.member_ids) ? group.member_ids : [];
        let joinedGroup = group;
        if (!memberIds.includes(myProfile.id)) {
          const next = [...memberIds, myProfile.id];
          joinedGroup = await db.entities.ChatGroup.update(group.id, {
            member_ids: next,
            member_count: next.length,
          });
        }
        await loadData();
        setSelectedGroup(joinedGroup);
      } catch (error) {
        console.error("Join group error:", error);
        toast.error(language === "sl" ? "Pridružitev ni uspela" : "Failed to join");
      }
    },
    [language, loadData, myProfile?.id]
  );

  const onOpenGroup = useCallback((group) => {
    setSelectedGroup(group);
  }, []);

  const onDeleteGroup = useCallback(
    async (groupId) => {
      if (!groupId) return;
      try {
        await db.entities.ChatGroup.delete(groupId);
        await loadData();
      } catch (error) {
        console.error("Delete group error:", error);
        toast.error(language === "sl" ? "Brisanje ni uspelo" : "Delete failed");
      }
    },
    [language, loadData]
  );

  const onOpenRoomFromHistory = useCallback((room) => {
    setSelectedRoom(room);
  }, []);

  const saveProfile = useCallback(
    async (patch, options = {}) => {
      if (!myProfile?.id) return;
      const closeAfterSave = options?.closeAfterSave !== false;
      try {
        const updated = await db.entities.ChatProfile.update(myProfile.id, patch);
        setMyProfile(updated);
        toast.success(language === "sl" ? "Shranjeno" : "Saved");
        if (closeAfterSave) {
          setView("main");
        }
      } catch (error) {
        console.error("Save profile error:", error);
        toast.error(language === "sl" ? "Shranjevanje ni uspelo" : "Save failed");
      }
    },
    [language, myProfile?.id]
  );


  // 10-minute auto-logout if user is inactive or closes browser
  useEffect(() => {
    if (!myProfile?.id) return;

    const AUTO_LOGOUT_MINUTES = 10;
    const AUTO_LOGOUT_MS = AUTO_LOGOUT_MINUTES * 60 * 1000;
    const profileId = myProfile.id;

    let logoutTimer = setTimeout(async () => {
      await logoutGuest();
    }, AUTO_LOGOUT_MS);

    const handleUserActivity = () => {
      clearTimeout(logoutTimer);
      logoutTimer = setTimeout(async () => {
        await logoutGuest();
      }, AUTO_LOGOUT_MS);
    };

    const handleBeforeUnload = async () => {
      clearTimeout(logoutTimer);
      // Add a flag to localStorage to track logout on close
      try {
        localStorage.setItem(
          `logout_scheduled_${profileId}`,
          JSON.stringify({ scheduledTime: Date.now() })
        );
      } catch {
        // ignore
      }
    };

    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("keypress", handleUserActivity);
    window.addEventListener("click", handleUserActivity);
    window.addEventListener("scroll", handleUserActivity);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearTimeout(logoutTimer);
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keypress", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [myProfile?.id, logoutGuest]);


  if (loadingRestore) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{t("register.loading", language)}</div>
      </div>
    );
  }

  if (view === "admin" && adminProfile) {
    return (
      <Suspense
        fallback={
          <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}>
            <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{t("register.loading", language)}</div>
          </div>
        }
      >
        <AdminDashboard adminProfile={adminProfile} onLogout={logoutAdmin} onExit={() => setView("main")} />
      </Suspense>
    );
  }

  const sl = language === "sl";

  const themeButton = (
    <ToolButton icon={SunMoon} label={sl ? "Tema" : "Theme"} title={darkMode ? (sl ? "Svetla tema" : "Light theme") : (sl ? "Temna tema" : "Dark theme")} onClick={toggleTheme} />
  );
  const languageSelect = (
    <select className="k-inp" style={{ width: "auto", padding: "2px 4px" }} aria-label={sl ? "Jezik" : "Language"} value={language} onChange={(e) => persistLanguage(e.target.value)}>
      <option value="sl">SLO</option>
      <option value="en">ENG</option>
    </select>
  );

  if (!myProfile) {
    return (
      <ClassicWindow
        subtitle={sl ? "Vstop" : "Join"}
        toolbar={<><span className="k-grow" />{languageSelect}{themeButton}</>}
        status={
          <>
            <span><span className={`k-dot${isOnline ? "" : " k-away"}`} />{isOnline ? (sl ? "Povezano" : "Connected") : t("conn.reconnecting", language)}</span>
            <span>{sl ? "Nisi prijavljen" : "Not signed in"}</span>
          </>
        }
      >
        <main className="k-entry">
          <div className="k-entrybox">
            <GuestRegistration onRegister={onRegister} isLoading={registering} language={language} />
            <div className="k-links">
              <button type="button" className="k-link" onClick={() => (window.location.href = createPageUrl("PrivacyPolicy"))}>
                {t("privacy.title", language)}
              </button>
              <button type="button" className="k-link" onClick={() => (window.location.href = createPageUrl("TermsOfUse"))}>
                {t("terms.title", language)}
              </button>
            </div>
          </div>
        </main>
      </ClassicWindow>
    );
  }

  /* ---------- prijavljen: klasično okno ---------- */
  const blockedIds = new Set(myProfile.blocked_users || []);
  const visibleProfiles = (profiles || []).filter((p) => p?.id && p.id !== myProfile.id && !blockedIds.has(p.id) && !p.is_admin);
  const onlineProfiles = visibleProfiles.filter(isProfileOnline);
  const partnerId = selectedRoom?.participant_ids?.find((id) => id !== myProfile.id) || null;
  const partnerName = selectedRoom?.participant_names?.find((_, idx) => selectedRoom.participant_ids?.[idx] === partnerId) || "";
  const partnerProfile = partnerId ? visibleProfiles.find((p) => p.id === partnerId) : null;

  // Med prisotnimi so samo uporabniki, ki so res prijavljeni (brez nedavno odsotnih).
  const peopleAll = [{ profile: myProfile, online: true }, ...onlineProfiles.map((p) => ({ profile: p, online: true }))];
  const peopleHere =
    selectedRoom && view === "main"
      ? [
          { profile: myProfile, online: true },
          ...(partnerProfile && isProfileOnline(partnerProfile) ? [{ profile: partnerProfile, online: true }] : []),
        ]
      : peopleAll;

  const conversationRooms = [...(rooms || [])];
  if (selectedRoom && !conversationRooms.some((r) => r.id === selectedRoom.id)) conversationRooms.unshift(selectedRoom);
  const conversations = conversationRooms
    .map((room) => {
      const pid = room?.participant_ids?.find((id) => id !== myProfile.id) || null;
      const name = room?.participant_names?.find((_, idx) => room.participant_ids?.[idx] === pid) || "?";
      return { id: room.id, room, pid, name, unread: (pid && unreadByProfileId[pid]) || 0 };
    })
    .filter((c) => c.pid && !blockedIds.has(c.pid) && (c.room.last_message || c.unread > 0 || c.id === selectedRoom?.id));

  const treeSelected = view === "settings" ? "settings" : view === "support" ? "" : selectedRoom ? `room:${selectedRoom.id}` : activeTab;
  const closeTreeOnPhone = () => {
    if (window.matchMedia?.("(max-width: 640px)").matches) setTreeOpen(false);
  };
  const goPublic = () => {
    setSelectedRoom(null);
    setSelectedGroup(null);
    setActiveTab("public");
    setView("main");
    closeTreeOnPhone();
  };
  const onTreeSelect = (id) => {
    if (id === "home" || id === "public") return goPublic();
    if (id === "groups") {
      setSelectedRoom(null);
      setSelectedGroup(null);
      setActiveTab("groups");
      setView("main");
      closeTreeOnPhone();
      return;
    }
    if (id === "settings") {
      setView("settings");
      closeTreeOnPhone();
      return;
    }
    const c = conversations.find((x) => `room:${x.id}` === id);
    if (c) {
      setSelectedGroup(null);
      setSelectedRoom(c.room);
      setView("main");
      closeTreeOnPhone();
    }
  };
  const startChat = (profile) => {
    setSelectedGroup(null);
    setProfileDialog(null);
    setNewChatOpen(false);
    setView("main");
    closeTreeOnPhone();
    void openOrCreateRoom(profile);
  };

  const subtitle =
    view === "settings"
      ? t("settings.title", language)
      : view === "support"
        ? t("support.title", language)
        : selectedRoom
          ? partnerName
          : activeTab === "groups"
            ? selectedGroup?.name || (sl ? "Skupine" : "Groups")
            : sl ? "# Splošno" : "# General";

  let center;
  if (view === "settings") {
    center = <ProfileSettings profile={myProfile} onBack={goPublic} onSave={saveProfile} language={language} />;
  } else if (view === "support") {
    center = <SupportForm myProfile={myProfile} onBack={goPublic} language={language} />;
  } else if (selectedRoom) {
    center = (
      <ChatWindow
        key={selectedRoom.id}
        room={selectedRoom}
        myProfileId={myProfile.id}
        myName={myProfile.display_name}
        partnerName={partnerName}
        language={language}
        searchQuery={searchQuery}
        onBack={goPublic}
        onPartnerOffline={() => {}}
        onUserBlocked={(blockedId) => {
          setMyProfile((prev) => (prev ? { ...prev, blocked_users: [...(prev.blocked_users || []), blockedId] } : prev));
          setProfiles((prev) => (prev || []).filter((p) => p?.id !== blockedId));
          setSelectedRoom(null);
        }}
      />
    );
  } else if (activeTab === "groups") {
    center = selectedGroup ? (
      <GroupChat key={selectedGroup.id} group={selectedGroup} myProfileId={myProfile.id} myName={myProfile.display_name} onBack={() => setSelectedGroup(null)} language={language} />
    ) : (
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <GroupList groups={groups} myProfile={myProfile} onlineUsers={onlineProfiles} unreadByGroupId={unreadByGroupId} onCreateGroup={onCreateGroup} onJoinGroup={onJoinGroup} onOpenGroup={onOpenGroup} onDeleteGroup={onDeleteGroup} language={language} />
      </div>
    );
  } else {
    center = <PublicChat key={myProfile.id} profile={myProfile} language={language} isOnline={isOnline} searchQuery={searchQuery} />;
  }

  return (
    <>
      <ClassicWindow
        subtitle={subtitle}
        toolbar={
          <>
            <ToolButton icon={PanelLeft} label={sl ? "Drevo" : "Tree"} pressed={treeOpen} onClick={() => setTreeOpen((v) => !v)} />
            <span className="k-sep" />
            <ToolButton icon={HomeIcon} label={sl ? "Domov" : "Home"} onClick={goPublic} />
            <ToolButton icon={MessageSquarePlus} label={sl ? "Nov pogovor" : "New chat"} onClick={() => setNewChatOpen(true)} />
            <span className="k-sep" />
            <ToolButton
              icon={RefreshCw}
              label={sl ? "Osveži sezname" : "Refresh lists"}
              onClick={async () => {
                if (refreshing) return;
                setRefreshing(true);
                try {
                  if (await loadData()) toast.success(sl ? "Seznami so osveženi." : "Lists refreshed.");
                  else toast.error(sl ? "Osveževanje ni uspelo." : "Could not refresh the lists.");
                } finally {
                  setRefreshing(false);
                }
              }}
            />
            {themeButton}
            {languageSelect}
            <span className="k-sep" />
            <ToolButton icon={LifeBuoy} label={sl ? "Podpora" : "Support"} title={t("support.title", language)} onClick={() => setView("support")} />
            <ToolButton icon={Settings} label={sl ? "Nastavitve" : "Settings"} title={t("settings.title", language)} onClick={() => setView("settings")} />
            <span className="k-grow" />
            {view === "main" && (selectedRoom || activeTab === "public") && (
              <label className="k-search">
                <Search aria-hidden="true" />
                <input type="search" placeholder={sl ? "Išči v sporočilih" : "Search messages"} aria-label={sl ? "Išči v sporočilih" : "Search messages"} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </label>
            )}
            <ToolButton icon={LogOut} danger label={t("header.logout", language)} onClick={() => void logoutGuest()} />
          </>
        }
        status={
          <>
            <span><span className={`k-dot${isOnline ? "" : " k-away"}`} />{isOnline ? (sl ? "Povezano" : "Connected") : t("conn.reconnecting", language)}</span>
            <span>{t("header.loggedAs", language)} <b>{myProfile.display_name}</b></span>
            <span className="k-opt">{onlineProfiles.length + 1} {sl ? "prisotnih" : "online"}</span>
          </>
        }
      >
        <div className={`k-body${treeOpen ? "" : " k-notree"}`}>
          <TreeNav sl={sl} selected={treeSelected} conversations={conversations} onSelect={onTreeSelect} />
          <section className="k-center" aria-label={subtitle}>
            {!isOnline && (
              <div className="k-offline" role="status">
                <b>{t("conn.offline", language)}</b>
                <span>{t("conn.reconnecting", language)}</span>
              </div>
            )}
            <Suspense fallback={<div className="k-empty-msg">{t("register.loading", language)}</div>}>{center}</Suspense>
          </section>
          <PresenceList
            sl={sl}
            people={peopleHere}
            myId={myProfile.id}
            selectedId={profileDialog?.id || null}
            onPick={(p) => setProfileDialog(p)}
            onOpenChat={startChat}
          />
        </div>
      </ClassicWindow>

      {profileDialog && (
        <ProfileDialog
          key={profileDialog.id}
          sl={sl}
          profile={visibleProfiles.find((p) => p.id === profileDialog.id) || profileDialog}
          online={isProfileOnline(visibleProfiles.find((p) => p.id === profileDialog.id) || profileDialog)}
          onClose={() => setProfileDialog(null)}
          onChat={startChat}
        />
      )}
      <NewChatDialog
        sl={sl}
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        people={onlineProfiles.map((p) => ({ profile: p, online: true }))}
        onPick={startChat}
      />
      <InactivityMonitor isActive={Boolean(myProfile?.id)} onLogout={logoutGuest} onStayActive={() => markProfileOnline(myProfile.id)} />
    </>
  );
}
