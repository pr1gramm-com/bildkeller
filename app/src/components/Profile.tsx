"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ago, getMe, mediaUrl } from "@/lib/client/api";
import { markColor } from "@/lib/marks";

type Thumb = { id: number; thumb: string };
type Col = { id: number; name: string; itemCount: number; items: Thumb[] };
type Cmt = { id: number; content: string; created: number; itemId: number; up: number; down: number };
type Info = {
  user: { name: string; score: number; registered: number; mark: number };
  uploads: Thumb[]; uploadCount: number; commentCount: number; followCount: number;
  following: boolean; blocked: boolean; comments: Cmt[]; collections: Col[];
};

export default function Profile({ name }: { name: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const me = getMe();
  const load = useCallback(() => api.get("profile/info", { name, flags: 31 }).then(setInfo).catch((e) => setError(e.message)), [name]);
  useEffect(() => { void load(); }, [load]);

  const act = (path: string) => api.post(path, { name }).then(load).catch(() => undefined);
  async function message() {
    const text = window.prompt(`Nachricht an ${name}:`);
    if (text) await api.post("inbox/post", { to: name, comment: text }).catch((e) => window.alert(e.message));
  }

  if (error) return <p className="err">{error}</p>;
  if (!info) return <p className="dim">Lade…</p>;
  const self = me?.n.toLowerCase() === info.user.name.toLowerCase();

  const years = Math.floor((Date.now() / 1000 - info.user.registered) / 31557600);
  const since = new Date(info.user.registered * 1000).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="user-page">
      <h1 className="user-head">
        {info.user.name}
        {me && !self && (
          <span className="user-actions">
            <button className="user-action" onClick={() => act(info.following ? "profile/unfollow" : "profile/follow")}>{info.following ? "entfolgen" : "folgen"}</button>
            <button className="user-action" onClick={message}>private Nachricht senden</button>
            <button className="user-action" onClick={() => act(info.blocked ? "profile/unblock" : "profile/block")}>{info.blocked ? "entblocken" : "blockieren"}</button>
          </span>
        )}
      </h1>
      <div className="user-stats">
        <div className="user-score-pane">BENIS <span className="user-score">{info.user.score}</span></div>
        <div>Gewachsen seit {since}{years > 0 ? ` (${years} Jahren)` : ""}</div>
      </div>
      <div className="user-counts">
        <span>Hochlads <em>{info.uploadCount}</em></span>
        <span>Sammlungen <em>{info.collections.length}</em></span>
        <span>Kommentare <em>{info.commentCount}</em></span>
        <span>Follower <em>{info.followCount}</em></span>
        <span className="user-mark" style={{ color: markColor(info.user.mark) }}>●</span>
      </div>
      <h2 className="section">Neueste Hochlads</h2>
      <div className="grid">{info.uploads.map((u) => <Link key={u.id} className="tile" href={`/item/${u.id}`}><img src={mediaUrl(u.thumb)} alt="" /></Link>)}</div>
      {info.collections.map((c) => (
        <section key={c.id}>
          <h2 className="section">
            Sammlung: {c.name}
            {me && !self && <button className="user-action" onClick={() => api.post("collections/follow", { collectionId: c.id }).catch(() => undefined)}>folgen</button>}
          </h2>
          <div className="grid">{c.items.map((i) => <Link key={i.id} className="tile" href={`/item/${i.id}`}><img src={mediaUrl(i.thumb)} alt="" /></Link>)}</div>
        </section>
      ))}
      <h2 className="section">Neueste Kommentare</h2>
      <div className="comments">
        {info.comments.map((c) => (
          <div key={c.id} className="comment plain">
            <div className="comment-content">{c.content}</div>
            <div className="comment-foot">
              <span className="score">{c.up - c.down} Benis</span>
              <span className="time">{ago(c.created)}</span>
              <Link href={`/item/${c.itemId}`} className="hot">Beitrag {c.itemId}</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
