import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Sparkles, Check } from "lucide-react";
import { t } from "@/components/utils/translations";

const COUNTRIES = [
  "Slovenija", "Hrvaška", "Srbija", "Bosna in Hercegovina", "Makedonija", "Črna gora",
  "Avstrija", "Nemčija", "Italija", "Švica", "Velika Britanija", "Francija", "Španija",
  "Portugalska", "Nizozemska", "Belgija", "Danska", "Švedska", "Norveška", "Finska",
  "Poljska", "Češka", "Slovaška", "Madžarska", "Romunija", "Bolgarija", "Grčija",
  "ZDA", "Kanada", "Avstralija", "Nova Zelandija", "Drugo"
];

const COUNTRY_FLAGS = {
  "Slovenija": "https://flagcdn.com/w40/si.png", "Hrvaška": "https://flagcdn.com/w40/hr.png", "Srbija": "https://flagcdn.com/w40/rs.png", "Bosna in Hercegovina": "https://flagcdn.com/w40/ba.png", "Makedonija": "https://flagcdn.com/w40/mk.png", "Črna gora": "https://flagcdn.com/w40/me.png",
  "Avstrija": "https://flagcdn.com/w40/at.png", "Nemčija": "https://flagcdn.com/w40/de.png", "Italija": "https://flagcdn.com/w40/it.png", "Švica": "https://flagcdn.com/w40/ch.png", "Velika Britanija": "https://flagcdn.com/w40/gb.png", "Francija": "https://flagcdn.com/w40/fr.png", "Španija": "https://flagcdn.com/w40/es.png",
  "Portugalska": "https://flagcdn.com/w40/pt.png", "Nizozemska": "https://flagcdn.com/w40/nl.png", "Belgija": "https://flagcdn.com/w40/be.png", "Danska": "https://flagcdn.com/w40/dk.png", "Švedska": "https://flagcdn.com/w40/se.png", "Norveška": "https://flagcdn.com/w40/no.png", "Finska": "https://flagcdn.com/w40/fi.png",
  "Poljska": "https://flagcdn.com/w40/pl.png", "Češka": "https://flagcdn.com/w40/cz.png", "Slovaška": "https://flagcdn.com/w40/sk.png", "Madžarska": "https://flagcdn.com/w40/hu.png", "Romunija": "https://flagcdn.com/w40/ro.png", "Bolgarija": "https://flagcdn.com/w40/bg.png", "Grčija": "https://flagcdn.com/w40/gr.png",
  "ZDA": "https://flagcdn.com/w40/us.png", "Kanada": "https://flagcdn.com/w40/ca.png", "Avstralija": "https://flagcdn.com/w40/au.png", "Nova Zelandija": "https://flagcdn.com/w40/nz.png", "Drugo": "/flags/un.svg"
};

const COUNTRY_NAMES_EN = {
  "Slovenija": "Slovenia", "Hrvaška": "Croatia", "Srbija": "Serbia", "Bosna in Hercegovina": "Bosnia and Herzegovina", "Makedonija": "North Macedonia", "Črna gora": "Montenegro",
  "Avstrija": "Austria", "Nemčija": "Germany", "Italija": "Italy", "Švica": "Switzerland", "Velika Britanija": "United Kingdom", "Francija": "France", "Španija": "Spain",
  "Portugalska": "Portugal", "Nizozemska": "Netherlands", "Belgija": "Belgium", "Danska": "Denmark", "Švedska": "Sweden", "Norveška": "Norway", "Finska": "Finland",
  "Poljska": "Poland", "Češka": "Czech Republic", "Slovaška": "Slovakia", "Madžarska": "Hungary", "Romunija": "Romania", "Bolgarija": "Bulgaria", "Grčija": "Greece",
  "ZDA": "United States", "Kanada": "Canada", "Avstralija": "Australia", "Nova Zelandija": "New Zealand", "Drugo": "Other"
};

