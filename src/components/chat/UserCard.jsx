import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, MapPin } from "lucide-react";
import { t } from "@/components/utils/translations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const currentYear = new Date().getFullYear();
  const birthYear = Number(profile.birth_year);
  const age = Number.isFinite(birthYear) && birthYear >= 1900 && birthYear <= currentYear
    ? currentYear - birthYear
    : null;

  const darkMode = document.documentElement.classList.contains("dark");
  const canStartChat = !isCurrentUser && typeof onStartChat === "function";
  const normalizedGender = String(profile.gender || "").trim().toLocaleLowerCase("sl");
  const genderIcon = genderEmoji[normalizedGender] || "🧑";

  const profileImages = useMemo(() => {
    const avatar = profile?.avatar_url ? [profile.avatar_url] : [];
    const gallery = Array.isArray(profile?.gallery_images) ? profile.gallery_images.filter(Boolean) : [];
    return Array.from(new Set([...avatar, ...gallery]));
  }, [profile?.avatar_url, profile?.gallery_images]);

  const startChat = () => {
    if (canStartChat) onStartChat(profile);
  };

  const openProfileGallery = (e) => {
    e?.stopPropagation?.();
    setSelectedImageIndex(0);
    setShowProfileModal(true);
  };

  const hasMultipleImages = profileImages.length > 1;

  return (
    <>
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
            <button
              type="button"
              onClick={openProfileGallery}
              className="relative shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              title={language === "sl" ? "Ogled profila" : "View profile"}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover"
                />
              ) : (
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-base sm:text-xl font-bold text-white"
                  style={{ backgroundColor: getGenderAvatarColor(profile.gender, profile.avatar_color) }}
                >
                  {profile.display_name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              {hasMultipleImages && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-violet-600 text-white text-[10px] px-1.5 py-0.5 leading-none">
                  {profileImages.length}
                </span>
              )}
            </button>

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

      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className={`${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"} max-w-lg`}>
          <DialogHeader>
            <DialogTitle className={darkMode ? "text-white" : "text-gray-900"}>
              {profile.display_name}
            </DialogTitle>
          </DialogHeader>

          {profileImages.length > 0 ? (
            <div className="space-y-3">
              <img
                src={profileImages[selectedImageIndex]}
                alt={`${profile.display_name} ${selectedImageIndex + 1}`}
                className="w-full max-h-[50vh] object-cover rounded-xl"
              />

              {profileImages.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {profileImages.map((img, idx) => (
                    <button
                      key={`${img}-${idx}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`rounded-lg overflow-hidden border ${
                        idx === selectedImageIndex
                          ? "border-violet-500"
                          : darkMode
                            ? "border-gray-700"
                            : "border-gray-200"
                      }`}
                    >
                      <img src={img} alt={`${profile.display_name} thumb ${idx + 1}`} className="w-full h-12 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {language === "sl" ? "Uporabnik nima dodanih slik." : "This user has no uploaded photos."}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
