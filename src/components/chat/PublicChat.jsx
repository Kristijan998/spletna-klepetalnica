import { useEffect, useRef, useState } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const PUBLIC_CHAT_ID = "7260ad85-0bac-495e-a78a-03268e7b5840";

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

export default function PublicChat({ profile, language, isOnline }) {
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
        const latest = await db.entities.GroupMessage.filter({ group_id: PUBLIC_CHAT_ID }, "-created_date", 100);
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
      setMessages((current) => [...current.filter((item) => item.id !== message.id), message].slice(-100));
      setDraft("");
    } catch {
      setSendFailed(true);
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  const visibleMessages = messages.filter((item) => !profile.blocked_users?.includes(item.sender_profile_id));

  return (
    <section aria-labelledby="public-chat-title" className="flex h-[max(25rem,calc(100dvh-12rem))] min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground dark:border-gray-700 dark:bg-gray-800">
      <header className="border-b px-4 py-3">
        <h2 id="public-chat-title" className="text-lg font-semibold"># {sl ? "Splošno" : "General"}</h2>
      </header>
      <div
        ref={log}
        onScroll={(event) => {
          const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
          follow.current = scrollHeight - scrollTop - clientHeight < 64;
        }}
        role="log"
        aria-label={sl ? "Sporočila" : "Messages"}
        className="flex-1 space-y-2 overflow-y-auto p-4 text-sm"
      >
        {loading && <p className="text-muted-foreground">{sl ? "Nalagam sporočila …" : "Loading messages …"}</p>}
        {loadFailed && <p role="status" className="text-muted-foreground">{sl ? "Sporočil ni bilo mogoče naložiti. Poskušam znova …" : "Could not load messages. Retrying …"}</p>}
        {!loading && !loadFailed && visibleMessages.length === 0 && (
          <p className="text-muted-foreground">{sl ? "Napiši prvo sporočilo." : "Send the first message."}</p>
        )}
        {visibleMessages.map((message) => (
          <div key={message.id} className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-x-2 sm:grid-cols-[3rem_minmax(5rem,8rem)_minmax(0,1fr)]">
            <time dateTime={message.created_date} className="text-xs tabular-nums text-muted-foreground">
              {new Date(message.created_date).toLocaleTimeString(sl ? "sl-SI" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
            </time>
            <span className="break-all font-semibold text-violet-700 dark:text-violet-300">{message.sender_name}</span>
            <p className="col-start-2 whitespace-pre-wrap break-words sm:col-start-3">{message.content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="border-t p-3">
        {sendFailed && <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">{sl ? "Pošiljanje ni uspelo. Poskusi znova." : "Could not send the message. Try again."}</p>}
        <div className="flex gap-2">
          <Input
            aria-label={sl ? "Sporočilo" : "Message"}
            placeholder={sl ? "Napiši sporočilo …" : "Write a message …"}
            className="h-10 min-w-0 bg-background text-base dark:bg-gray-900 sm:text-sm"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            readOnly={sending}
            maxLength={2000}
          />
          <Button type="submit" disabled={!draft.trim() || sending || !isOnline} className="h-10 bg-violet-700 text-white hover:bg-violet-800">
            {sl ? "Pošlji" : "Send"}
          </Button>
        </div>
      </form>
    </section>
  );
}
