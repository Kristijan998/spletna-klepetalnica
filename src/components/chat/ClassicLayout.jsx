import { useState } from "react";
import { Hash, Home as HomeIcon, Mail, MessagesSquare, Settings, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function ChattkoLogo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: "none" }}>
      <path d="M4 5h24v17H13l-6 5v-5H4z" fill="#0A84D6" />
      <path d="M19.5 10.2a5 5 0 1 0 0 6.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

export function ClassicWindow({ subtitle, toolbar, children, status }) {
  return (
    <div className="k-win">
      <div className="k-title">
        <ChattkoLogo />
        <b>Chattko</b>
        {subtitle && <span className="k-sub">– {subtitle}</span>}
      </div>
      <div className="k-tools" role="toolbar" aria-label="Orodna vrstica">
        {toolbar}
      </div>
      {children}
      <footer className="k-status">{status}</footer>
    </div>
  );
}

export function ToolButton({ icon: Icon, label, onClick, pressed, danger, title }) {
  return (
    <button
      type="button"
      className={`k-tb${danger ? " k-danger" : ""}`}
      onClick={onClick}
      aria-pressed={pressed === undefined ? undefined : pressed}
      title={title || label}
      aria-label={label}
    >
      <Icon aria-hidden="true" />
      <span className="k-lbl-hide">{label}</span>
    </button>
  );
}

export function genderColor(gender, fallback) {
  const g = String(gender || "").trim().toLocaleLowerCase("sl");
  if (g === "moški" || g === "moski" || g === "male") return "#3b82f6";
  if (g === "ženska" || g === "zenska" || g === "female") return "#ec4899";
  return fallback || "#8b5cf6";
}

export function getAge(birthYear) {
  const year = Number(birthYear);
  const now = new Date().getFullYear();
  if (!Number.isFinite(year) || year < 1900 || year > now) return null;
  return now - year;
}

export function genderShort(gender) {
  const g = String(gender || "").trim().toLocaleLowerCase("sl");
  if (g.startsWith("m")) return "M";
  if (g.startsWith("ž") || g.startsWith("z") || g.startsWith("f")) return "Ž";
  return "";
}

