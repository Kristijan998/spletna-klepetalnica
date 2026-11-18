import { useState } from "react";
import { db } from "@/api/db";
import { t } from "@/components/utils/translations";

const TYPES = [
  ["predlog", "support.suggestion"],
  ["težava", "support.issue"],
  ["vprašanje", "support.question"],
  ["drugo", "support.other"],
];

export default function SupportForm({ myProfile, onBack, language = "sl" }) {
  const sl = language === "sl";
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ subject: "", message: "", type: "predlog" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      setError(sl ? "Vpiši naslov in sporočilo." : "Enter a subject and a message.");
      return;
    }
    setError("");
    setSending(true);
    try {
      await db.entities.SupportMessage.create({
        sender_profile_id: myProfile.id,
        sender_name: myProfile.display_name,
        subject: form.subject,
        message: form.message,
        type: form.type,
      });
      setSent(true);
    } catch {
      setError(sl ? "Pošiljanje ni uspelo. Poskusi znova." : "Could not send. Try again.");
    }
    setSending(false);
  };

  return (
    <div className="k-page">
      <form className="k-panel" onSubmit={handleSubmit}>
        <div className="k-dlghead">{t("support.title", language)}</div>
        {sent ? (
          <div className="k-dlgbody" role="status">
            <div style={{ fontSize: 16, fontWeight: 600 }}>{t("support.sent", language)}</div>
            <div style={{ color: "var(--k-muted)" }}>{t("support.thanks", language)}</div>
          </div>
        ) : (
          <div className="k-dlgbody">
            <div style={{ color: "var(--k-muted)" }}>{t("support.subtitle", language)}</div>
            <div className="k-field">
              <span className="k-lbl" id="support-type">{t("support.type", language)}</span>
              <div className="k-radios" role="radiogroup" aria-labelledby="support-type">
                {TYPES.map(([value, key]) => (
                  <label key={value}>
                    <input type="radio" name="support-type" value={value} checked={form.type === value} onChange={() => setForm({ ...form, type: value })} />
                    {t(key, language)}
                  </label>
                ))}
              </div>
            </div>
            <div className="k-field">
              <label htmlFor="support-subject">{t("support.subject", language)}</label>
              <input id="support-subject" className="k-inp" value={form.subject} maxLength={100} placeholder={t("support.subjectPlaceholder", language)} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="k-field">
              <label htmlFor="support-message">{t("support.message", language)}</label>
              <textarea id="support-message" className="k-inp" rows={6} value={form.message} maxLength={1000} placeholder={t("support.messagePlaceholder", language)} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>
            {error && <div className="k-err" role="alert">{error}</div>}
          </div>
        )}
        <div className="k-dlgfoot">
          {sent ? (
            <button type="button" className="k-btn k-pri" onClick={onBack}>{sl ? "Zapri" : "Close"}</button>
          ) : (
            <>
              <button type="button" className="k-btn" onClick={onBack}>{sl ? "Prekliči" : "Cancel"}</button>
              <button type="submit" className="k-btn k-pri" disabled={sending}>{sending ? t("support.sending", language) : t("support.submit", language)}</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
