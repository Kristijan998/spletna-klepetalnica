import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MessageSquare, Moon, Search, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPageUrl } from "@/utils";
import { useTheme } from "@/hooks/use-theme";

export default function ChatDashboard() {
  const { isDark, toggleTheme } = useTheme();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const darkMode = isDark;

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom.id);
      const interval = setInterval(() => loadMessages(selectedRoom.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedRoom]);

  const loadRooms = async () => {
    try {
      const allRooms = await db.entities.ChatRoom.list("-updated_date", 100);
      setRooms(allRooms);
    } catch (error) {
      console.error("Error loading rooms:", error);
    }
    setLoading(false);
  };

  const loadMessages = async (roomId) => {
    try {
      const msgs = await db.entities.ChatMessage.filter(
        { room_id: roomId },
        "created_date",
        200
      );
      setMessages(msgs);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.participant_names?.some(name => 
      name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Nalaganje...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" : "bg-gradient-to-br from-violet-50 via-white to-indigo-50"} p-4`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.href = createPageUrl("Home")}
            aria-label="Nazaj"
            className="rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Pregled pogovorov</h1>
            <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{rooms.length} aktivnih sob</p>
          </div>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={darkMode ? "Vklopi svetli način" : "Vklopi temni način"}
              className="rounded-xl"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Rooms List */}
          <div className={`md:col-span-1 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl border p-4`}>
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

            <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
              {filteredRooms.length === 0 ? (
                <div className={`text-center py-8 text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                  Ni pogovorov
                </div>
              ) : (
                filteredRooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedRoom?.id === room.id
                        ? darkMode ? "bg-violet-900/50" : "bg-violet-50"
                        : darkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className={`font-medium text-sm ${darkMode ? "text-white" : "text-gray-900"} mb-1`}>
                      {room.participant_names?.join(" & ") || "Neznan pogovor"}
                    </div>
                    <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"} truncate`}>
                      {room.last_message || "Ni sporočil"}
                    </div>
                    <div className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"} mt-1`}>
                      {new Date(room.updated_date).toLocaleDateString("sl-SI")}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Messages View */}
          <div className={`md:col-span-2 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl border p-4`}>
            {!selectedRoom ? (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)]">
                <MessageSquare className={`w-12 h-12 mb-3 ${darkMode ? "text-gray-600" : "text-gray-300"}`} />
                <p className={`text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                  Izberi pogovor za ogled sporočil
                </p>
              </div>
            ) : (
              <>
                <div className={`pb-3 mb-4 border-b ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
                  <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    {selectedRoom.participant_names?.join(" & ")}
                  </h3>
                  <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"} mt-1`}>
                    {messages.length} sporočil
                  </p>
                </div>

                <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto">
                  <AnimatePresence>
                    {messages.map(msg => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-xl ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className={`text-sm font-medium ${darkMode ? "text-violet-400" : "text-violet-600"}`}>
                            {msg.sender_name}
                          </span>
                          <span className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                            {new Date(msg.created_date).toLocaleString("sl-SI", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        {msg.content && (
                          <p className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                            {msg.content}
                          </p>
                        )}
                        {msg.image_url && (
                          <img 
                            src={msg.image_url} 
                            alt="Slika" 
                            className="mt-2 rounded-lg max-w-xs max-h-48 object-cover"
                          />
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
      </div>
    </div>
  );
}
