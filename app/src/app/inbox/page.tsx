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
  useEffect(() => { if (!peer && convs.length > 0) setPeer(convs[0].name); }, [convs, peer]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!peer || !text.trim()) return;
    await api.post("inbox/post", { to: peer, comment: text }).catch((er) => setError(er.message));
    setText("");
    setMsgs((await api.get("inbox/messages", { with: peer })).messages);
  }

  if (error) return <p className="err">{error}</p>;
  return (
    <>
      <h1 className="pane-head">Nachrichten</h1>
      <div className="tab-bar">
        <nav>
          <button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}>Private Nachrichten</button>
          <button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}>Benachrichtigungen</button>
        </nav>
      </div>
      <div className="pane wide">
        {tab === "messages" ? (
          <div className="inbox-layout">
            <div className="conversations-pane">
              {convs.length === 0 && <span className="dim">Keine Unterhaltungen.</span>}
              {convs.map((c) => (
                <button
                  key={c.name}
                  className={`conv-item${c.name === peer ? " active" : ""}`}
                  title={c.lastMessagePreview}
                  onClick={() => setPeer(c.name)}
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
                    <textarea placeholder={`Nachricht an ${peer} schreiben`} value={text} onChange={(e) => setText(e.target.value)} />
                    <div><button className="primary">Abschicken</button></div>
                  </form>
                  <div className="inbox-messages">
                    {msgs.map((m) => (
                      <div key={m.id} className={`pm-message${m.sent ? " mine" : ""}`}>
                        <p className="pm-text">{m.message}</p>
                        <div className="pm-meta">{m.sent ? getMe()?.n : peer} <span style={{ color: "#5bb91c" }}>●</span> {ago(m.created)}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <span className="dim">Wähle eine Unterhaltung.</span>
              )}
            </div>
          </div>
        ) : (
          <div>
            {notes.length === 0 && <span className="dim">Nichts Neues.</span>}
            {notes.map((n) => (
              <div key={n.id} className="notification">
                {n.type === "follow" ? <Link href={`/user/${n.name}`}>{n.name} folgt dir</Link> : <Link href={`/item/${n.itemId}`}>{n.name} ({n.type})</Link>}
                <span className="time"> {ago(n.created)}</span>
                {n.content && <div className="pm-text">{n.content}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
