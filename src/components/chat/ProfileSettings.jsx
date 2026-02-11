import React, { useState } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/Button";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/Label";

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
    <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-3xl border shadow-xl p-6`}>
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{t("settings.title", language)}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {form.avatar_url ? (
              <img 
                src={form.avatar_url} 
                alt="Profilna slika"
                className="w-24 h-24 rounded-2xl object-cover"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
                style={{ backgroundColor: getGenderAvatarColor(profile.gender, profile.avatar_color) }}
              >
                {profile.display_name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <label 
              className={`absolute bottom-0 right-0 ${darkMode ? "bg-violet-600" : "bg-violet-500"} hover:bg-violet-700 text-white rounded-full p-2 cursor-pointer transition-colors`}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
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
          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{language === "sl" ? "Klikni za spremembo slike" : "Click to change picture"}</p>
        </div>

        <div className="space-y-2">
          <Label className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("settings.bio", language)}</Label>
          <Textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className={`rounded-xl resize-none ${darkMode ? "bg-gray-900 border-gray-600 text-white" : "border-gray-200 text-gray-900"}`}
            rows={3}
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("settings.gallery", language)}</Label>
          <div className="grid grid-cols-3 gap-3">
            {form.gallery_images.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img} alt={`Galerija ${i + 1}`} className="w-full aspect-square object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => removeGalleryImage(i)}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {form.gallery_images.length < 5 && (
              <label className={`aspect-square rounded-xl border-2 border-dashed ${darkMode ? "border-gray-600 bg-gray-900" : "border-gray-300 bg-gray-50"} flex items-center justify-center cursor-pointer hover:border-violet-400 transition-colors`}>
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                ) : (
                  <Plus className="w-6 h-6 text-gray-400" />
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

        <div className={`p-4 rounded-xl ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("settings.name", language)}</span>
            <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{profile.display_name}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("settings.birthYear", language)}</span>
            <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{profile.birth_year}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{language === "sl" ? "Spol" : "Gender"}</span>
            <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{profile.gender}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("register.country", language)}</span>
            <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{profile.country}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{t("register.city", language)}</span>
            <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{profile.city}</span>
          </div>
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium"
        >
          {saving ? t("settings.saving", language) : t("settings.save", language)}
        </Button>
      </form>
    </div>
  );
}