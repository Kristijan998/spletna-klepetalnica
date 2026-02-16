import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, MapPin } from "lucide-react";
import { t } from "@/components/utils/translations";

const genderEmoji = {
  "moski": "👨",
  "moški": "👨",
  "zenska": "👩",
  "ženska": "👩",
  "drugo": "🧑",
};

function getGenderAvatarColor(gender, fallback) {
  const normalized = String(gender || "").trim().toLocaleLowerCase("sl");
  if (normalized === "moski" || normalized === "moški") return "#3b82f6";
  if (normalized === "zenska" || normalized === "ženska") return "#ec4899";
  return fallback || "#8b5cf6";
}

export default function UserCard({
  profile,
  onStartChat,
  isCurrentUser,
  isOnline = false,
  language = "sl",
  unreadCount = 0,
}) {
  const currentYear = new Date().getFullYear();
  const birthYear = Number(profile.birth_year);
  const age = Number.isFinite(birthYear) && birthYear >= 1900 && birthYear <= currentYear
    ? currentYear - birthYear
    : null;
  const darkMode = document.documentElement.classList.contains("dark");
  const canStartChat = !isCurrentUser && typeof onStartChat === "function";
  const normalizedGender = String(profile.gender || "").trim().toLocaleLowerCase("sl");
  const genderIcon = genderEmoji[normalizedGender] || "🧑";

  const startChat = () => {
    if (canStartChat) onStartChat(profile);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={canStartChat ? startChat : undefined}
      onKeyDown={
        canStartChat
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                startChat();
              }
            }
          : undefined
      }
      role={canStartChat ? "button" : undefined}
      tabIndex={canStartChat ? 0 : undefined}
      className={`group relative rounded-2xl border p-4 transition-all duration-200 ${
        darkMode
          ? "bg-gray-800/90 border-gray-700/80 hover:border-violet-500/40"
          : "bg-white border-gray-200 hover:border-violet-300"
      } ${canStartChat ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-base sm:text-xl font-bold text-white shrink-0"
              style={{ backgroundColor: getGenderAvatarColor(profile.gender, profile.avatar_color) }}
            >
              {profile.display_name?.[0]?.toUpperCase() || "?"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className={`font-semibold truncate text-[15px] ${darkMode ? "text-white" : "text-gray-900"}`}>
                {profile.display_name}
              </h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span>{unreadCount > 9 ? "9+" : unreadCount}</span>
                </span>
              )}
              {isCurrentUser && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
                  {t("users.you", language)}
                </span>
              )}
            </div>

            <div className={`flex flex-wrap items-center gap-2 mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              <span className="text-sm leading-none">{genderIcon}</span>
              {age !== null && <span className="text-sm">{age} {t("users.years", language)}</span>}
              {age !== null && <span className={darkMode ? "text-gray-500 text-xs" : "text-gray-400 text-xs"}>•</span>}
              <span className={`${isOnline ? "text-green-500" : darkMode ? "text-gray-500" : "text-gray-400"} text-xs font-medium`}>
                {isOnline ? t("users.available", language) : t("users.offline", language)}
              </span>
            </div>

            {(profile.city || profile.country) && (
              <div className={`flex items-center gap-1.5 mt-1 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                <MapPin className="w-3 h-3" />
                <span className="truncate">
                  {profile.city}
                  {profile.city && profile.country ? ", " : ""}
                  {profile.country}
                </span>
              </div>
            )}
          </div>
        </div>

        {!isCurrentUser && (
          <div className="ml-2 shrink-0">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                startChat();
              }}
              size="sm"
              className="rounded-xl px-4 h-9 border-0 bg-violet-100 text-violet-700 hover:bg-violet-200"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              {t("users.chat", language)}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
