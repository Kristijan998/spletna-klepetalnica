import { useRef, useState } from "react";
import { db } from "@/api/db";
import { toast } from "sonner";
import { t } from "@/components/utils/translations";
import { Avatar, getAge } from "@/components/chat/ClassicLayout";

const MAX_GALLERY = 5;
const MAX_BIO = 200;

/* Nastavitve profila: na vrhu predogled, kako te vidijo drugi; spodaj urejanje. Vsaka sprememba se shrani takoj. */
export default function ProfileSettings({ profile, onBack, onSave, language = "sl" }) {
  const sl = language === "sl";
  const [busy, setBusy] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const avatarInput = useRef(null);
  const galleryInput = useRef(null);

  const gallery = Array.isArray(profile.gallery_images) ? profile.gallery_images.filter(Boolean) : [];
  const age = getAge(profile.birth_year);
  const place = [profile.city, profile.country].filter(Boolean).join(", ");
  const save = (patch) => onSave(patch, { closeAfterSave: false });

  const upload = async (event, onDone) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(sl ? "Prosim izberi sliko." : "Please choose an image.");
      return;
    }
    setBusy(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      await onDone(file_url);
    } catch {
      toast.error(sl ? "Napaka pri nalaganju slike." : "Image upload failed.");
    }
    setBusy(false);
  };

  return (
    <div className="k-page">
      <div className="k-panel">
        <div className="k-dlghead">
          {t("settings.title", language)}
          <span className="k-right">{sl ? "tako te vidijo drugi ↓" : "how others see you ↓"}</span>
        </div>
        <div className="k-dlgbody">
          <div className="k-pcard">
            <Avatar profile={profile} className="k-av k-big" />
            <div style={{ minWidth: 0 }}>
              <div className="k-pn">
                {profile.display_name} <span className="k-badge">{sl ? "ti" : "you"}</span>
              </div>
              <div className="k-pm">{[profile.gender, age !== null ? `${age} ${sl ? "let" : "years"}` : "", profile.city].filter(Boolean).join(" · ")}</div>
              <div className="k-pb" style={profile.bio ? undefined : { color: "var(--k-muted)" }}>
                {profile.bio || (sl ? "Še nimaš opisa." : "No bio yet.")}
              </div>
              {gallery.length > 0 && (
                <div className="k-strip">
                  {gallery.map((src) => <img key={src} src={src} alt="" />)}
                </div>
              )}
            </div>
          </div>

          <div className="k-rows">
            <div className="k-row">
              <span className="k-k">{sl ? "Profilna slika" : "Profile picture"}</span>
              <span className="k-v" style={{ color: "var(--k-muted)" }}>{busy ? (sl ? "Nalagam …" : "Uploading …") : ""}</span>
              <button type="button" className="k-ed" disabled={busy} onClick={() => avatarInput.current?.click()}>
                {sl ? "Zamenjaj" : "Change"}
              </button>
              <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => upload(e, (url) => save({ avatar_url: url }))} />
            </div>

            {editingBio ? (
              <div className="k-row k-top">
                <label className="k-k" htmlFor="settings-bio">{t("settings.bio", language)}</label>
                <div className="k-v">
                  <textarea id="settings-bio" className="k-inp" rows={3} maxLength={MAX_BIO} value={bioDraft} onChange={(e) => setBioDraft(e.target.value)} autoFocus />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <span className="k-cc">{bioDraft.length} / {MAX_BIO}</span>
                    <span className="k-grow" />
                    <button type="button" className="k-btn" onClick={() => setEditingBio(false)}>{sl ? "Prekliči" : "Cancel"}</button>
                    <button
                      type="button"
                      className="k-btn k-pri"
                      onClick={async () => {
                        await save({ bio: bioDraft.trim() });
                        setEditingBio(false);
                      }}
                    >
                      {sl ? "Shrani" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="k-row">
                <span className="k-k">{t("settings.bio", language)}</span>
                <span className="k-v k-ell">{profile.bio || "—"}</span>
                <button
                  type="button"
                  className="k-ed"
                  onClick={() => {
                    setBioDraft(profile.bio || "");
                    setEditingBio(true);
                  }}
                >
                  {sl ? "Uredi" : "Edit"}
                </button>
              </div>
            )}

            <div className="k-row k-top">
              <span className="k-k">{sl ? "Galerija" : "Gallery"} ({gallery.length}/{MAX_GALLERY})</span>
              <div className="k-v">
                <div className="k-gal">
                  {gallery.map((src, i) => (
                    <div key={src} className="k-g">
                      <img src={src} alt={`${sl ? "Slika" : "Photo"} ${i + 1}`} />
                      <button
                        type="button"
                        className="k-x"
                        aria-label={`${sl ? "Odstrani sliko" : "Remove photo"} ${i + 1}`}
                        onClick={() => save({ gallery_images: gallery.filter((_, j) => j !== i) })}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {gallery.length < MAX_GALLERY && (
                    <button type="button" className="k-g k-add" disabled={busy} onClick={() => galleryInput.current?.click()} aria-label={sl ? "Dodaj sliko" : "Add photo"}>
                      +
                    </button>
                  )}
                </div>
                <input ref={galleryInput} type="file" accept="image/*" hidden onChange={(e) => upload(e, (url) => save({ gallery_images: [...gallery, url].slice(0, MAX_GALLERY) }))} />
              </div>
            </div>

            <div className="k-row">
              <span className="k-k">{sl ? "Osebni podatki" : "Personal details"}</span>
              <span className="k-v k-ell" style={{ color: "var(--k-muted)" }}>
                {[profile.display_name, profile.birth_year, profile.gender, place].filter(Boolean).join(" · ")}
              </span>
              <span className="k-badge">{sl ? "zaklenjeno" : "locked"}</span>
            </div>
          </div>
        </div>
        <div className="k-dlgfoot">
          <button type="button" className="k-btn" onClick={onBack}>{sl ? "Zapri" : "Close"}</button>
        </div>
      </div>
    </div>
  );
}
