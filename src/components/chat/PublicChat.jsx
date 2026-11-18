import { useEffect, useRef, useState } from "react";
import { db } from "@/api/db";

export const PUBLIC_CHAT_ID = "7260ad85-0bac-495e-a78a-03268e7b5840";
// Javni kanal hrani in prikazuje največ zadnjih 300 vrstic; starejše se sproti brišejo.
export const PUBLIC_CHAT_LIMIT = 300;

async function ensurePublicGroup() {
  const groups = db.entities.ChatGroup;
  const exists = async () => (await groups.filter({ id: PUBLIC_CHAT_ID }, "-created_date", 1)).length > 0;
  if (await exists()) return;
  try {
    await groups.create({ id: PUBLIC_CHAT_ID, name: "Splošno", member_ids: [], member_count: 0 });
  } catch (error) {
    // Another client can create the same room between the lookup and insert.
    if (!(await exists())) throw error;
  }
}

async function prunePublicChat() {
  try {
    const all = await db.entities.GroupMessage.filter({ group_id: PUBLIC_CHAT_ID }, "-created_date", PUBLIC_CHAT_LIMIT + 200);
    const extra = (all || []).slice(PUBLIC_CHAT_LIMIT);
    await Promise.all(extra.map((m) => db.entities.GroupMessage.delete(m.id).catch(() => {})));
  } catch {
    // Brisanje starih vrstic ni kritično; poskusi ob naslednjem pošiljanju.
  }
}

export default function PublicChat({ profile, language, isOnline, searchQuery = "" }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const log = useRef(null);
  const follow = useRef(true);
  const revision = useRef(0);
  const sl = language === "sl";

  useEffect(() => {
    let stopped = false;
    let timer;
    async function refresh() {
      const startedAt = revision.current;
      try {
        const latest = await db.entities.GroupMessage.filter({ group_id: PUBLIC_CHAT_ID }, "-created_date", PUBLIC_CHAT_LIMIT);
        if (stopped) return;
        if (startedAt === revision.current) setMessages(latest.reverse());
        setLoadFailed(false);
      } catch {
        if (!stopped) setLoadFailed(true);
      } finally {
        if (!stopped) {
          setLoading(false);
          timer = window.setTimeout(refresh, 2000);
        }
      }
    }
    void refresh();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (follow.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !isOnline || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setSendFailed(false);
    try {
      await ensurePublicGroup();
      const message = await db.entities.GroupMessage.create({
        group_id: PUBLIC_CHAT_ID,
        sender_profile_id: profile.id,
        sender_name: profile.display_name,
        content,
      });
      revision.current += 1;
      follow.current = true;
      setMessages((current) => [...current.filter((item) => item.id !== message.id), message].slice(-PUBLIC_CHAT_LIMIT));
      setDraft("");
      void prunePublicChat();
    } catch {
      setSendFailed(true);
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  const q = searchQuery.trim().toLocaleLowerCase("sl");
  const visibleMessages = messages
    .filter((item) => !profile.blocked_users?.includes(item.sender_profile_id))
    .filter((item) => !q || String(item.content || "").toLocaleLowerCase("sl").includes(q) || String(item.sender_name || "").toLocaleLowerCase("sl").includes(q));

  return (
    <>
      <div className="k-phead">
        <b>{sl ? "# Splošno" : "# General"}</b>
        <span className="k-meta">· {sl ? "javni kanal" : "public channel"} · {visibleMessages.length} {sl ? "sporočil" : "messages"}{q ? ` (${sl ? "filter" : "filter"} »${searchQuery.trim()}«)` : ""}</span>
      </div>
      <div
        ref={log}
        onScroll={(event) => {
          const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
          follow.current = scrollHeight - scrollTop - clientHeight < 64;
        }}
        role="log"
        aria-label={sl ? "Sporočila" : "Messages"}
        className="k-log chat-scroll"
      >
        {loading && <p className="k-empty-msg">{sl ? "Nalagam sporočila …" : "Loading messages …"}</p>}
        {loadFailed && <p role="status" className="k-empty-msg">{sl ? "Sporočil ni bilo mogoče naložiti. Poskušam znova …" : "Could not load messages. Retrying …"}</p>}
        {!loading && !loadFailed && visibleMessages.length === 0 && (
          <p className="k-empty-msg">{q ? (sl ? "Ni zadetkov." : "No matches.") : sl ? "Napiši prvo sporočilo." : "Send the first message."}</p>
        )}
        {visibleMessages.map((message) => (
          <div key={message.id} className={`k-msg${message.sender_profile_id === profile.id ? " k-me" : ""}`}>
            <time dateTime={message.created_date} className="k-t">
              {new Date(message.created_date).toLocaleTimeString(sl ? "sl-SI" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
            </time>
            <span className="k-n" title={message.sender_name}>{message.sender_name}</span>
            <p className="k-m" style={{ margin: 0 }}>{message.content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={send} className={`k-compose${sendFailed ? " k-tall" : ""}`}>
        {sendFailed && <p role="alert" className="k-err" style={{ width: "100%", margin: 0 }}>{sl ? "Pošiljanje ni uspelo. Poskusi znova." : "Could not send the message. Try again."}</p>}
        <input
          aria-label={sl ? "Sporočilo" : "Message"}
          placeholder={sl ? "Napiši sporočilo … (Enter pošlje)" : "Write a message … (Enter sends)"}
          className="k-inp"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          readOnly={sending}
          maxLength={2000}
        />
        <button type="submit" className="k-btn k-pri" disabled={!draft.trim() || sending || !isOnline}>
          {sl ? "Pošlji" : "Send"}
        </button>
      </form>
    </>
  );
}
