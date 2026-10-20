"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ago, useMe, mediaUrl } from "@/lib/client/api";
import { backgroundOf } from "@/lib/backgrounds";
import AvatarEditor from "./AvatarEditor";
import UserComments from "./UserComments";
import { usePreferences } from "@/lib/client/preferences";
import { avatarPath } from "@/lib/avatar-path";

type Thumb = { id: number; thumb: string };
type Col = { id: number; name: string; itemCount: number; items: Thumb[]; isPublic: number; isDefault: number; subscribed: boolean };
type Cmt = { id: number; content: string; created: number; itemId: number; up: number; down: number; thumb?: string };
type Info = {
  user: { name: string; score: number; registered: number; mark: number; inactive: number; avatar: string | null };
  status: string;
  background: string;
  uploads: Thumb[]; uploadCount: number; commentCount: number; followCount: number; commentLikesCount: number;
  following: boolean; blocked: boolean; likesArePublic: boolean; comments: Cmt[]; collections: Col[]; commentLikes: Cmt[];
};

export default function Profile({ name, section = "overview" }: { name: string; section?: "overview" | "collections" | "comments" | "likes" }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingCollection, setPendingCollection] = useState<number | null>(null);
  const me = useMe();
  const preferences = usePreferences();
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

  const act = (path: string) => api.post(path, { name }).then(() => { window.dispatchEvent(new Event("bildkeller:blocks")); return load(); }).catch((e) => setActionError(e.message));
  async function followCollection(collection: Col) {
    setPendingCollection(collection.id); setActionError("");
    try {
      await api.post(collection.subscribed ? "collections/unfollow" : "collections/follow", { collectionId: collection.id });
      await load();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Fehler"); }
    finally { setPendingCollection(null); }
  }


  if (error) return <p className="err">{error}</p>;
  if (!info) return <p className="dim">Lade…</p>;
  const self = me?.n.toLowerCase() === info.user.name.toLowerCase();
  const bg = backgroundOf(info.background);

  const years = Math.floor((Date.now() / 1000 - info.user.registered) / 31557600);
  const since = new Date(info.user.registered * 1000).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="user-page" style={bg.css ? { backgroundImage: bg.css } : undefined}>
      <div className="profile-heading">
      {self ? <AvatarEditor onChange={() => { void load(); }} /> : preferences.showAvatars && avatarPath(info.user.avatar) && <img className="profile-avatar" src={mediaUrl(info.user.avatar!)} alt={`Avatar von ${info.user.name}`} />}
      <h1 className="user-head">
        {info.user.name}
        {info.user.inactive ? <span className="dim user-inactive"> inaktiv</span> : null}
        {me && !self && (
          <span className="user-actions">
            <button className="user-action" onClick={() => act(info.following ? "profile/unfollow" : "profile/follow")}>{info.following ? "entfolgen" : "folgen"}</button>
            <Link className="user-action" href={`/inbox/messages/${encodeURIComponent(info.user.name)}`}>private Nachricht senden</Link>
            <button className="user-action" onClick={() => act(info.blocked ? "profile/unblock" : "profile/block")}>{info.blocked ? "entblocken" : "blockieren"}</button>
          </span>
        )}
      </h1>
      </div>
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
      <nav className="profile-tabs" aria-label="Profilbereiche">
        <Link href={`/user/${encodeURIComponent(info.user.name)}`} aria-current={section === "overview" ? "page" : undefined}>Hochlads <em>{info.uploadCount}</em></Link>
        <Link href={`/user/${encodeURIComponent(info.user.name)}/collections`} aria-current={section === "collections" ? "page" : undefined}>Sammlungen <em>{info.collections.length}</em></Link>
        <Link href={`/user/${encodeURIComponent(info.user.name)}/comments`} aria-current={section === "comments" ? "page" : undefined}>Kommentare <em>{info.commentCount}</em></Link>
        {(self || info.likesArePublic) && <Link href={`/user/${encodeURIComponent(info.user.name)}/likes`} aria-current={section === "likes" ? "page" : undefined}>Kommentar-Favoriten</Link>}
      </nav>
      {actionError && <p className="err" role="alert">{actionError}</p>}
      <div className="profile-content">
      {(section === "comments" || section === "likes") ? <UserComments name={info.user.name} likes={section === "likes"} /> : <>
      {section === "overview" && <>
      <h2 className="section">
        Neueste Hochlads
        <Link className="section-link" href={`/user/${encodeURIComponent(info.user.name)}/uploads`}>Alle Hochlads…</Link>
      </h2>
      <div className="grid">{info.uploads.map((u) => <Link key={u.id} className="tile" href={`/user/${encodeURIComponent(info.user.name)}/uploads/${u.id}`}><img src={mediaUrl(u.thumb)} alt="" /></Link>)}</div>
      </>}
      <div className={section === "overview" ? "classic-profile-details" : "profile-collections"}>
      {info.collections.map((c) => (
        <section key={c.id}>
          <h2 className="section">
            Sammlung: {c.name} <span className="section-meta">({c.isPublic ? "öffentlich" : "privat"}{c.isDefault ? ", standard" : ""})</span>
            {me && !self && <button className="user-action" disabled={pendingCollection === c.id} aria-pressed={c.subscribed} onClick={() => followCollection(c)}>{c.subscribed ? "entfolgen" : "folgen"}</button>}
            <Link className="section-link" href={`/user/${info.user.name}/collections/${c.id}`}>Alle Hochlads in dieser Sammlung…</Link>
          </h2>
          <div className="grid">{c.items.map((i) => <Link key={i.id} className="tile" href={`/user/${encodeURIComponent(info.user.name)}/collections/${c.id}/${i.id}`}><img src={mediaUrl(i.thumb)} alt="" /></Link>)}</div>
        </section>
      ))}
      {section === "overview" && <>
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
              <Link href={`/item/${c.itemId}:comment${c.id}`} className="hot">Beitrag {c.itemId}</Link>
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
                  <Link href={`/item/${c.itemId}:comment${c.id}`} className="hot">Beitrag {c.itemId}</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      </>}
      </div>
      </>}
      </div>
    </div>
  );
}