export function Avatar({ profile, className = "k-av", size }) {
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.4) } : undefined;
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className={className} style={style} />;
  }
  return (
    <span className={className} style={{ ...style, background: genderColor(profile?.gender, profile?.avatar_color) }} aria-hidden="true">
      {profile?.display_name?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

/* Drevo pogovorov: Pregled, Kanali, Zasebni pogovori, Nastavitve profila */
export function TreeNav({ sl, selected, conversations, onSelect }) {
  const [folded, setFolded] = useState(() => new Set());
  const toggle = (key) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const Leaf = ({ id, icon: Icon, label, count }) => (
    <li>
      <button type="button" className={`k-node${selected === id ? " k-sel" : ""}`} onClick={() => onSelect(id)} aria-current={selected === id ? "page" : undefined}>
        <span className="k-tw" />
        <Icon aria-hidden="true" />
        <span className="k-label">{label}</span>
        {count > 0 && <span className="k-cnt" aria-label={sl ? `${count} neprebranih` : `${count} unread`}>{count}</span>}
      </button>
    </li>
  );
  const Folder = ({ k, icon: Icon, color, label, children }) => {
    const closed = folded.has(k);
    return (
      <li>
        <button type="button" className="k-node" onClick={() => toggle(k)} aria-expanded={!closed}>
          <span className="k-tw" aria-hidden="true">{closed ? "▸" : "▾"}</span>
          <Icon aria-hidden="true" style={{ color }} />
          <span className="k-label">{label}</span>
        </button>
        {!closed && <ul>{children}</ul>}
      </li>
    );
  };

  return (
    <nav className="k-tree" aria-label={sl ? "Pogovori" : "Conversations"}>
      <ul>
        <Leaf id="home" icon={HomeIcon} label={sl ? "Pregled" : "Overview"} />
        <Folder k="channels" icon={MessagesSquare} color="var(--k-accent)" label={sl ? "Kanali" : "Channels"}>
          <Leaf id="public" icon={Hash} label={sl ? "# Splošno" : "# General"} />
        </Folder>
        <Folder k="private" icon={Mail} color="var(--k-success)" label={sl ? "Zasebni pogovori" : "Private chats"}>
          {conversations.length === 0 ? (
            <li>
              <span className="k-node k-empty">
                <span className="k-tw" />
                {sl ? "(ni pogovorov)" : "(no chats)"}
              </span>
            </li>
          ) : (
            conversations.map((c) => <Leaf key={c.id} id={`room:${c.id}`} icon={User} label={c.name} count={c.unread} />)
          )}
        </Folder>
        <Leaf id="settings" icon={Settings} label={sl ? "Nastavitve profila" : "Profile settings"} />
      </ul>
    </nav>
  );
}

/* Seznam prisotnih (desni stolpec) */
export function PresenceList({ sl, people, myId, selectedId, onPick, onOpenChat }) {
  return (
    <aside className="k-side" aria-label={sl ? "Prisotni v pogovoru" : "People in this chat"}>
      <h2>
        {sl ? "Prisotni" : "Online"} <span>{people.length}</span>
      </h2>
      <ul className="k-users">
        {people.map(({ profile, online }) => {
          const age = getAge(profile.birth_year);
          const me = profile.id === myId;
          return (
            <li key={profile.id}>
              <button
                type="button"
                className={selectedId === profile.id ? "k-sel" : ""}
                onClick={() => !me && onPick(profile)}
                onDoubleClick={() => !me && onOpenChat(profile)}
                title={me ? undefined : sl ? "Klik: profil · dvoklik: zasebni pogovor" : "Click: profile · double-click: private chat"}
              >
                <span className={`k-dot${online ? "" : " k-away"}`} aria-hidden="true" />
                <span className="k-nm">{profile.display_name}</span>
                {me && <span className="k-you">({sl ? "ti" : "you"})</span>}
                <small>
                  {genderShort(profile.gender)} {age ?? ""}
                </small>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="k-desc">
        <span className="k-info" aria-hidden="true">i</span>
        <span>{sl ? "Klik odpre profil, dvoklik zasebni pogovor." : "Click opens profile, double-click a private chat."}</span>
      </div>
    </aside>
  );
}

/* Klasično pogovorno okno (naslovna vrstica + vsebina + gumbi) */
export function ClassicDialog({ open, onOpenChange, title, description, children, footer, wide }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="k-dialog" style={{ maxWidth: wide ? 520 : 420 }}>
        <div className="k-dlghead">
          <DialogTitle>{title}</DialogTitle>
        </div>
        {description ? <DialogDescription className="sr-only">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        <div className="k-dlgbody">{children}</div>
        {footer && <div className="k-dlgfoot">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}

/* Profil drugega uporabnika */
export function ProfileDialog({ sl, profile, online, onClose, onChat }) {
  const [idx, setIdx] = useState(0);
  if (!profile) return null;
  const age = getAge(profile.birth_year);
  const images = Array.from(new Set([profile.avatar_url, ...(profile.gallery_images || [])].filter(Boolean)));
  const place = [profile.city, profile.country].filter(Boolean).join(", ");
  return (
    <ClassicDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${sl ? "Profil" : "Profile"} – ${profile.display_name}`}
      wide
      footer={
        <>
          <button type="button" className="k-btn" onClick={onClose}>{sl ? "Zapri" : "Close"}</button>
          <button type="button" className="k-btn k-pri" onClick={() => onChat(profile)}>{sl ? "Klepet" : "Chat"}</button>
        </>
      }
    >
      <div className="k-prof">
        <Avatar profile={profile} size={64} />
        <dl>
          <dt>{sl ? "Vzdevek" : "Nickname"}</dt><dd>{profile.display_name}</dd>
          {age !== null && (<><dt>{sl ? "Starost" : "Age"}</dt><dd>{age} {sl ? "let" : "years"}</dd></>)}
          {profile.gender && (<><dt>{sl ? "Spol" : "Gender"}</dt><dd>{profile.gender}</dd></>)}
          {place && (<><dt>{sl ? "Kraj" : "Place"}</dt><dd>{place}</dd></>)}
          <dt>{sl ? "Stanje" : "Status"}</dt>
          <dd><span className={`k-dot${online ? "" : " k-away"}`} /> {online ? (sl ? "Na voljo" : "Available") : (sl ? "Odsoten" : "Away")}</dd>
        </dl>
      </div>
      <div className="k-field">
        <span className="k-lbl">{sl ? "Kratek opis" : "Short bio"}</span>
        <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{profile.bio || <span style={{ color: "var(--k-muted)" }}>—</span>}</div>
      </div>
      <div className="k-field">
        <span className="k-lbl">{sl ? "Slike" : "Photos"}</span>
        {images.length === 0 ? (
          <span style={{ color: "var(--k-muted)" }}>{sl ? "Uporabnik nima dodanih slik." : "This user has no photos."}</span>
        ) : (
          <>
            <img src={images[Math.min(idx, images.length - 1)]} alt="" className="k-photo" />
            {images.length > 1 && (
              <div className="k-thumbs">
                {images.map((src, i) => (
                  <button key={src} type="button" className={i === idx ? "k-sel" : ""} onClick={() => setIdx(i)} aria-label={`${sl ? "Slika" : "Photo"} ${i + 1}`}>
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ClassicDialog>
  );
}

/* Izbira osebe za nov zasebni pogovor */
export function NewChatDialog({ sl, open, onOpenChange, people, onPick }) {
  return (
    <ClassicDialog
      open={open}
      onOpenChange={onOpenChange}
      title={sl ? "Nov pogovor" : "New chat"}
      footer={<button type="button" className="k-btn" onClick={() => onOpenChange(false)}>{sl ? "Prekliči" : "Cancel"}</button>}
    >
      <span className="k-lbl">{sl ? "Začni pogovor z" : "Start a chat with"}</span>
      {people.length === 0 ? (
        <span style={{ color: "var(--k-muted)" }}>{sl ? "Trenutno ni nikogar na voljo." : "Nobody is online right now."}</span>
      ) : (
        <ul className="k-users k-pick">
          {people.map(({ profile, online }) => {
            const age = getAge(profile.birth_year);
            return (
              <li key={profile.id}>
                <button type="button" onClick={() => onPick(profile)}>
                  <span className={`k-dot${online ? "" : " k-away"}`} aria-hidden="true" />
                  <span className="k-nm">{profile.display_name}</span>
                  <small>
                    {genderShort(profile.gender)} {age ?? ""}{profile.city ? ` · ${profile.city}` : ""}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </ClassicDialog>
  );
}
