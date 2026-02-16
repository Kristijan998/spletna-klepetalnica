import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  LifeBuoy,
  LogOut,
  MessageCircle,
  Moon,
  Settings,
  Sun,
  Users,
  MessagesSquare,
  History,
} from "lucide-react";

import LanguageSelector from "@/components/LanguageSelector";
import GuestRegistration from "@/components/chat/GuestRegistration";
import UserCard from "@/components/chat/UserCard";
import ChatWindow from "@/components/chat/ChatWindow";
import GroupList from "@/components/chat/GroupList";
import GroupChat from "@/components/chat/GroupChat";
import ChatHistory from "@/components/chat/ChatHistory";
import ProfileSettings from "@/components/chat/ProfileSettings";
import SupportForm from "@/components/chat/SupportForm";
import InactivityMonitor from "@/components/chat/InactivityMonitor";
import AdminDashboard from "@/pages/AdminDashboard";
import { t } from "@/components/utils/translations";
import { useTheme } from "@/hooks/use-theme";
import { createPageUrl } from "@/utils";

const STORAGE_AUTH_PROFILE_ID = "auth_profile_id";
const STORAGE_ADMIN_PROFILE_ID = "admin_profile_id";
const STORAGE_GUEST_RESTORE = "guest_restore_v1";
const STORAGE_LANGUAGE = "chat_language";

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
  if (normalized === "moÅ¡ki" || normalized === "moski") return "#3b82f6";
  if (normalized === "Å¾enska" || normalized === "zenska") return "#ec4899";
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

