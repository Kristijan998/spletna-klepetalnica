import React, { useState } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { t } from "@/components/utils/translations";

export default function SupportForm({ myProfile, onBack, language = "sl" }) {
  const darkMode = document.documentElement.classList.contains("dark");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    message: "",
    type: "predlog"
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;

    setSending(true);
    try {
      await db.entities.SupportMessage.create({
        sender_profile_id: myProfile.id,
        sender_name: myProfile.display_name,
        subject: form.subject,
        message: form.message,
        type: form.type
      });
      setSent(true);
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (error) {
      alert("Napaka pri pošiljanju sporočila");
    }
    setSending(false);
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-full py-20"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"} mb-2`}>
          {t("support.sent", language)}
        </h3>
        <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
          {t("support.thanks", language)}
        </p>
      </motion.div>
    );
  }

  return (
    <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl border p-6`}>
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
            {t("support.title", language)}
          </h2>
          <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            {t("support.subtitle", language)}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("support.type", language)}</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger className={`h-11 rounded-xl ${darkMode ? "bg-gray-900 border-gray-600 text-white" : ""}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="predlog">💡 {t("support.suggestion", language)}</SelectItem>
              <SelectItem value="težava">⚠️ {t("support.issue", language)}</SelectItem>
              <SelectItem value="vprašanje">❓ {t("support.question", language)}</SelectItem>
              <SelectItem value="drugo">💬 {t("support.other", language)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("support.subject", language)}</Label>
          <Input
            placeholder={t("support.subjectPlaceholder", language)}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className={`h-11 rounded-xl ${darkMode ? "bg-gray-900 border-gray-600 text-white" : ""}`}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("support.message", language)}</Label>
          <Textarea
            placeholder={t("support.messagePlaceholder", language)}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className={`rounded-xl resize-none ${darkMode ? "bg-gray-900 border-gray-600 text-white" : ""}`}
            rows={6}
            maxLength={1000}
          />
          <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"} text-right`}>
            {form.message.length}/1000
          </p>
        </div>

        <Button
          type="submit"
          disabled={!form.subject.trim() || !form.message.trim() || sending}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 gap-2"
        >
          <Send className="w-4 h-4" />
          {sending ? t("support.sending", language) : t("support.submit", language)}
        </Button>
      </form>
    </div>
  );
}