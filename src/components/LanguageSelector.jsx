import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages } from "lucide-react";

export default function LanguageSelector({ language, onChange, darkMode }) {
  const labels = {
    sl: { flag: "https://flagcdn.com/w20/si.png", short: "SLO", full: "Slovenščina" },
    en: { flag: "https://flagcdn.com/w20/gb.png", short: "ENG", full: "English" }
  };
  const current = labels[language] || labels.sl;

  return (
    <div className="flex items-center gap-2">
      <Languages className={`w-4 h-4 ${darkMode ? "text-gray-300" : "text-gray-500"}`} />
      <Select value={language} onValueChange={onChange}>
        <SelectTrigger className={`min-w-[110px] sm:min-w-[160px] h-9 rounded-xl ${darkMode ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
          <span className={darkMode ? "text-white" : "text-gray-900"}>
            <img
              src={current.flag}
              alt={current.full}
              className={`inline-block w-4 h-3 align-middle mr-1.5 ring-1 ${darkMode ? "ring-gray-600" : "ring-gray-200"} object-cover`}
            />
            <span className="sm:hidden">{current.short}</span><span className="hidden sm:inline">{current.full}</span>
          </span>
        </SelectTrigger>
        <SelectContent className={darkMode ? "bg-gray-800 border-gray-700" : "bg-white"}>
          <SelectItem value="sl" className={darkMode ? "text-white hover:bg-gray-700" : "text-gray-900"}>
            <img
              src={labels.sl.flag}
              alt={labels.sl.full}
              className={`inline-block w-4 h-3 align-middle mr-1.5 ring-1 ${darkMode ? "ring-gray-600" : "ring-gray-200"} object-cover`}
            />
            <span className="sm:hidden">SLO</span><span className="hidden sm:inline">Slovenščina</span>
          </SelectItem>
          <SelectItem value="en" className={darkMode ? "text-white hover:bg-gray-700" : "text-gray-900"}>
            <img
              src={labels.en.flag}
              alt={labels.en.full}
              className={`inline-block w-4 h-3 align-middle mr-1.5 ring-1 ${darkMode ? "ring-gray-600" : "ring-gray-200"} object-cover`}
            />
            <span className="sm:hidden">ENG</span><span className="hidden sm:inline">English</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}