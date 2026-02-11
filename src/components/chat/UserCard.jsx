import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { t } from "@/components/utils/translations";
import UserActions from "./UserActions";

const genderEmoji = {
  "moški": "👨",
  "ženska": "👩",
  "drugo": "🧑"
};


function getGenderAvatarColor(gender, fallback) {
  const normalized = String(gender || "").trim().toLocaleLowerCase("sl");
  if (normalized === "moški" || normalized === "moski") return "#3b82f6";
  if (normalized === "ženska" || normalized === "zenska") return "#ec4899";
  return fallback || "#8b5cf6";
}

export default function UserCard({ profile, onStartChat, isCurrentUser, isOnline = false, language = "sl", myProfile = null, unreadCount = 0 }) {
  const currentYear = new Date().getFullYear();
  const birthYear = Number(profile.birth_year);
  const age = Number.isFinite(birthYear) && birthYear >= 1900 && birthYear <= currentYear
    ? currentYear - birthYear
    : null;
  const darkMode = document.documentElement.classList.contains("dark");
  const canStartChat = !isCurrentUser && typeof onStartChat === "function";
  const startChat = () => {
    if (canStartChat) onStartChat(profile);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={canStartChat ? startChat : undefined}
      onKeyDown={canStartChat ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startChat();
        }
      } : undefined}
      role={canStartChat ? "button" : undefined}
      tabIndex={canStartChat ? 0 : undefined}
      className={`group relative ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl border p-4 ${darkMode ? "hover:shadow-lg hover:shadow-violet-900/30" : "hover:shadow-lg hover:shadow-violet-100/30"} transition-all duration-300 ${canStartChat ? "cursor-pointer" : ""}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          {profile.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt={profile.display_name}
              className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div
              className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-base sm:text-xl font-bold text-white shrink-0"
              style={{ backgroundColor: getGenderAvatarColor(profile.gender, profile.avatar_color) }}
            >
              {profile.display_name?.[0]?.toUpperCase() || "?"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"} truncate`}>{profile.display_name}</h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span>{unreadCount > 9 ? "9+" : unreadCount}</span>
                </span>
              )}
              {isCurrentUser && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">{t("users.you", language)}</span>
              )}
            </div>
            <div className={`flex flex-wrap items-center gap-2 mt-1 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              <span>{genderEmoji[profile.gender] || "🧑"}</span>
              {age !== null && (
                <span>{age} {t("users.years", language)}</span>
              )}
              <span className={`${isOnline ? "text-green-600" : (darkMode ? "text-gray-500" : "text-gray-400")} text-xs font-medium`}>
                {isOnline ? t("users.available", language) : t("users.offline", language)}
              </span>
            </div>
            {(profile.city || profile.country) && (
              <div className={`flex items-center gap-1.5 mt-1 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                <span>📍</span>
                <span className="truncate">
                  {profile.city}{profile.city && profile.country ? ", " : ""}{profile.country}
                </span>
              </div>
            )}
            {profile.bio && (
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} mt-2 line-clamp-2`}>{profile.bio}</p>
            )}
            {profile.gallery_images?.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {profile.gallery_images.slice(0, 3).map((img, i) => (
                  <img 
                    key={i}
                    src={img} 
                    alt={`Slika ${i + 1}`}
                    loading="lazy"
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover"
                  />
                ))}
                {profile.gallery_images.length > 3 && (
                  <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-xs font-medium ${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                    +{profile.gallery_images.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!isCurrentUser && (
          <div className="flex flex-row sm:flex-col gap-2 sm:gap-2 mt-2 sm:mt-0 sm:ml-auto shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                startChat();
              }}
              size="sm"
              className="rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 border-0 w-full sm:w-auto"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              {t("users.chat", language)}
            </Button>
            {myProfile && <UserActions targetProfile={profile} myProfile={myProfile} language={language} />}
          </div>
        )}
      </div>
    </motion.div>
  );
}