export default function Home() {
  const { isDark, toggleTheme } = useTheme();
  const darkMode = isDark;

  // Guest session must be per-tab so we can test multiple guests locally.
  // localStorage is shared across tabs and would overwrite auth in other tab.
  const guestStorage = typeof window !== "undefined" ? window.sessionStorage : null;

  const [language, setLanguage] = useState(() => localStorage.getItem(STORAGE_LANGUAGE) || "sl");
  const [activeTab, setActiveTab] = useState("users");

  const [myProfile, setMyProfile] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);

  const [loadingRestore, setLoadingRestore] = useState(true);
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

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
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
    const appTitle = isEn ? "Web chat" : "Klepetalnica";
    const chromeThemeColor = darkMode ? "#162a4a" : "#f4f7ff";
    const seoTitle = isEn
      ? "Chattko - Free Global Web Chat & Online Rooms"
      : "Chattko - Brezplacna spletna klepetalnica v slovenscini";
    const seoDescription = isEn
      ? "Welcome to Chattko! Join our global web chat rooms for free. Meet new friends from all over the world in real-time."
      : "Pridruzi se Chattko, najboljsi slovenski klepetalnici. Klepetaj v zivo, spoznaj nove ljudi in se zabavaj popolnoma brezplacno.";

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
    document.title = appTitle;

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
    // By default preserve the profile but mark it offline and block immediate re-login
    const { preserveProfile = true } = options;
    const id = myProfile?.id;
    setMyProfile(null);
    setSelectedRoom(null);
    setSelectedGroup(null);
    setView("main");
    clearGuestAuth();
    if (id) {
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
  }, [myProfile?.id, clearGuestAuth, markProfileOffline]);

  const logoutAdmin = useCallback(async () => {
    const id = adminProfile?.id;
    setAdminProfile(null);
    setView("main");
    clearAdminAuth();
    if (id) await markProfileOffline(id);
  }, [adminProfile?.id, clearAdminAuth, markProfileOffline]);

  const restoreSession = useCallback(async () => {
    setLoadingRestore(true);
    try {
      const adminId = localStorage.getItem(STORAGE_ADMIN_PROFILE_ID);
      if (adminId) {
        const restoredAdmin = await loadProfileById(adminId);
        if (restoredAdmin) {
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

      const restored = await loadProfileById(restoreId);
      if (restored?.is_banned === true) {
        toast.error(language === "sl" ? "Tvoj dostop je bil blokiran." : "Your access has been blocked.");
        clearGuestAuth();
        setLoadingRestore(false);
        return;
      }

      if (restored) {
        setMyProfile(restored);
        await markProfileOnline(restored.id);
        safeStorageSet(guestStorage, STORAGE_AUTH_PROFILE_ID, restored.id);
        safeStorageSet(guestStorage, STORAGE_GUEST_RESTORE, JSON.stringify({ profile_id: restored.id, at: Date.now() }));
      } else {
        clearGuestAuth();
      }
    } finally {
      setLoadingRestore(false);
    }
  }, [clearAdminAuth, clearGuestAuth, loadProfileById, markProfileOnline]);

  useEffect(() => {
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  
  // Global BroadcastChannel listener - always active to detect new profiles
  useEffect(() => {
    console.warn("\u26A0\uFE0F POMEMBNO: Lokalni na\u010Din (localStorage) deluje samo znotraj ISTEGA brskalni\u0161kega profila (npr. isti Chrome profil).");
    console.warn("\u26A0\uFE0F Za testiranje dveh gostov uporabi dva zavihka v istem profilu (vsak zavihek ima svoj sessionStorage). Drugi Chrome profili/brskalniki se ne vidijo.");
    let channel;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('local_db_updates');
      channel.onmessage = (event) => {
        console.log('\uD83D\uDCE1 BroadcastChannel event:', event.data);
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
    } else {
      console.error('BroadcastChannel NOT supported in this browser!');
    }

    // Also listen to storage events as fallback
    const onStorageChange = (e) => {
      console.log('\uD83D\uDCBE Storage event:', e.key);
      if (e.key && e.key.includes('ChatProfile')) {
        if (loadDataRef.current) {
          console.log('\uD83D\uDD04 Reloading from storage event...');
          loadDataRef.current();
        }
      }
    };
    window.addEventListener("storage", onStorageChange);

    return () => {
      window.removeEventListener("storage", onStorageChange);
      if (channel) channel.close();
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
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel('local_db_updates');
          channel.postMessage({ entity: 'ChatProfile', action: 'update', id });
          channel.close();
        } catch (e) { console.error('Activity broadcast error:', e); }
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
    if (!myProfile?.id || view !== "main") return;
    try {
      const [allProfiles, allGroups, allRooms] = await Promise.all([
        db.entities.ChatProfile.list("-last_activity", 300),
        db.entities.ChatGroup.list("-created_date", 200),
        db.entities.ChatRoom.list("-updated_date", 300),
      ]);

      console.log('=== PROFILES DEBUG ===');
      console.log('Total profiles in localStorage:', allProfiles?.length);
      console.log('My profile ID:', myProfile.id);
      console.log('All profiles:', allProfiles?.map(p => ({
        id: p.id,
        name: p.display_name,
        is_online: p.is_online,
        last_activity: p.last_activity,
        isOnlineCheck: isProfileOnline(p)
      })));
      console.log('======================');

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
        return;
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
        if (!group?.id) continue;

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
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, [myProfile?.id, myProfile?.blocked_users, view, logoutGuest, language, activeTab, selectedRoom, selectedGroup, playIncomingMessageSound]);

  // Update ref for cross-tab communication
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    loadData();
    if (!myProfile?.id || view !== "main") return;
    // Refresh every 1 second for fastest updates
    const interval = setInterval(loadData, 1000);
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
    async (data) => {
      setRegistering(true);
      try {
        const trimmedName = String(data?.display_name || "").trim();
        if (!trimmedName) throw new Error(language === "sl" ? "Ime manjka" : "Name is required");

        const isTaken = await onCheckName(trimmedName);
        if (isTaken) {
          toast.error(t("register.nameTaken", language));
          return;
        }

        const normalizedCity = String(data?.city || "").trim().toLowerCase();
        const isAdminRegistration =
          trimmedName === "Telebajsek1999@" &&
          Number(data?.birth_year) === 1999 &&
          normalizedCity === "mozirje";

        const created = await db.entities.ChatProfile.create({
          display_name: trimmedName,
          birth_year: data?.birth_year || "",
          gender: data?.gender || "",
          country: data?.country || "",
          city: data?.city || "",
          bio: data?.bio || "",
          avatar_color: getGenderAvatarColor(data?.gender),
          avatar_url: "",
          gallery_images: [],
          is_online: true,
          last_activity: new Date().toISOString(),
          is_typing: false,
          blocked_users: [],
          is_admin: isAdminRegistration,
          is_banned: false,
        });

        setMyProfile(created);
        if (isAdminRegistration) {
          setAdminProfile(created);
          setView("admin");
        }
        safeStorageSet(guestStorage, STORAGE_AUTH_PROFILE_ID, created.id);
        safeStorageSet(guestStorage, STORAGE_GUEST_RESTORE, JSON.stringify({ profile_id: created.id, at: Date.now() }));
        if (isAdminRegistration) {
          try {
            localStorage.setItem(STORAGE_ADMIN_PROFILE_ID, created.id);
          } catch {
            // ignore
          }
        }

        // Ensure profile is marked online immediately after registration
        await markProfileOnline(created.id);
        
        // Force immediate data load in this tab
        setTimeout(() => {
          if (!isAdminRegistration) {
            loadData();
          }
        }, 300);
        
        // Trigger update in other tabs via multiple channels
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const channel = new BroadcastChannel('local_db_updates');
            console.log('\u2B07\uFE0F Sending BroadcastChannel: Profile created', created.id);
            channel.postMessage({ entity: 'ChatProfile', action: 'create', id: created.id });
            channel.close();
          } catch (e) { console.error('BroadcastChannel send error:', e); }
        }

        try {
          if (db?.entities?.LoginEvent?.create) {
            await db.entities.LoginEvent.create({
              profile_id: created.id,
              profile_name: created.display_name,
              type: "guest",
              created_date: new Date().toISOString(),
            });
          }
        } catch {
          // ignore
        }
      } catch (error) {
        console.error("Register error:", error);
        toast.error(error?.message || (language === "sl" ? "Registracija ni uspela" : "Registration failed"));
      } finally {
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
        if (!memberIds.includes(myProfile.id)) {
          const next = [...memberIds, myProfile.id];
          await db.entities.ChatGroup.update(group.id, {
            member_ids: next,
            member_count: next.length,
          });
        }
        await loadData();
        setSelectedGroup({ ...group, member_ids: [...(group.member_ids || []), myProfile.id], member_count: (group.member_count || memberIds.length) + 1 });
      } catch (error) {
        console.error("Join group error:", error);
        toast.error(language === "sl" ? "PridruÅ¾itev ni uspela" : "Failed to join");
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

  const mainHeader = useMemo(() => {
    const onlineOthers = (profiles || []).filter(isProfileOnline).length;
    const onlineCount = (myProfile?.id ? 1 : 0) + onlineOthers;
    return (
      <div className="flex flex-wrap items-center justify-between mb-8 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"} tracking-tight`}>
              {t("app.title", language)}
            </h1>
            <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
              {t("header.loggedAs", language)}{" "}
              <span className="text-violet-600 font-medium">{myProfile?.display_name || ""}</span>
            </p>
            <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
              <span className="text-green-600 font-medium">{onlineCount} {language === "sl" ? "aktivnih" : "active"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <LanguageSelector language={language} onChange={persistLanguage} darkMode={darkMode} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              toggleTheme();
              setTimeout(() => setProfiles([...profiles]), 0);
            }}
            className="rounded-xl h-9 w-9"
            title={
              darkMode
                ? language === "sl"
                  ? "Svetli naÄin"
                  : "Light mode"
                : language === "sl"
                  ? "Temni naÄin"
                  : "Dark mode"
            }
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          {myProfile && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView("support")}
                className="rounded-xl h-9 w-9"
                title={t("support.title", language)}
              >
                <LifeBuoy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView("settings")}
                className="rounded-xl h-9 w-9"
                title={t("settings.title", language)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={logoutGuest}
                className={`rounded-xl ${darkMode ? "text-gray-400 hover:text-red-400" : "text-gray-500 hover:text-red-500"} gap-2 text-sm`}
              >
                <LogOut className="w-4 h-4" />
                {t("header.logout", language)}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }, [darkMode, language, logoutGuest, myProfile, persistLanguage, profiles]);

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

  // Check if user should be auto-logged out on app start
  useEffect(() => {
    const checkScheduledLogouts = async () => {
      try {
        const profileId = safeStorageGet(guestStorage, STORAGE_AUTH_PROFILE_ID);
        if (!profileId) return;

        const logoutSchedule = localStorage.getItem(`logout_scheduled_${profileId}`);
        if (!logoutSchedule) return;

        const { scheduledTime } = JSON.parse(logoutSchedule);
        const elapsedMs = Date.now() - scheduledTime;
        const AUTO_LOGOUT_MS = 10 * 60 * 1000;

        if (elapsedMs >= AUTO_LOGOUT_MS) {
          try {
            await db.entities.ChatProfile.delete(profileId);
          } catch (err) {
            console.error("Error deleting profile:", err);
          }
          safeStorageRemove(guestStorage, STORAGE_AUTH_PROFILE_ID);
          safeStorageRemove(guestStorage, STORAGE_GUEST_RESTORE);
          localStorage.removeItem(`logout_scheduled_${profileId}`);
          window.location.reload();
        }
      } catch (err) {
        console.error("Error checking scheduled logouts:", err);
      }
    };

    checkScheduledLogouts();
  }, []);

  if (loadingRestore) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{t("register.loading", language)}</div>
      </div>
    );
  }

  if (view === "admin" && adminProfile) {
    return <AdminDashboard adminProfile={adminProfile} onLogout={logoutAdmin} onExit={() => setView("main")} />;
  }

  if (!myProfile) {
    return (
      <div className={`min-h-screen w-full ${
        darkMode
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-violet-50 via-white to-indigo-50"
      } p-4`}
      >
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div className="w-full sm:w-auto" />
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <LanguageSelector language={language} onChange={persistLanguage} darkMode={darkMode} />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className={`rounded-xl ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                title={darkMode ? (language === "sl" ? "Svetli naÄin" : "Light mode") : (language === "sl" ? "Temni naÄin" : "Dark mode")}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="max-w-md mx-auto w-full px-4 sm:px-0">
            <GuestRegistration
              onRegister={onRegister}
              isLoading={registering}
              language={language}
              onLanguageDetect={persistLanguage}
              darkMode={darkMode}
              onCheckName={onCheckName}
            />
            <div className="mt-4 flex items-center justify-center gap-4 text-center">
              <button
                type="button"
                onClick={() => (window.location.href = createPageUrl("PrivacyPolicy"))}
                className={`text-xs underline ${darkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t("privacy.title", language)}
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = createPageUrl("TermsOfUse"))}
                className={`text-xs underline ${darkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t("terms.title", language)}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div
        className={`min-h-screen ${
          darkMode
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
            : "bg-gradient-to-br from-slate-50 via-white to-slate-100"
        } p-4`}
      >
        <div className="max-w-3xl mx-auto">
          {mainHeader}
          <ProfileSettings profile={myProfile} onBack={() => setView("main")} onSave={saveProfile} language={language} />
        </div>
      </div>
    );
  }

  if (view === "support") {
    return (
      <div
        className={`min-h-screen ${
          darkMode
            ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
            : "bg-gradient-to-br from-violet-50 via-white to-indigo-50"
        } p-4`}
      >
        <div className="max-w-3xl mx-auto">
          {mainHeader}
          <SupportForm myProfile={myProfile} onBack={() => setView("main")} language={language} />
        </div>
      </div>
    );
  }

  if (selectedRoom) {
    const partnerId = selectedRoom?.participant_ids?.find((id) => id !== myProfile.id) || null;
    const partnerName = selectedRoom?.participant_names?.find((_, idx) => selectedRoom.participant_ids?.[idx] === partnerId) || "";

    return (
      <div
        className={`min-h-screen ${
          darkMode
            ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
            : "bg-gradient-to-br from-violet-50 via-white to-indigo-50"
        } p-4`}
      >
        <div className="max-w-5xl mx-auto">
          {mainHeader}
          <ChatWindow
            room={selectedRoom}
            myProfileId={myProfile.id}
            myName={myProfile.display_name}
            partnerName={partnerName}
            language={language}
            onBack={() => setSelectedRoom(null)}
            onPartnerOffline={() => {}}
            onUserBlocked={(blockedId) => {
              setMyProfile((prev) =>
                prev ? { ...prev, blocked_users: [...(prev.blocked_users || []), blockedId] } : prev
              );
              setProfiles((prev) => (prev || []).filter((p) => p?.id !== blockedId));
              setSelectedRoom(null);
            }}
          />
        </div>
        <InactivityMonitor isActive={Boolean(myProfile?.id)} onLogout={logoutGuest} onStayActive={() => markProfileOnline(myProfile.id)} />
      </div>
    );
  }

  if (selectedGroup) {
    return (
      <div
        className={`min-h-screen ${
          darkMode
            ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
            : "bg-gradient-to-br from-violet-50 via-white to-indigo-50"
        } p-4`}
      >
        <div className="max-w-5xl mx-auto">
          {mainHeader}
          <div className="h-[calc(100vh-170px)]">
            <GroupChat
              group={selectedGroup}
              myProfileId={myProfile.id}
              myName={myProfile.display_name}
              onBack={() => setSelectedGroup(null)}
              language={language}
            />
          </div>
        </div>
        <InactivityMonitor isActive={Boolean(myProfile?.id)} onLogout={logoutGuest} onStayActive={() => markProfileOnline(myProfile.id)} />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen pb-24 ${
        darkMode
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-violet-50 via-white to-indigo-50"
      } p-4`}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        {mainHeader}

        {!isOnline && (
          <div className={`mb-4 rounded-xl border px-3 py-2 text-xs ${darkMode ? "border-red-900/40 bg-red-900/20 text-red-300" : "border-red-200 bg-red-50 text-red-700"}`}>
            {t("conn.offline", language)}  {t("conn.reconnecting", language)}
          </div>
        )}

        {/* Tabs with content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className={`${darkMode ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-100"} backdrop-blur border rounded-xl p-1 w-full`}>
            <TabsTrigger value="users" className={`flex-1 rounded-lg gap-1.5 text-xs ${darkMode ? "data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300" : "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700"}`}>
                <Users className="w-4 h-4" />
                {t("tabs.users", language)}
              </TabsTrigger>
            <TabsTrigger value="groups" className={`flex-1 rounded-lg gap-1.5 text-xs ${darkMode ? "data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300" : "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700"}`}>
                <MessagesSquare className="w-4 h-4" />
                {t("tabs.groups", language)}
              </TabsTrigger>
            <TabsTrigger value="history" className={`flex-1 rounded-lg gap-1.5 text-xs ${darkMode ? "data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300" : "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700"}`}>
                <History className="w-4 h-4" />
                {t("tabs.history", language)}
              </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            {profiles.length === 0 ? (
              <div className={`text-center py-16 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t("users.none", language)}</p>
                <p className="text-xs mt-1">{t("users.wait", language)}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {prioritizedProfiles.map((p) => (
                  <UserCard
                    key={p.id}
                    profile={p}
                    isOnline={isProfileOnline(p)}
                    onStartChat={openOrCreateRoom}
                    isCurrentUser={false}
                    language={language}
                    unreadCount={unreadByProfileId[p.id] || 0}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups">
            <GroupList
              groups={groups}
              myProfile={myProfile}
              onlineUsers={(profiles || []).filter(isProfileOnline)}
              unreadByGroupId={unreadByGroupId}
              onCreateGroup={onCreateGroup}
              onJoinGroup={onJoinGroup}
              onOpenGroup={onOpenGroup}
              onDeleteGroup={onDeleteGroup}
              language={language}
            />
          </TabsContent>

          <TabsContent value="history">
            <ChatHistory rooms={rooms} myProfileId={myProfile.id} onOpenRoom={onOpenRoomFromHistory} language={language} />
          </TabsContent>
        </Tabs>
      </div>

      <InactivityMonitor isActive={Boolean(myProfile?.id)} onLogout={logoutGuest} onStayActive={() => markProfileOnline(myProfile.id)} />
    </div>
  );
}


