import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Users } from "lucide-react";
import { motion } from "framer-motion";

function getGenderAvatarColor(gender, fallback) {
  const normalized = String(gender || "").trim().toLocaleLowerCase("sl");
  if (normalized === "moški" || normalized === "moski") return "#3b82f6";
  if (normalized === "ženska" || normalized === "zenska") return "#ec4899";
  return fallback || "#8b5cf6";
}

export default function GroupMembers({ group, language = "sl" }) {
  const darkMode = document.documentElement.classList.contains("dark");
  const currentYear = new Date().getFullYear();
  const getAge = (birthYear) => {
    const year = Number(birthYear);
    if (!Number.isFinite(year)) return null;
    if (year < 1900 || year > currentYear) return null;
    return currentYear - year;
  };
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMembers = async () => {
    if (!group.member_ids || group.member_ids.length === 0) return;
    
    setLoading(true);
    try {
      const allProfiles = await db.entities.ChatProfile.list("-created_date", 200);
      const memberProfiles = allProfiles.filter(p => group.member_ids.includes(p.id));
      setMembers(memberProfiles);
    } catch (error) {
      console.error("Error loading members:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (showMembers) {
      loadMembers();
    }
  }, [showMembers, group.id]);

  return (
    <>
      <Button
        onClick={() => setShowMembers(true)}
        variant="ghost"
        size="sm"
        className="gap-2"
      >
        <Users className="w-4 h-4" />
        {group.member_count || 0} {language === "sl" ? "članov" : "members"}
      </Button>

      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className={`max-w-md ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white"}`}>
          <DialogHeader>
            <DialogTitle className={darkMode ? "text-white" : "text-gray-900"}>
              {language === "sl" ? "Člani skupine" : "Group members"}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
            {loading ? (
              <div className={`text-center py-8 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                {language === "sl" ? "Nalaganje..." : "Loading..."}
              </div>
            ) : members.length === 0 ? (
              <div className={`text-center py-8 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                {language === "sl" ? "Ni članov" : "No members"}
              </div>
            ) : (
              members.map((member) => {
                const age = getAge(member.birth_year);
                return (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}
                  >
                    {member.avatar_url ? (
                      <img 
                        src={member.avatar_url} 
                        alt={member.display_name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: getGenderAvatarColor(member.gender, member.avatar_color) }}
                      >
                        {member.display_name?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className={`font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                        {member.display_name}
                      </h4>
                      <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {age !== null ? `${age} ${language === "sl" ? "let" : "years old"}` : ""}
                        {member.city ? ` • ${member.city}` : ""}
                      </p>
                    </div>
                    {member.is_online && (
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}