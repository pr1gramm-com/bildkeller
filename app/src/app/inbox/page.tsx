"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ago, getMe } from "@/lib/client/api";

type Conv = { name: string; unreadCount: number; lastMessagePreview: string; lastMessage: number };
type Msg = { id: number; created: number; sent: number; message: string };
type Note = { id: number; type: string; created: number; name?: string; content?: string; itemId?: number };

export default function Inbox() {
  const [tab, setTab] = useState<"messages" | "notifications">("messages");
  const [convs, setConvs] = useState<Conv[]>([]);
  const [peer, setPeer] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const loadConvs = useCallback(() => api.get("inbox/conversations").then((r) => setConvs(r.conversations)).catch((e) => setError(e.message)), []);
  useEffect(() => { if (getMe()) void loadConvs(); else setError("Bitte einloggen."); }, [loadConvs]);
  useEffect(() => { if (tab === "notifications") api.get("inbox/notifications").then((r) => setNotes(r.messages)).catch(() => undefined); }, [tab]);
  useEffect(() => { if (peer) api.get("inbox/messages", { with: peer }).then((r) => { setMsgs(r.messages); void loadConvs(); }).catch(() => undefined); }, [peer, loadConvs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!peer || !text.trim()) return;
    await api.post("inbox/post", { to: peer, comment: text }).catch((er) => setError(er.message));
    setText("");
    setMsgs((await api.get("inbox/messages", { with: peer })).messages);
  }

  if (error) return <p className="err">{error}</p>;
  return (
    <div>
      <div className="tabs">
        <button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}>Nachrichten</button>
        <button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}>Benachrichtigungen</button>
      </div>
      {tab === "messages" && (
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="panel" style={{ minWidth: 220 }}>
            {convs.length === 0 && <span className="dim">Keine Unterhaltungen.</span>}
            {convs.map((c) => (
              <div key={c.name}><button style={{ width: "100%", textAlign: "left", marginBottom: 4 }} onClick={() => setPeer(c.name)}>
                {c.name} {c.unreadCount > 0 && <span className="badge">{c.unreadCount}</span>}<br /><span className="dim">{c.lastMessagePreview}</span>
              </button></div>
            ))}
          </div>
          {peer && (
            <div className="panel" style={{ flex: 1 }}>
              <h3 style={{ marginTop: 0 }}>{peer}</h3>
              {msgs.map((m) => <p key={m.id} style={{ textAlign: m.sent ? "right" : "left" }}><span className="dim">{ago(m.created)}</span><br />{m.message}</p>)}
              <form className="row" onSubmit={send}><input style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Nachricht schreiben…" /><button className="primary">Senden</button></form>
            </div>
          )}
        </div>
      )}
      {tab === "notifications" && (
        <div>
          {notes.length === 0 && <span className="dim">Nichts Neues.</span>}
          {notes.map((n) => (
            <div key={n.id} className="comment">
              <div className="meta">{n.type === "follow" ? <Link href={`/user/${n.name}`}>{n.name} folgt dir</Link> : <Link href={`/item/${n.itemId}`}>{n.name} ({n.type})</Link>}<span>{ago(n.created)}</span></div>
              {n.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
