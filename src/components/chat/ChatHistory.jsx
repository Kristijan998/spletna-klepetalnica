import React from "react";
import { motion } from "framer-motion";
import { MessageCircle, Clock } from "lucide-react";
import { t } from "@/components/utils/translations";

export default function ChatHistory({ rooms, myProfileId, onOpenRoom, language = 'sl' }) {
  const darkMode = document.documentElement.classList.contains("dark");
  const filteredRooms = (rooms || []).filter((room) => {
    const last = String(room?.last_message || "").trim();
    return Boolean(last);
  });

  if (filteredRooms.length === 0) {
    return (
      <div className={`text-center py-16 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
        <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">{t('history.none', language)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredRooms.map((room) => {
        const partnerName = room.participant_names?.find(
          (_, i) => room.participant_ids[i] !== myProfileId
        ) || "Neznano";

        return (
          <motion.button
            key={room.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onOpenRoom(room)}
            className={`w-full text-left ${darkMode ? "bg-gray-800 border-gray-700 hover:shadow-violet-900/30" : "bg-white border-gray-100 hover:shadow-violet-100/30"} rounded-2xl border p-4 hover:shadow-md transition-all group`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {partnerName[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"} text-sm`}>{partnerName}</h4>
                  <div className={`flex items-center gap-1 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">
                      {new Date(room.updated_date).toLocaleDateString("sl-SI")}
                    </span>
                  </div>
                </div>
                {room.last_message && (
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} truncate mt-0.5`}>{room.last_message}</p>
                )}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}