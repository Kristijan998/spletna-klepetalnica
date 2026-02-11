// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/Chart";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, Ban, LogOut, MessageSquare, Moon, Search, Shield, Sun, Trash2, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useTheme } from "@/hooks/use-theme";
import { toast } from "sonner";

function isProfileOnline(profile) {
  if (!profile?.is_online) return false;
  if (!profile?.last_activity) return true;
  const last = new Date(profile.last_activity).getTime();
  if (Number.isNaN(last)) return Boolean(profile.is_online);
  return Date.now() - last < 5 * 60 * 1000;
}

function toLocalDayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function normalizeGender(value) {
  return String(value || "").trim().toLowerCase();
}

export default function AdminDashboard({ adminProfile, onLogout, onExit }) {
  const { isDark, toggleTheme } = useTheme();
  const darkMode = isDark;
  const currentYear = new Date().getFullYear();
  const getAge = (birthYear) => {
    const year = Number(birthYear);
    if (!Number.isFinite(year)) return null;
    if (year < 1900 || year > currentYear) return null;
    return currentYear - year;
  };
  const [tab, setTab] = useState("active");

  const [profiles, setProfiles] = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);
  const [loginEvents, setLoginEvents] = useState([]);

  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [demoUserCount, setDemoUserCount] = useState(3);
  const [creatingDemo, setCreatingDemo] = useState(false);

  const loadProfilesAndSupport = async () => {
    try {
      const allProfiles = await db.entities.ChatProfile.list("-last_activity", 2000);
      
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
      
      setProfiles(allProfiles);
    } catch (error) {
      console.error("Error loading profiles:", error);
    }

    try {
      const allSupport = await db.entities.SupportMessage.list("-created_date", 200);
      setSupportMessages(allSupport);
    } catch (error) {
      console.error("Error loading support messages:", error);
    }

    try {
      if (db?.entities?.LoginEvent?.list) {
        const events = await db.entities.LoginEvent.list("-created_date", 500);
        setLoginEvents(events);
      } else {
        setLoginEvents([]);
      }
    } catch (error) {
      console.error("Error loading login events:", error);
      setLoginEvents([]);
    }
  };

  const loadRooms = async () => {
    try {
      const allRooms = await db.entities.ChatRoom.list("-updated_date", 200);
      setRooms(allRooms);
    } catch (error) {
      console.error("Error loading rooms:", error);
    }
  };

  const loadRoomMessages = async (roomId) => {
    try {
      const msgs = await db.entities.ChatMessage.filter({ room_id: roomId }, "created_date", 200);
      setMessages(msgs);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  useEffect(() => {
    loadProfilesAndSupport();
    loadRooms();

    const interval = setInterval(() => {
      loadProfilesAndSupport();
      loadRooms();
      if (selectedRoom?.id) loadRoomMessages(selectedRoom.id);
      
      // Keep demo users online
      (async () => {
        try {
          const allProfiles = await db.entities.ChatProfile.list("-last_activity", 300);
          const demoProfiles = allProfiles.filter(p => 
            !p.is_admin && 
            p.display_name && 
            /^[A-Z][a-z]+\d{1,2}$/.test(p.display_name)
          );
          
          for (const profile of demoProfiles) {
            await db.entities.ChatProfile.update(profile.id, {
              is_online: true,
              last_activity: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error("Error updating demo users:", error);
        }
      })();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedRoom?.id]);

  useEffect(() => {
    if (selectedRoom?.id) {
      loadRoomMessages(selectedRoom.id);
    } else {
      setMessages([]);
    }
  }, [selectedRoom?.id]);

  const activeUsers = useMemo(() => {
    return profiles
      .filter((p) => !p?.is_admin)
      .filter(isProfileOnline)
      .slice(0, 200);
  }, [profiles]);

  const nonAdminProfiles = useMemo(() => profiles.filter((p) => !p?.is_admin), [profiles]);

  const totals = useMemo(() => {
    const total = nonAdminProfiles.length;
    const onlineNow = nonAdminProfiles.filter(isProfileOnline).length;

    let women = 0;
    let men = 0;
    let other = 0;
    let unknown = 0;

    for (const p of nonAdminProfiles) {
      const g = normalizeGender(p.gender);
      if (!g) {
        unknown += 1;
      } else if (g === "ženska" || g === "zenska" || g === "female" || g === "f") {
        women += 1;
      } else if (g === "moški" || g === "moski" || g === "male" || g === "m") {
        men += 1;
      } else {
        other += 1;
      }
    }

    return { total, onlineNow, women, men, other, unknown };
  }, [nonAdminProfiles]);

  const dailyUsersSeries = useMemo(() => {
    const DAYS = 14;
    const today = new Date();
    const start = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), -(DAYS - 1));

    const counts = new Map();
    for (const p of nonAdminProfiles) {
      const stamp = p.last_activity || p.created_date;
      const key = toLocalDayKey(stamp);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const data = [];
    for (let i = 0; i < DAYS; i += 1) {
      const d = addDays(start, i);
      const key = toLocalDayKey(d);
      const label = d.toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit" });
      data.push({ day: label, key, users: counts.get(key) || 0 });
    }

    return data;
  }, [nonAdminProfiles]);

  const genderSeries = useMemo(() => {
    return [
      { label: "Moški", value: totals.men },
      { label: "Ženske", value: totals.women },
      { label: "Drugo/Neznano", value: totals.other + totals.unknown },
    ];
  }, [totals]);

  const dailyChartConfig = {
    users: {
      label: "Uporabniki",
      color: "hsl(var(--chart-1))",
    },
  };

  const genderChartConfig = {
    value: {
      label: "Število",
      color: "hsl(var(--chart-2))",
    },
  };

  const blockedRelations = useMemo(() => {
    const byId = new Map(profiles.map((p) => [p.id, p]));

    return profiles
      .filter((p) => !p?.is_admin)
      .filter((p) => Array.isArray(p.blocked_users) && p.blocked_users.length > 0)
      .map((p) => {
        const blocked = (p.blocked_users || []).map((id) => byId.get(id)?.display_name || id);
        return {
          id: p.id,
          blockerName: p.display_name,
          blocked,
        };
      });
  }, [profiles]);

  const bannedProfiles = useMemo(
    () => profiles.filter((p) => !p?.is_admin && Boolean(p?.is_banned)),
    [profiles]
  );

  const filteredRooms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter((room) => (room.participant_names || []).some((name) => String(name || "").toLowerCase().includes(term)));
  }, [rooms, searchTerm]);

  const handleBanProfile = async (profile, shouldBan) => {
    if (!profile?.id) return;
    const label = shouldBan ? "blokirati" : "odblokirati";
    if (!window.confirm(`Ali zelis ${label} uporabnika ${profile.display_name}?`)) return;

    try {
      await db.entities.ChatProfile.update(profile.id, {
        is_banned: shouldBan,
        is_online: shouldBan ? false : profile.is_online,
        is_typing: false,
        last_activity: new Date().toISOString(),
      });
      await loadProfilesAndSupport();
      toast.success(shouldBan ? "Uporabnik blokiran" : "Uporabnik odblokiran");
    } catch (error) {
      console.error("Error updating ban status:", error);
      toast.error("Posodobitev ni uspela");
    }
  };

  const handleDeleteRoom = async (room) => {
    if (!room?.id) return;
    if (!window.confirm("Ali zelis izbrisati ta pogovor?")) return;

    try {
      await db.entities.ChatRoom.delete(room.id);
      setSelectedRoom(null);
      setMessages([]);
      await loadRooms();
      toast.success("Pogovor izbrisan");
    } catch (error) {
      console.error("Error deleting room:", error);
      toast.error("Brisanje ni uspelo");
    }
  };

  const DEMO_FIRST_NAMES_MALE = ["Luka", "Marko", "Matej", "Jan", "David", "Peter", "Andrej", "Miha", "Tomaž", "Urban"];
  const DEMO_FIRST_NAMES_FEMALE = ["Ana", "Nina", "Sara", "Eva", "Maja", "Lara", "Nika", "Tina", "Petra", "Katja"];
  const DEMO_CITIES = ["Ljubljana", "Maribor", "Celje", "Kranj", "Koper", "Velenje", "Novo mesto", "Ptuj", "Kamnik", "Trbovlje"];
  const AVATAR_COLORS = ["#8b5cf6", "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#a855f7"];

  const createDemoUsers = async () => {
    if (demoUserCount < 1 || demoUserCount > 50) {
      toast.error("Število mora biti med 1 in 50");
      return;
    }

    setCreatingDemo(true);
    try {
      const usedNames = new Set();
      const created = [];

      for (let i = 0; i < demoUserCount; i++) {
        const isFemale = Math.random() > 0.5;
        const firstNames = isFemale ? DEMO_FIRST_NAMES_FEMALE : DEMO_FIRST_NAMES_MALE;
        let displayName;
        let attempts = 0;
        
        do {
          const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
          const number = Math.floor(Math.random() * 99) + 1;
          displayName = `${firstName}${number}`;
          attempts++;
        } while (usedNames.has(displayName) && attempts < 100);

        if (attempts >= 100) continue;
        usedNames.add(displayName);

        const profile = await db.entities.ChatProfile.create({
          display_name: displayName,
          gender: isFemale ? "Ženska" : "Moški",
          birth_year: 1990 + Math.floor(Math.random() * 15),
          country: "Slovenija",
          city: DEMO_CITIES[Math.floor(Math.random() * DEMO_CITIES.length)],
          bio: "",
          avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          avatar_url: "",
          gallery_images: [],
          is_online: true,
          last_activity: new Date().toISOString(),
          is_typing: false,
          blocked_users: [],
          is_admin: false,
          is_banned: false,
        });

        created.push(profile);
      }

      await loadProfilesAndSupport();
      toast.success(`Ustvarjenih ${created.length} demo uporabnikov`);
    } catch (error) {
      console.error("Error creating demo users:", error);
      toast.error("Napaka pri ustvarjanju demo uporabnikov");
    } finally {
      setCreatingDemo(false);
    }
  };

  const deleteDemoUsers = async () => {
    if (!window.confirm(`Ali želiš izbrisati vse demo uporabnike?`)) return;

    try {
      const allProfiles = await db.entities.ChatProfile.list("-last_activity", 2000);
      const demoProfiles = allProfiles.filter(p => 
        !p.is_admin && 
        p.display_name && 
        /^[A-Z][a-z]+\d{1,2}$/.test(p.display_name)
      );

      for (const profile of demoProfiles) {
        await db.entities.ChatProfile.delete(profile.id);
      }

      await loadProfilesAndSupport();
      toast.success(`Izbrisanih ${demoProfiles.length} demo uporabnikov`);
    } catch (error) {
      console.error("Error deleting demo users:", error);
      toast.error("Napaka pri brisanju");
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" : "bg-gradient-to-br from-violet-50 via-white to-indigo-50"} p-4`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            {typeof onExit === "function" && (
              <Button variant="ghost" size="icon" onClick={onExit} className="rounded-xl">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Admin portal</h1>
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Prijavljen kot: {adminProfile?.display_name || "Admin"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className={`rounded-xl ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button onClick={onLogout} variant="ghost" className={`rounded-xl gap-2 ${darkMode ? "text-gray-300 hover:text-red-300" : "text-gray-600 hover:text-red-600"}`}>
              <LogOut className="w-4 h-4" />
              Odjava
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mb-4">
          <TabsList className={`${darkMode ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-100"} backdrop-blur border rounded-xl p-1 w-full`}>
            <TabsTrigger value="active" className={`flex-1 rounded-lg gap-1.5 text-xs ${darkMode ? "data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300" : "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700"}`}>
              <Users className="w-4 h-4" />
              Aktivni uporabniki
            </TabsTrigger>
            <TabsTrigger value="complaints" className={`flex-1 rounded-lg gap-1.5 text-xs ${darkMode ? "data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300" : "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700"}`}>
              <AlertTriangle className="w-4 h-4" />
              Pritožbe
            </TabsTrigger>
            <TabsTrigger value="blocked" className={`flex-1 rounded-lg gap-1.5 text-xs ${darkMode ? "data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300" : "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700"}`}>
              <Ban className="w-4 h-4" />
              Blokirani
            </TabsTrigger>
            <TabsTrigger value="messages" className={`flex-1 rounded-lg gap-1.5 text-xs ${darkMode ? "data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300" : "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700"}`}>
              <MessageSquare className="w-4 h-4" />
              Sporočila
            </TabsTrigger>
            <TabsTrigger value="logins" className={`flex-1 rounded-lg gap-1.5 text-xs ${darkMode ? "data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300" : "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700"}`}>
              <Shield className="w-4 h-4" />
              Prijave
            </TabsTrigger>
            <TabsTrigger value="demo" className={`flex-1 rounded-lg gap-1.5 text-xs ${darkMode ? "data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300" : "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700"}`}>
              <Users className="w-4 h-4" />
              Demo
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <AnimatePresence mode="wait">
          {tab === "active" && (
            <motion.div key="active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Skupno uporabnikov</div>
                  <div className={`text-2xl font-bold mt-1 ${darkMode ? "text-white" : "text-gray-900"}`}>{totals.total}</div>
                </div>
                <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Aktivni zdaj</div>
                  <div className={`text-2xl font-bold mt-1 ${darkMode ? "text-white" : "text-gray-900"}`}>{totals.onlineNow}</div>
                </div>
                <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Ženske</div>
                  <div className={`text-2xl font-bold mt-1 ${darkMode ? "text-white" : "text-gray-900"}`}>{totals.women}</div>
                </div>
                <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Moški</div>
                  <div className={`text-2xl font-bold mt-1 ${darkMode ? "text-white" : "text-gray-900"}`}>{totals.men}</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>Dnevni uporabniki (zadnjih 14 dni)</h2>
                    <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>po zadnji aktivnosti</div>
                  </div>
                  <ChartContainer id="daily-users" className="h-[220px] w-full aspect-auto" config={dailyChartConfig}>
                    <BarChart data={dailyUsersSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} interval={1} tickMargin={8} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="users" fill="var(--color-users)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>

                <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>Spol</h2>
                    <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>razmerje</div>
                  </div>
                  <ChartContainer id="gender" className="h-[220px] w-full aspect-auto" config={genderChartConfig}>
                    <BarChart data={genderSeries} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={110} />
                      <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="value" name="Število" fill="var(--color-value)" radius={[6, 6, 6, 6]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>Trenutno aktivni</h2>
                  <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{activeUsers.length} uporabnikov</div>
                </div>

                <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
                  {activeUsers.length === 0 ? (
                    <div className={`text-center py-10 text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Ni aktivnih uporabnikov</div>
                  ) : (
                    activeUsers.map((u) => (
                      <div key={u.id} className={`p-3 rounded-xl border ${darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>{u.display_name}</div>
                            <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                              {u.gender ? `${u.gender}` : ""}
                              {getAge(u.birth_year) !== null ? ` • ${getAge(u.birth_year)} let` : ""}
                              {u.country ? ` • ${u.country}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                              {u.last_activity ? new Date(u.last_activity).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className={`rounded-xl ${darkMode ? "border-gray-700 text-red-300 hover:bg-gray-800" : "text-red-600 hover:bg-red-50"}`}
                              onClick={() => handleBanProfile(u, true)}
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              Blokiraj
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === "complaints" && (
            <motion.div key="complaints" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>Pritožbe / sporočila</h2>
                  <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{supportMessages.length} zapisov</div>
                </div>

                <div className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto">
                  {supportMessages.length === 0 ? (
                    <div className={`text-center py-10 text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Ni pritožb</div>
                  ) : (
                    supportMessages.map((m) => (
                      <div key={m.id} className={`p-4 rounded-xl border ${darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>{m.subject || "(brez zadeve)"}</div>
                            <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                              {m.sender_name || "Neznan"}{m.type ? ` • ${m.type}` : ""}
                            </div>
                          </div>
                          <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                            {m.created_date ? new Date(m.created_date).toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                          </div>
                        </div>
                        {m.message && (
                          <div className={`text-sm mt-3 whitespace-pre-wrap ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{m.message}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === "blocked" && (
            <motion.div key="blocked" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>Blokirani uporabniki</h2>
                  <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{bannedProfiles.length} blokiranih</div>
                </div>

                <div className="space-y-3 mb-6">
                  {bannedProfiles.length === 0 ? (
                    <div className={`text-center py-6 text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Ni blokiranih uporabnikov</div>
                  ) : (
                    bannedProfiles.map((p) => (
                      <div key={p.id} className={`p-4 rounded-xl border ${darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>{p.display_name}</div>
                            <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                              {p.gender ? `${p.gender}` : ""}
                              {getAge(p.birth_year) !== null ? ` • ${getAge(p.birth_year)} let` : ""}
                              {p.city ? ` • ${p.city}` : ""}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`rounded-xl ${darkMode ? "border-gray-700 text-emerald-300 hover:bg-gray-800" : "text-emerald-600 hover:bg-emerald-50"}`}
                            onClick={() => handleBanProfile(p, false)}
                          >
                            Odblokiraj
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h2 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>Blokirane povezave</h2>
                  <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{blockedRelations.length} uporabnikov blokira</div>
                </div>

                <div className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto">
                  {blockedRelations.length === 0 ? (
                    <div className={`text-center py-10 text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Ni blokiranih povezav</div>
                  ) : (
                    blockedRelations.map((rel) => (
                      <div key={rel.id} className={`p-4 rounded-xl border ${darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                        <div className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>{rel.blockerName}</div>
                        <div className={`text-xs mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                          Blokira: {rel.blocked.join(", ")}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === "messages" && (
            <motion.div key="messages" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="grid md:grid-cols-3 gap-4">
                <div className={`md:col-span-1 rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className="mb-4">
                    <div className="relative">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? "text-gray-500" : "text-gray-400"}`} />
                      <Input
                        placeholder="Išči po imenu..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`pl-10 h-10 rounded-lg ${darkMode ? "bg-gray-900 border-gray-600 text-white" : "border-gray-200"}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {filteredRooms.length === 0 ? (
                      <div className={`text-center py-8 text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Ni pogovorov</div>
                    ) : (
                      filteredRooms.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedRoom?.id === room.id
                              ? darkMode
                                ? "bg-violet-900/50"
                                : "bg-violet-50"
                              : darkMode
                                ? "hover:bg-gray-700"
                                : "hover:bg-gray-50"
                          }`}
                        >
                          <div className={`font-medium text-sm ${darkMode ? "text-white" : "text-gray-900"} mb-1`}>
                            {room.participant_names?.join(" & ") || "Neznan pogovor"}
                          </div>
                          <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"} truncate`}>
                            {room.last_message || "Ni sporočil"}
                          </div>
                          <div className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"} mt-1`}>
                            {room.updated_date ? new Date(room.updated_date).toLocaleDateString("sl-SI") : ""}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className={`md:col-span-2 rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  {!selectedRoom ? (
                    <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)]">
                      <MessageSquare className={`w-12 h-12 mb-3 ${darkMode ? "text-gray-600" : "text-gray-300"}`} />
                      <p className={`text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Izberi pogovor za ogled sporočil</p>
                    </div>
                  ) : (
                    <>
                      <div className={`pb-3 mb-4 border-b ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                              {selectedRoom.participant_names?.join(" & ")}
                            </h3>
                            <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"} mt-1`}>{messages.length} sporočil</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`rounded-xl ${darkMode ? "border-gray-700 text-red-300 hover:bg-gray-800" : "text-red-600 hover:bg-red-50"}`}
                            onClick={() => handleDeleteRoom(selectedRoom)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Izbrisi pogovor
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3 max-h-[calc(100vh-370px)] overflow-y-auto">
                        <AnimatePresence>
                          {messages.map((msg) => (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-3 rounded-xl ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className={`text-sm font-medium ${darkMode ? "text-violet-400" : "text-violet-600"}`}>{msg.sender_name}</span>
                                <span className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                                  {msg.created_date
                                    ? new Date(msg.created_date).toLocaleString("sl-SI", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : ""}
                                </span>
                              </div>
                              {msg.content && <p className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{msg.content}</p>}
                              {msg.image_url && (
                                <img src={msg.image_url} alt="Slika" className="mt-2 rounded-lg max-w-xs max-h-48 object-cover" />
                              )}
                              {msg.file_url && (
                                <a
                                  href={msg.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-2 mt-2 text-xs ${darkMode ? "text-violet-400 hover:text-violet-300" : "text-violet-600 hover:text-violet-700"}`}
                                >
                                  📎 {msg.file_name || "Datoteka"}
                                </a>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === "logins" && (
            <motion.div key="logins" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>Zgodovina prijav</h2>
                  <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{loginEvents.length} zapisov</div>
                </div>

                <div className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto">
                  {loginEvents.length === 0 ? (
                    <div className={`text-center py-10 text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                      Ni prijav
                    </div>
                  ) : (
                    loginEvents.map((ev) => (
                      <div key={ev.id} className={`p-4 rounded-xl border ${darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                              {ev.display_name || "(brez imena)"}
                            </div>
                            <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                              {ev.auth_provider ? `provider: ${ev.auth_provider}` : ""}
                              {ev.email ? ` • ${ev.email}` : ""}
                            </div>
                            <div className={`text-xs mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                              IP: {ev.ip || "unknown"}
                            </div>
                          </div>
                          <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                            {ev.created_date ? new Date(ev.created_date).toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === "demo" && (
            <motion.div key="demo" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className={`rounded-2xl border p-6 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                <h2 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-900"}`}>Upravljanje demo uporabnikov</h2>
                
                <div className="space-y-6">
                  <div>
                    <p className={`text-sm mb-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      Ustvari testne uporabnike za preizkušanje sistema. Demo uporabniki bodo vedno prikazani kot online.
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <div>
                        <label className={`text-sm font-medium block mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                          Število uporabnikov (1-50)
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={demoUserCount}
                          onChange={(e) => setDemoUserCount(parseInt(e.target.value) || 3)}
                          className={`w-32 ${darkMode ? "bg-gray-900 border-gray-600 text-white" : ""}`}
                        />
                      </div>
                      
                      <Button
                        onClick={createDemoUsers}
                        disabled={creatingDemo}
                        className="mt-7 bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        {creatingDemo ? "Ustvarjam..." : "Ustvari demo uporabnike"}
                      </Button>
                    </div>
                  </div>

                  <div className={`border-t pt-6 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <h3 className={`text-sm font-medium mb-2 ${darkMode ? "text-white" : "text-gray-900"}`}>
                      Obstoječi demo uporabniki
                    </h3>
                    <p className={`text-sm mb-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      Skupno demo uporabnikov: {profiles.filter(p => !p.is_admin && p.display_name && /^[A-Z][a-z]+\d{1,2}$/.test(p.display_name)).length}
                    </p>
                    
                    <Button
                      onClick={deleteDemoUsers}
                      variant="outline"
                      className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Izbriši vse demo uporabnike
                    </Button>
                  </div>

                  <div className={`border-t pt-6 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <h3 className={`text-sm font-medium mb-2 ${darkMode ? "text-white" : "text-gray-900"}`}>
                      Primer imen
                    </h3>
                    <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                      Moški: Luka12, Marko5, Matej88, Jan34, David7<br/>
                      Ženske: Ana23, Nina45, Sara9, Eva61, Maja15
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
