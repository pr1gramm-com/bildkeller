"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ago, getMe, useMe, mediaUrl } from "@/lib/client/api";

type Conv = { name: string; unreadCount: number; lastMessagePreview: string; lastMessage: number; blocked: number };
type Msg = { id: number; created: number; sent: number; message: string };
type Note = { id: number; type: string; created: number; name?: string; content?: string; itemId?: number; thumb?: string; commentId?: number };
type Digest = { id: number; thumb: string; user: string; score: number; created: number };
type Blocked = { name: string; mark: number };

const TABS = [
  { href: "/inbox/all", label: "Alle" },
  { href: "/inbox/comments", label: "Kommentare" },
  { href: "/inbox/notifications", label: "Systembenachrichtigungen" },
  { href: "/inbox/digests", label: "Highlights" },
  { href: "/inbox/follows", label: "Stelz-Abos" },
  { href: "/inbox/messages", label: "Private Nachrichten" },
  { href: "/inbox/blocklist", label: "Blockierungen" },
];

export default function Inbox({ tab, peer: initialPeer }: { tab: string; peer?: string }) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [peer, setPeer] = useState<string | null>(initialPeer ?? null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [before, setBefore] = useState(0);
  const [atEnd, setAtEnd] = useState(true);
  const router = useRouter();
  const me = useMe();

  const loadConvs = useCallback(() => api.get("inbox/conversations").then((r) => setConvs(r.conversations)).catch((e) => setError(e.message)), []);
  useEffect(() => { if (getMe()) void loadConvs(); else setError("Bitte einloggen."); }, [loadConvs]);
  useEffect(() => {
    if (tab === "notifications" || tab === "all" || tab === "comments") {
      api.get(`inbox/${tab}`).then((r) => { setNotes(r.messages ?? []); setBefore(r.before ?? 0); setAtEnd(r.atEnd ?? true); }).catch((e) => setError(e.message));
    }
    if (tab === "digests") api.get("inbox/digests").then((r) => setDigests(r.digests ?? [])).catch(() => undefined);
    if (tab === "follows") api.get("inbox/stalk").then((r) => setNotes(r.messages ?? [])).catch(() => undefined);
    if (tab === "blocklist") api.get("user/blocklist").then((r) => setBlocked(r.blocked ?? [])).catch(() => undefined);
  }, [tab]);
  useEffect(() => { if (tab === "messages" && peer) api.get("inbox/messages", { with: peer }).then((r) => { setMsgs(r.messages); void loadConvs(); }).catch((e) => setError(e.message)); }, [tab, peer, loadConvs]);
  useEffect(() => { if (tab === "messages" && !peer && convs.length > 0) setPeer(convs[0].name); }, [tab, convs, peer]);
  useEffect(() => { if (initialPeer) setPeer(initialPeer); }, [initialPeer]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!peer || !text.trim() || sending) return;
    setSending(true); setError("");
    try {
      await api.post("inbox/post", { to: peer, comment: text });
      setText("");
      setMsgs((await api.get("inbox/messages", { with: peer })).messages);
      await loadConvs();
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler"); }
    finally { setSending(false); }
  }

  return (
    <>
      <h1 className="pane-head">Nachrichten</h1>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="tab-bar">
        <nav>
          {TABS.map((t) => (
            <a key={t.href} href={t.href} className={tab === t.href.split("/").pop() ? "active" : ""}>{t.label}</a>
          ))}
        </nav>
      </div>
      <div className="pane wide">
        {tab === "messages" ? (
          <div className="inbox-layout">
            <div className="conversations-pane">
              <form className="stack" onSubmit={(e) => {
                e.preventDefault();
                if (!recipient.trim()) return;
                setError("");
                router.push(`/inbox/messages/${encodeURIComponent(recipient.trim())}`);
              }}>
                <input aria-label="Empfänger" placeholder="Nutzername" value={recipient} onChange={(e) => setRecipient(e.target.value)} required />
                <button>Neue Nachricht</button>
              </form>
              {convs.length === 0 && <span className="dim">Keine Unterhaltungen.</span>}
              {convs.map((c) => (
                <button
                  key={c.name}
                  className={`conv-item${c.name === peer ? " active" : ""}`}
                  title={c.lastMessagePreview}
                  onClick={() => { setError(""); router.push(`/inbox/messages/${encodeURIComponent(c.name)}`); }}
                >
                  {c.name}{c.unreadCount > 0 && <span className="dot">●</span>}
                  <span className="time">{ago(c.lastMessage)}</span>
                </button>
              ))}
            </div>
            <div className="private-messages">
              {peer ? (
                <>
                  <div className="pm-head">
                    <span>Unterhaltung mit <Link href={`/user/${peer}`} className="user">{peer}</Link> <span className="dot" style={{ color: "#5bb91c" }}>●</span></span>
                  </div>
                  <form className="private-message-form" onSubmit={send}>
                    <textarea maxLength={2000} required placeholder={`Nachricht an ${peer} schreiben`} value={text} onChange={(e) => setText(e.target.value)} />
                    <div><button className="primary" disabled={sending}>Abschicken</button></div>
                  </form>
                  <div className="inbox-messages">
                    {msgs.map((m) => (
                      <div key={m.id} className={`pm-message${m.sent ? " mine" : ""}`}>
                        <p className="pm-text">{m.message}</p>
                        <div className="pm-meta">{m.sent ? me?.n : peer} <span style={{ color: "#5bb91c" }}>●</span> {ago(m.created)}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <span className="dim">Wähle eine Unterhaltung.</span>
              )}
            </div>
          </div>
        ) : tab === "blocklist" ? (
          <div>
            {blocked.length === 0 && <span className="dim">Du blockierst niemanden.</span>}
            {blocked.map((b) => (
              <div key={b.name} className="notification">
                <Link href={`/user/${b.name}`}>{b.name}</Link>
                <button className="link hot" onClick={() => api.post("profile/unblock", { name: b.name }).then(() => api.get("user/blocklist").then((r) => setBlocked(r.blocked ?? [])))}>Blockierung aufheben</button>
              </div>
            ))}
          </div>
        ) : tab === "digests" ? (
          <div>
            {digests.length === 0 && <span className="dim">Noch keine Highlights.</span>}
            <div className="grid">
              {digests.map((d) => (
                <Link key={d.id} className="tile" href={`/item/${d.id}`} title={`${d.user} · ${d.score} Benis`}>
                  <img src={mediaUrl(d.thumb)} alt="" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="inbox-messages">
            {notes.length === 0 && <span className="dim">Nichts Neues.</span>}
            {notes.map((n) => (
              <div key={n.id} className="notification">
                {n.type === "follow" ? (
                  <><Link href={`/user/${n.name}`}>{n.name}</Link> folgt dir</>
                ) : n.type === "system" ? (
                  <><span>Systembenachrichtigung</span><div className="pm-text">{n.content}</div></>
                ) : n.thumb ? (
                  <Link href={`/item/${n.itemId}${n.commentId ? `:comment${n.commentId}` : ""}`} className="inbox-note">
                    <img className="comment-thumb" src={mediaUrl(n.thumb)} alt="" />
                    <span className="pm-text">{n.content}</span>
                  </Link>
                ) : (
                  <Link href={`/item/${n.itemId}`}>{n.name} ({n.type})</Link>
                )}
                <span className="time"> {ago(n.created)}</span>
              </div>
            ))}
            {!atEnd && <button onClick={() => {
              void api.get(`inbox/${tab}`, { before }).then((r) => {
                setNotes((old) => [...old, ...(r.messages ?? [])]); setBefore(r.before ?? 0); setAtEnd(r.atEnd ?? true);
              }).catch((e) => setError(e.message));
            }}>Ältere Nachrichten</button>}
          </div>
        )}
      </div>
    </>
  );
}
