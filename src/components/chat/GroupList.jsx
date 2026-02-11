import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Users, Plus, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { t } from "@/components/utils/translations";

const AVATAR_COLORS = [
  "#8b5cf6", "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#a855f7"
];

function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export default function GroupList({ groups, myProfile, onlineUsers, unreadByGroupId = {}, onCreateGroup, onJoinGroup, onOpenGroup, onDeleteGroup, language = "sl" }) {
  const darkMode = document.documentElement.classList.contains("dark");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: ""
  });

  const handleCardClick = (group) => {
    const isMember = group.member_ids?.includes(myProfile.id);
    if (isMember) {
      onOpenGroup(group);
    } else {
      onJoinGroup(group);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(language === "sl" ? "Vnesi ime skupine" : "Enter group name");
      return;
    }
    
    try {
      await onCreateGroup({
        ...form,
        avatar_color: getRandomColor()
      });
      
      setForm({ name: "", description: "" });
      setShowCreate(false);
    } catch (error) {
      console.error("Group create error:", error);
      toast.error(language === "sl" ? "Napaka pri ustvarjanju skupine" : "Error creating group");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
          {t("groups.title", language)} ({groups.length})
        </h3>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl bg-violet-600 hover:bg-violet-700 gap-2">
              <Plus className="w-4 h-4" />
              {t("groups.new", language)}
            </Button>
          </DialogTrigger>
          <DialogContent className={darkMode ? "bg-gray-800 border-gray-700" : "bg-white"}>
            <DialogHeader>
              <DialogTitle className={darkMode ? "text-white" : "text-gray-900"}>
                {t("groups.create", language)}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <Input
                  placeholder={t("groups.name", language)}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${darkMode ? "bg-gray-900 border-gray-600 text-white" : ""}`}
                  maxLength={50}
                />
              </div>
              <div>
                <Textarea
                  placeholder={`${t("groups.description", language)} ${t("groups.descOptional", language)}`}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${darkMode ? "bg-gray-900 border-gray-600 text-white" : ""}`}
                  rows={3}
                  maxLength={200}
                />
              </div>
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700">
                {t("groups.submit", language)}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <div className={`text-center py-12 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
          <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t("groups.none", language)}</p>
          <p className="text-xs mt-1">{t("groups.createFirst", language)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const isMember = group.member_ids?.includes(myProfile.id);
            const isCreator = group.creator_profile_id === myProfile.id;
            const activeInGroup = (group.member_ids || []).filter(memberId => 
              onlineUsers.some(u => u.id === memberId) || memberId === myProfile.id
            ).length;
            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleCardClick(group)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(group);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`group ${darkMode ? "bg-gray-800 border-gray-700 hover:shadow-violet-900/30" : "bg-white border-gray-100 hover:shadow-violet-100/30"} rounded-2xl border p-2 sm:p-2.5 hover:shadow-lg transition-all cursor-pointer`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                        style={{ backgroundColor: group.avatar_color || "#8b5cf6" }}
                      >
                        <Users className="w-5 h-5 sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start gap-2">
                          <h4 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"} truncate text-sm sm:text-base`}>
                            {group.name}
                          </h4>
                          {unreadByGroupId[group.id] > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                              <span className="h-2 w-2 rounded-full bg-red-500" />
                              <span>{unreadByGroupId[group.id] > 9 ? "9+" : unreadByGroupId[group.id]}</span>
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"} mt-0.5 line-clamp-1`}>
                            {group.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                      <Users className="w-3 h-3" />
                      <span>{group.member_count || 0} {t("groups.members", language)}</span>
                      <span className="text-green-600 font-medium">{activeInGroup} {language === "sl" ? "aktivnih" : "active"}</span>
                      <span>{t("groups.createdBy", language)} {group.creator_name}</span>
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col justify-center gap-2">
                    {isMember ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenGroup(group);
                        }}
                        size="sm"
                        className="rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 border-0"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {t("groups.open", language)}
                      </Button>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJoinGroup(group);
                        }}
                        size="sm"
                        className="rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 border-0"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {t("groups.join", language)}
                      </Button>
                    )}
                    {isCreator && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGroup(group.id);
                        }}
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-row sm:hidden gap-2">
                    {isMember ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenGroup(group);
                        }}
                        size="sm"
                        className="rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 border-0 w-full"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {t("groups.open", language)}
                      </Button>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJoinGroup(group);
                        }}
                        size="sm"
                        className="rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 border-0 w-full"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {t("groups.join", language)}
                      </Button>
                    )}
                    {isCreator && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGroup(group.id);
                        }}
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 w-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}