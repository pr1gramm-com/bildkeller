"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ago, useMe, mediaUrl } from "@/lib/client/api";
import { backgroundOf } from "@/lib/backgrounds";

type Thumb = { id: number; thumb: string };
type Col = { id: number; name: string; itemCount: number; items: Thumb[]; isPublic: number; isDefault: number };
type Cmt = { id: number; content: string; created: number; itemId: number; up: number; down: number; thumb?: string };
type Info = {
  user: { name: string; score: number; registered: number; mark: number; inactive: number };
  status: string;
  background: string;
  uploads: Thumb[]; uploadCount: number; commentCount: number; followCount: number; commentLikesCount: number;
  following: boolean; blocked: boolean; likesArePublic: boolean; comments: Cmt[]; collections: Col[]; commentLikes: Cmt[];
};

export default function Profile({ name }: { name: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const me = useMe();
  const load = useCallback(
    () =>
      Promise.all([
        api.get("profile/info", { name, flags: 31 }),
        api.get("profile/commentlikes", { name }).catch(() => ({ comments: [] })),
      ])
        .then(([i, likes]) => setInfo({ ...i, commentLikes: likes.comments ?? [] }))
        .catch((e) => setError(e.message)),
    [name],
  );
  useEffect(() => { void load(); }, [load]);

  const act = (path: string) => api.post(path, { name }).then(load).catch(() => undefined);
  async function message() {
    const text = window.prompt(`Nachricht an ${name}:`);
    if (text) await api.post("inbox/post", { to: name, comment: text }).catch((e) => window.alert(e.message));
  }

  if (error) return <p className="err">{error}</p>;
  if (!info) return <p className="dim">Lade…</p>;
  const self = me?.n.toLowerCase() === info.user.name.toLowerCase();
  const bg = backgroundOf(info.background);

  const years = Math.floor((Date.now() / 1000 - info.user.registered) / 31557600);
  const since = new Date(info.user.registered * 1000).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="user-page" style={bg.css ? { backgroundImage: bg.css } : undefined}>
      <h1 className="user-head">
        {info.user.name}
        {info.user.inactive ? <span className="dim user-inactive"> inaktiv</span> : null}
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
        <div>{info.status}</div>
      </div>
      <div className="user-counts">
        <span>Hochlads <em>{info.uploadCount}</em></span>
        <span>Sammlungen <em>{info.collections.length}</em></span>
        <span>Kommentare <em>{info.commentCount}</em></span>
        <span>Follower <em>{info.followCount}</em></span>
      </div>
      <h2 className="section">
        Neueste Hochlads
        <Link className="section-link" href={`/user/${info.user.name}/uploads`}>Alle Hochlads…</Link>
      </h2>
      <div className="grid">{info.uploads.map((u) => <Link key={u.id} className="tile" href={`/item/${u.id}`}><img src={mediaUrl(u.thumb)} alt="" /></Link>)}</div>
      {info.collections.map((c) => (
        <section key={c.id}>
          <h2 className="section">
            Sammlung: {c.name} <span className="section-meta">({c.isPublic ? "öffentlich" : "privat"}{c.isDefault ? ", standard" : ""})</span>
            {me && !self && <button className="user-action" onClick={() => api.post("collections/follow", { collectionId: c.id }).catch(() => undefined)}>folgen</button>}
            <Link className="section-link" href={`/user/${info.user.name}/collections/${c.id}`}>Alle Hochlads in dieser Sammlung…</Link>
          </h2>
          <div className="grid">{c.items.map((i) => <Link key={i.id} className="tile" href={`/item/${i.id}`}><img src={mediaUrl(i.thumb)} alt="" /></Link>)}</div>
        </section>
      ))}
      <h2 className="section">
        Neueste Kommentare
        <Link className="section-link" href={`/user/${info.user.name}/comments`}>Alle Kommentare…</Link>
      </h2>
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
      {(self || info.likesArePublic) && (
        <>
          <h2 className="section">
            Neueste Kommentar-Favoriten
            <Link className="section-link" href={`/user/${info.user.name}/likes`}>Alle Kommentar-Favoriten…</Link>
          </h2>
          <div className="comments">
            {info.commentLikes.length === 0 && <span className="dim">Keine Favoriten.</span>}
            {info.commentLikes.map((c) => (
              <div key={c.id} className="comment plain">
                <div className="comment-content">{c.content}</div>
                <div className="comment-foot">
                  <span className="time">{ago(c.created)}</span>
                  <Link href={`/item/${c.itemId}`} className="hot">Beitrag {c.itemId}</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
