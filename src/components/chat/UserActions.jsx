import React, { useState } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Ban } from "lucide-react";

export default function UserActions({ targetProfile, myProfile, language = "sl" }) {
  const darkMode = document.documentElement.classList.contains("dark");
  const [showReport, setShowReport] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [sending, setSending] = useState(false);

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    
    setSending(true);
    try {
      await db.entities.SupportMessage.create({
        sender_profile_id: myProfile.id,
        sender_name: myProfile.display_name,
        subject: `${language === "sl" ? "Prijava uporabnika" : "Report user"}: ${targetProfile.display_name}`,
        message: reportReason,
        type: "težava"
      });
      setShowReport(false);
      setReportReason("");
      alert(language === "sl" ? "Prijava poslana" : "Report sent");
    } catch (error) {
      alert(language === "sl" ? "Napaka pri pošiljanju" : "Error sending report");
    }
    setSending(false);
  };

  const handleBlock = async () => {
    setSending(true);
    try {
      // Create blocked user record
      const existingBlocks = await db.entities.ChatProfile.filter({ id: myProfile.id });
      if (existingBlocks.length > 0) {
        const currentProfile = existingBlocks[0];
        const blockedUsers = currentProfile.blocked_users || [];
        if (!blockedUsers.includes(targetProfile.id)) {
          await db.entities.ChatProfile.update(myProfile.id, {
            blocked_users: [...blockedUsers, targetProfile.id]
          });
        }
      }
      setShowBlock(false);
      alert(language === "sl" ? "Uporabnik blokiran" : "User blocked");
      window.location.reload();
    } catch (error) {
      alert(language === "sl" ? "Napaka pri blokiranju" : "Error blocking user");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={() => setShowReport(true)}
        variant="outline"
        size="sm"
        className={`rounded-xl gap-2 ${darkMode ? "border-gray-600 text-gray-300" : ""}`}
      >
        <AlertTriangle className="w-4 h-4" />
        {language === "sl" ? "Prijavi" : "Report"}
      </Button>

      <Button
        onClick={() => setShowBlock(true)}
        variant="outline"
        size="sm"
        className={`rounded-xl gap-2 ${darkMode ? "border-gray-600 text-gray-300" : ""}`}
      >
        <Ban className="w-4 h-4" />
        {language === "sl" ? "Blokiraj" : "Block"}
      </Button>

      {/* Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className={darkMode ? "bg-gray-800 border-gray-700" : "bg-white"}>
          <DialogHeader>
            <DialogTitle className={darkMode ? "text-white" : "text-gray-900"}>
              {language === "sl" ? `Prijavi uporabnika ${targetProfile.display_name}` : `Report ${targetProfile.display_name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                {language === "sl" ? "Razlog prijave" : "Reason for report"}
              </Label>
              <Textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder={language === "sl" ? "Opiši problem..." : "Describe the issue..."}
                className={`mt-2 ${darkMode ? "bg-gray-900 border-gray-600 text-white" : ""}`}
                rows={4}
                maxLength={500}
              />
            </div>
            <Button
              onClick={handleReport}
              disabled={!reportReason.trim() || sending}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {sending ? (language === "sl" ? "Pošiljam..." : "Sending...") : (language === "sl" ? "Pošlji prijavo" : "Send report")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block Dialog */}
      <Dialog open={showBlock} onOpenChange={setShowBlock}>
        <DialogContent className={darkMode ? "bg-gray-800 border-gray-700" : "bg-white"}>
          <DialogHeader>
            <DialogTitle className={darkMode ? "text-white" : "text-gray-900"}>
              {language === "sl" ? `Blokiraj ${targetProfile.display_name}?` : `Block ${targetProfile.display_name}?`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
              {language === "sl" 
                ? "Blokiran uporabnik te ne bo mogel kontaktirati in ga ne boš videl na seznamu."
                : "Blocked user won't be able to contact you and you won't see them in the list."}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowBlock(false)}
                variant="outline"
                className="flex-1"
              >
                {language === "sl" ? "Prekliči" : "Cancel"}
              </Button>
              <Button
                onClick={handleBlock}
                disabled={sending}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {sending ? (language === "sl" ? "Blokiram..." : "Blocking...") : (language === "sl" ? "Blokiraj" : "Block")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}