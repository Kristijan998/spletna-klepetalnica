import React from "react";
import { Button } from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/utils";
import { t } from "@/components/utils/translations";

export default function PrivacyPolicy() {
  const darkMode = document.documentElement.classList.contains("dark");
  const language = typeof window !== "undefined" ? localStorage.getItem("chat_language") || "sl" : "sl";

  return (
    <div
      className={`min-h-screen ${
        darkMode
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-slate-50 via-white to-slate-100"
      } p-4`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (window.location.href = createPageUrl("Home"))}
            className="rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
            {t("privacy.title", language)}
          </h1>
        </div>

        <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-3xl border p-6 shadow-xl space-y-6`}>
          <section>
            <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {t("privacy.collect.title", language)}
            </h2>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm mt-2`}>
              {t("privacy.collect.body", language)}
            </p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {t("privacy.messages.title", language)}
            </h2>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm mt-2`}>
              {t("privacy.messages.body", language)}
            </p>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm mt-2`}>
              {t("privacy.leaveNotice", language)}
            </p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {t("privacy.retention.title", language)}
            </h2>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm mt-2`}>
              {t("privacy.retention.body", language)}
            </p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {t("privacy.contact.title", language)}
            </h2>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm mt-2`}>
              {t("privacy.contact.body", language)}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