export default function GuestRegistration({ onRegister, isLoading, language, onLanguageDetect, darkMode, onCheckName }) {
  const landingTitle = language === "sl" ? "Spletna klepetalnica Chattko" : "Chattko web chat";
  const [form, setForm] = useState({
    display_name: "",
    birth_year: "",
    gender: "",
    country: "",
    city: "",
    bio: ""
  });

  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [checkingName, setCheckingName] = useState(false);
  const [isNameTaken, setIsNameTaken] = useState(false);
  const [checkedName, setCheckedName] = useState("");
  const [nameCheckError, setNameCheckError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [birthYearOpen, setBirthYearOpen] = useState(false);
  const [cityData, setCityData] = useState({ en: null, sl: null });
  const nameCheckRequestRef = useRef(0);
  const hasRequestedPreciseLocationRef = useRef(false);
  const hasRequestedIpLocationRef = useRef(false);
  
  const funnyNamesSl = [
    "MačjiŠef", "KralicaVihrov", "NinjaPečica", "SuperPiškot", "KozorogNaRolki",
    "LeteciKrompir", "RitmiŠtrumpf", "ZombiFurman", "KaktusNaBici", "PingvinDetektiv",
    "SirniGuru", "TekociDelfin", "TakoUfoŽe", "PijaniKrokodil", "ŠamanKartonček",
    "ŽabaRepar", "MedvedSolzac", "IgracaZtancaRenke", "TriclovidnaKokoš", "LeteciKrokodil"
  ];
  
  const funnyNamesEn = [
    "SillyPanda", "NinjaPenguin", "FuzzyUnicorn", "ZippyDragon", "CrazySquirrel",
    "DizzyLlama", "WackyWombat", "FunkyMonkey", "GoobyGiraffe", "LoopyLion",
    "BonkersBear", "CheekyCheetah", "WildWalrus", "FunnyFox", "HilariousHedgehog"
  ];
  
  const funnyNames = useMemo(() => {
    return language === "sl" ? funnyNamesSl : funnyNamesEn;
  }, [language]);

  const currentYear = new Date().getFullYear();
  const birthYearOptions = [];
  for (let year = currentYear - 13; year >= currentYear - 100; year--) {
    birthYearOptions.push(year);
  }

  useEffect(() => {
    if (!birthYearOpen) return;

    let attempts = 0;
    const maxAttempts = 12;

    const scrollToYear2000 = () => {
      const year2000 = document.querySelector('[data-birth-year-option="2000"]');
      if (year2000) {
        year2000.scrollIntoView({ block: "center" });
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        window.requestAnimationFrame(scrollToYear2000);
      }
    };

    window.requestAnimationFrame(scrollToYear2000);
  }, [birthYearOpen]);

  const requestIpLocation = useCallback(async () => {
    if (hasRequestedIpLocationRef.current) return;
    hasRequestedIpLocationRef.current = true;

    const mapCountry = (value) => {
      if (!value) return "";
      const countryMap = {
        "Slovenia": "Slovenija",
        "Croatia": "Hrvaška",
        "Serbia": "Srbija",
        "Bosnia and Herzegovina": "Bosna in Hercegovina",
        "Austria": "Avstrija",
        "Germany": "Nemčija",
        "Italy": "Italija"
      };
      return countryMap[value] || value;
    };

    const hasStoredLanguage = (() => {
      try {
        const stored = localStorage.getItem("chat_language");
        return stored === "sl" || stored === "en";
      } catch {
        return false;
      }
    })();

    const hasLangParam = (() => {
      try {
        const lang = new URLSearchParams(window.location.search).get("lang");
        return lang === "sl" || lang === "en";
      } catch {
        return false;
      }
    })();

    const applyDetected = ({ countryCode, countryName, city }) => {
      if (!hasStoredLanguage && !hasLangParam && onLanguageDetect) {
        onLanguageDetect(countryCode === "SI" ? "sl" : "en");
      }

      const mappedCountry = mapCountry(countryName);
      if (mappedCountry && COUNTRIES.includes(mappedCountry)) {
        setForm((prev) => (prev.country ? prev : { ...prev, country: mappedCountry }));
      }
      if (city) {
        setForm((prev) => (prev.city ? prev : { ...prev, city }));
      }
    };

    try {
      const res = await fetch("/api/ip-location");
      if (!res.ok) return;
      const data = await res.json();
      applyDetected({
        countryCode: data?.country_code || "",
        countryName: data?.country || "",
        city: data?.city || "",
      });
    } catch {
      // ignore detection errors
    }
  }, [onLanguageDetect]);

  const requestPreciseLocation = useCallback(() => {
    if (hasRequestedPreciseLocationRef.current) return;
    if (!navigator.geolocation) return;
    hasRequestedPreciseLocationRef.current = true;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=sl`
          );
          if (!res.ok) return;
          const data = await res.json();

          const countryMap = {
            "Slovenia": "Slovenija",
            "Croatia": "Hrvaška",
            "Serbia": "Srbija",
            "Bosnia and Herzegovina": "Bosna in Hercegovina",
            "Austria": "Avstrija",
            "Germany": "Nemčija",
            "Italy": "Italija"
          };
          const mappedCountry = countryMap[data?.countryName] || data?.countryName || "";
          const city = data?.city || data?.locality || "";
          const countryCode = data?.countryCode || "";

          if (onLanguageDetect && countryCode) {
            onLanguageDetect(countryCode === "SI" ? "sl" : "en");
          }

          if (mappedCountry && COUNTRIES.includes(mappedCountry)) {
            setForm((prev) => (prev.country ? prev : { ...prev, country: mappedCountry }));
          }
          if (city) {
            setForm((prev) => (prev.city ? prev : { ...prev, city }));
          }
        } catch {
          // ignore detection errors
        }
      },
      () => {
        // ignore denied geolocation
      },
      { timeout: 2500, maximumAge: 60000 }
    );
  }, [onLanguageDetect]);

  useEffect(() => {
    const checkName = async () => {
      const currentName = form.display_name.trim();
      if (currentName.length < 3) {
        setNameSuggestions([]);
        setIsNameTaken(false);
        setCheckedName("");
        setNameCheckError("");
        return;
      }

      const requestId = ++nameCheckRequestRef.current;
      setCheckingName(true);
      setNameCheckError("");
      try {
        const isTaken = await onCheckName(currentName);
        if (requestId !== nameCheckRequestRef.current) {
          return;
        }
        setIsNameTaken(isTaken);

        if (isTaken) {
          // Generate available name suggestions
          const suggestions = [];
          const shuffled = [...funnyNames].sort(() => Math.random() - 0.5);
          
          for (const name of shuffled) {
            if (suggestions.length >= 3) break;
            const isAvailable = !(await onCheckName(name));
            if (isAvailable) {
              suggestions.push(name);
            }
          }
          
          // If we couldn't find 3 unique names, add numbered variants
          if (suggestions.length < 3) {
            const baseName = shuffled[0];
            for (let i = 1; i <= 99 && suggestions.length < 3; i++) {
              const numberedName = `${baseName}${i}`;
              const isAvailable = !(await onCheckName(numberedName));
              if (isAvailable) {
                suggestions.push(numberedName);
              }
            }
          }
          
          setNameSuggestions(suggestions);
        } else {
          setNameSuggestions([]);
        }
        setCheckedName(currentName);
      } catch (error) {
        if (requestId !== nameCheckRequestRef.current) {
          return;
        }
        console.error("Napaka pri preverjanju imena:", error);
        setIsNameTaken(false);
        setNameSuggestions([]);
        setNameCheckError(language === "sl" ? "Preverjanje imena ni uspelo. Poskusi znova." : "Name check failed. Please try again.");
      } finally {
        if (requestId === nameCheckRequestRef.current) {
          setCheckingName(false);
        }
      }
    };

    const timer = setTimeout(checkName, 800);
    return () => clearTimeout(timer);
  }, [form.display_name, onCheckName, funnyNames, language]);

  const loadCityData = useCallback(async () => {
    if (cityData.en && cityData.sl) return;
    try {
      const mod = await import("./location-data");
      setCityData({
        en: mod.CITIES_EN || {},
        sl: mod.CITIES_BY_COUNTRY || {},
      });
    } catch {
      // ignore data loading errors
    }
  }, [cityData.en, cityData.sl]);

  useEffect(() => {
    if (form.country) {
      void loadCityData();
    }
  }, [form.country, loadCityData]);

  const getCountryDisplayName = (country) => {
    return language === "en" ? (COUNTRY_NAMES_EN[country] || country) : country;
  };

  const getCityOptions = () => {
    if (!cityData.en || !cityData.sl) {
      return language === "en" ? ["Other"] : ["Drugo"];
    }
    if (language === "en") {
      const enCountryName = getCountryDisplayName(form.country);
      return cityData.en[enCountryName] || ["Other"];
    }
    return cityData.sl[form.country] || ["Drugo"];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    const trimmedName = form.display_name.trim();
    if (!trimmedName || !form.birth_year || !form.gender || !form.country || !form.city) {
      setSubmitError(language === "sl" ? "Izpolni vsa obvezna polja." : "Please fill in all required fields.");
      return;
    }
    if (trimmedName.length < 3) {
      setSubmitError(language === "sl" ? "Ime mora imeti najmanj 3 črke." : "Name must be at least 3 characters long.");
      return;
    }
    if (checkingName) {
      setSubmitError(language === "sl" ? "Počakaj, preverjam ime." : "Please wait, checking name.");
      return;
    }
    if (isNameTaken && checkedName === trimmedName) {
      setSubmitError(language === "sl" ? "To ime je že zasedeno." : "This name is already taken.");
      return;
    }
    
    const result = await onRegister({
      ...form,
      display_name: trimmedName,
      birth_year: parseInt(form.birth_year)
    });
    if (result && result.ok === false) {
      setSubmitError(result.error || (language === "sl" ? "Napaka pri registraciji." : "Registration error."));
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-3">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
        <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>{landingTitle}</h1>
      </div>

      <div className={`rounded-2xl shadow-lg border p-6 ${darkMode ? "bg-gray-800 border-gray-700 shadow-gray-900/50" : "bg-white border-gray-100 shadow-violet-100/50"}`}>
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <h2 className={`text-base font-semibold ${darkMode ? "text-white" : "text-gray-800"}`}>{t("register.title", language)}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("register.name", language)}</Label>
            <Input
              placeholder={t("register.namePlaceholder", language)}
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              onFocus={() => {
                void requestIpLocation();
              }}
              className={`h-10 rounded-lg text-sm focus:border-violet-400 focus:ring-violet-400/20 ${darkMode ? "bg-gray-900 border-gray-600 text-white placeholder:text-gray-500" : "border-gray-200 text-gray-900 placeholder:text-gray-400"}`}
              maxLength={15}
            />
            {form.display_name.trim().length > 0 && form.display_name.trim().length < 3 && (
              <p className={`text-xs ${darkMode ? "text-red-400" : "text-red-600"}`}>
                {language === "sl" ? "Ime mora imeti najmanj 3 črke." : "Name must be at least 3 characters long."}
              </p>
            )}
            {isNameTaken && checkedName === form.display_name.trim() && nameSuggestions.length > 0 && (
              <div className={`p-3 rounded-lg ${darkMode ? "bg-red-900/20 border border-red-700/50" : "bg-red-50 border border-red-200"}`}>
                <p className={`text-xs mb-2 ${darkMode ? "text-red-400" : "text-red-800"}`}>{language === "sl" ? "To ime je že zasedeno. Poskusi:" : "Name already taken. Try:"}</p>
                <div className="flex gap-2 flex-wrap">
                  {nameSuggestions.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setForm({ ...form, display_name: name })}
                      className={`text-xs px-3 py-1 rounded-lg transition-colors ${darkMode ? "bg-gray-800 text-violet-400 hover:bg-gray-700" : "bg-white text-violet-600 hover:bg-violet-50"}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {checkingName && form.display_name.trim().length >= 3 && (
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                {language === "sl" ? "Preverjam ime..." : "Checking name..."}
              </p>
            )}
            {nameCheckError && checkedName === form.display_name.trim() && (
              <p className={`text-xs ${darkMode ? "text-red-400" : "text-red-600"}`}>{nameCheckError}</p>
            )}
            {!isNameTaken && checkedName === form.display_name.trim() && form.display_name.trim().length >= 3 && (
              <div className="flex items-center gap-1.5">
                <Check className={`w-4 h-4 ${darkMode ? "text-green-400" : "text-green-600"}`} />
                <p className={`text-xs ${darkMode ? "text-green-400" : "text-green-600"}`}>{language === "sl" ? "Ime je na voljo" : "Name is available"}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={`text-xs font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("register.birthYear", language)}</Label>
              <Select
                value={form.birth_year.toString()}
                onValueChange={(v) => setForm({ ...form, birth_year: v })}
                onOpenChange={setBirthYearOpen}
              >
                <SelectTrigger
                  aria-label={language === "en" ? "Select birth year" : "Izberi leto rojstva"}
                  className={`h-10 rounded-lg text-sm ${darkMode ? "bg-gray-900 border-gray-600 text-white" : "border-gray-200 text-gray-900"}`}
                >
                  <SelectValue placeholder={t("register.selectYear", language)} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {birthYearOptions.map(year => (
                    <SelectItem
                      key={year}
                      value={year.toString()}
                      data-birth-year-option={year === 2000 ? "2000" : undefined}
                    >
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className={`text-xs font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("register.gender", language)}</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger
                  aria-label={language === "en" ? "Select gender" : "Izberi spol"}
                  className={`h-10 rounded-lg text-sm ${darkMode ? "bg-gray-900 border-gray-600 text-white" : "border-gray-200 text-gray-900"}`}
                >
                  <SelectValue placeholder={t("register.selectYear", language)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moški">{t("register.male", language)}</SelectItem>
                  <SelectItem value="ženska">{t("register.female", language)}</SelectItem>
                  <SelectItem value="drugo">{t("register.other", language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={`text-xs font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("register.country", language)}</Label>
              <Select
                value={form.country}
                onValueChange={(v) => setForm({ ...form, country: v, city: "" })}
                onOpenChange={(open) => {
                  if (open) {
                    void requestIpLocation();
                    requestPreciseLocation();
                  }
                }}
              >
                <SelectTrigger
                  aria-label={language === "en" ? "Select country" : "Izberi državo"}
                  className={`h-10 rounded-lg text-sm ${darkMode ? "bg-gray-900 border-gray-600 text-white" : "border-gray-200 text-gray-900"}`}
                >
                  <SelectValue placeholder={t("register.countryPlaceholder", language)} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {COUNTRIES.map(country => (
                    <SelectItem key={country} value={country} className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <img src={COUNTRY_FLAGS[country]} alt={country} width="24" height="16" className="w-6 h-4 object-cover" />
                        {getCountryDisplayName(country)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className={`text-xs font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("register.city", language)}</Label>
              <Select
                value={form.city}
                onValueChange={(v) => setForm({ ...form, city: v })}
                onOpenChange={(open) => {
                  if (open) {
                    void requestIpLocation();
                    void loadCityData();
                    requestPreciseLocation();
                  }
                }}
              >
                <SelectTrigger
                  aria-label={language === "en" ? "Select city" : "Izberi mesto"}
                  className={`h-10 rounded-lg text-sm ${darkMode ? "bg-gray-900 border-gray-600 text-white" : "border-gray-200 text-gray-900"}`}
                >
                  <SelectValue placeholder={t("register.cityPlaceholder", language)} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {getCityOptions().map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
              {t("register.bio", language)} <span className={darkMode ? "text-gray-400" : "text-gray-500"}>{t("register.bioOptional", language)}</span>
            </Label>
            <Textarea
              placeholder={t("register.bioPlaceholder", language)}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className={`rounded-lg text-sm focus:border-violet-400 focus:ring-violet-400/20 resize-none ${darkMode ? "bg-gray-900 border-gray-600 text-white placeholder:text-gray-500" : "border-gray-200 text-gray-900 placeholder:text-gray-400"}`}
              rows={2}
              maxLength={200}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className={`w-full h-10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              darkMode
                ? "bg-slate-100 text-slate-900 hover:bg-white"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {isLoading ? t("register.loading", language) : t("register.submit", language)}
          </Button>
          {submitError && (
            <p className={`text-xs ${darkMode ? "text-red-400" : "text-red-600"}`}>{submitError}</p>
          )}
        </form>


      </div>
    </div>
  );
}


