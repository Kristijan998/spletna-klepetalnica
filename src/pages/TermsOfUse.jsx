import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/utils/index";
import { t } from "@/components/utils/translations";

export default function TermsOfUse() {
  const darkMode = document.documentElement.classList.contains("dark");
  const language = typeof window !== "undefined" ? localStorage.getItem("chat_language") || "sl" : "sl";

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const isEn = language === "en";
    const pageTitle = isEn ? "Terms of Use | Chattko" : "Pogoji uporabe | Chattko";
    const pageDescription = isEn
      ? "Review Chattko usage terms, acceptable behavior, and legal notices."
      : "Preberi pogoje uporabe Chattko, pravila vedenja in pravna obvestila.";
    const canonicalUrl = `https://www.chattko.com${createPageUrl("TermsOfUse")}`;

    const ensureMeta = (selector, attrName, attrValue) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      return el;
    };

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    document.title = pageTitle;
    canonical.setAttribute("href", canonicalUrl);

    ensureMeta('meta[name="description"]', "name", "description").setAttribute("content", pageDescription);
    ensureMeta('meta[property="og:title"]', "property", "og:title").setAttribute("content", pageTitle);
    ensureMeta('meta[property="og:description"]', "property", "og:description").setAttribute("content", pageDescription);
    ensureMeta('meta[property="og:url"]', "property", "og:url").setAttribute("content", canonicalUrl);
    ensureMeta('meta[name="twitter:title"]', "name", "twitter:title").setAttribute("content", pageTitle);
    ensureMeta('meta[name="twitter:description"]', "name", "twitter:description").setAttribute("content", pageDescription);
  }, [language]);

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
            {t("terms.title", language)}
          </h1>
        </div>

        <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-3xl border p-6 shadow-xl space-y-6`}>
          <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm`}>
            {t("terms.notice", language)}
          </p>
          <section>
            <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {t("terms.accept.title", language)}
            </h2>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm mt-2`}>
              {t("terms.accept.body", language)}
            </p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {t("terms.behavior.title", language)}
            </h2>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm mt-2`}>
              {t("terms.behavior.body", language)}
            </p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {t("terms.content.title", language)}
            </h2>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm mt-2`}>
              {t("terms.content.body", language)}
            </p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {t("terms.disclaimer.title", language)}
            </h2>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm mt-2`}>
              {t("terms.disclaimer.body", language)}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
