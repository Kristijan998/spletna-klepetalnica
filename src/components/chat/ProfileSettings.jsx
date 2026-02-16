import React, { useState } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { ArrowLeft, Camera, Loader2, X, Plus } from "lucide-react";
import { t } from "@/components/utils/translations";

function getGenderAvatarColor(gender, fallback) {
  const normalized = String(gender || "").trim().toLocaleLowerCase("sl");
  if (normalized === "moški" || normalized === "moski") return "#3b82f6";
  if (normalized === "ženska" || normalized === "zenska") return "#ec4899";
  return fallback || "#8b5cf6";
}

export default function ProfileSettings({ profile, onBack, onSave, language = "sl" }) {
  const darkMode = document.documentElement.classList.contains("dark");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bio: profile.bio || "",
    avatar_url: profile.avatar_url || "",
    gallery_images: profile.gallery_images || []
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Prosim izberi sliko");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setForm({ ...form, avatar_url: file_url });
    } catch (error) {
      alert("Napaka pri nalaganju slike");
    }
    setUploading(false);
  };

  const handleGalleryUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Prosim izberi sliko");
      return;
    }

    if (form.gallery_images.length >= 5) {
      alert("Maksimalno 5 slik v galeriji");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setForm({ ...form, gallery_images: [...form.gallery_images, file_url] });
    } catch (error) {
      alert("Napaka pri nalaganju slike");
    }
    setUploading(false);
  };

  const removeGalleryImage = (index) => {
    const newGallery = form.gallery_images.filter((_, i) => i !== index);
    setForm({ ...form, gallery_images: newGallery });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className={`${darkMode ? "bg-slate-900/70 border-slate-700" : "bg-white border-slate-200"} rounded-2xl border p-4 sm:p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className={`text-lg font-semibold tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
          {t("settings.title", language)}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {form.avatar_url ? (
              <img 
                src={form.avatar_url} 
                alt="Profilna slika"
                className="w-20 h-20 rounded-xl object-cover ring-1 ring-black/10"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center text-2xl font-semibold text-white"
                style={{ backgroundColor: getGenderAvatarColor(profile.gender, profile.avatar_color) }}
              >
                {profile.display_name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <label 
              className={`absolute -bottom-1 -right-1 ${darkMode ? "bg-violet-600" : "bg-violet-500"} hover:bg-violet-700 text-white rounded-full p-1.5 cursor-pointer transition-colors`}
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
          </div>
          <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            {language === "sl" ? "Klikni za spremembo slike" : "Click to change picture"}
          </p>
        </div>

        <div className="space-y-2">
          <Label className={`text-xs font-medium uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("settings.bio", language)}
          </Label>
          <Textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className={`rounded-lg resize-none text-sm ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "border-slate-200 text-slate-900"}`}
            rows={3}
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label className={`text-xs font-medium uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("settings.gallery", language)}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {form.gallery_images.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img} alt={`Galerija ${i + 1}`} className="w-full aspect-square object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => removeGalleryImage(i)}
                  className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {form.gallery_images.length < 5 && (
              <label className={`aspect-square rounded-lg border border-dashed ${darkMode ? "border-slate-600 bg-slate-950" : "border-slate-300 bg-slate-50"} flex items-center justify-center cursor-pointer hover:border-violet-400 transition-colors`}>
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                ) : (
                  <Plus className="w-5 h-5 text-slate-400" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleGalleryUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

        <div className={`p-3 rounded-lg border ${darkMode ? "bg-slate-950 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
          <div className="flex items-center justify-between py-1">
            <span className={`text-xs uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{t("settings.name", language)}</span>
            <span className={`text-sm ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{profile.display_name}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className={`text-xs uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{t("settings.birthYear", language)}</span>
            <span className={`text-sm ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{profile.birth_year}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className={`text-xs uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{language === "sl" ? "Spol" : "Gender"}</span>
            <span className={`text-sm ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{profile.gender}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className={`text-xs uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{t("register.country", language)}</span>
            <span className={`text-sm ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{profile.country}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className={`text-xs uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{t("register.city", language)}</span>
            <span className={`text-sm ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{profile.city}</span>
          </div>
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-10 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium"
        >
          {saving ? t("settings.saving", language) : t("settings.save", language)}
        </Button>
      </form>
    </div>
  );
}
