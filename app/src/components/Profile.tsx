"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ago, getMe, mediaUrl } from "@/lib/client/api";

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
  const [tab, setTab] = useState<"uploads" | "comments" | "collections">("uploads");
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

  return (
    <div>
      <div className="panel row" style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>{info.user.name}</h2>
        <span>Benis <b>{info.user.score}</b></span>
        <span className="dim">dabei seit {new Date(info.user.registered * 1000).toLocaleDateString("de")}</span>
        <span className="dim">{info.followCount} Follower</span>
        {me && !self && (
          <span className="row" style={{ marginLeft: "auto" }}>
            <button onClick={() => act(info.following ? "profile/unfollow" : "profile/follow")}>{info.following ? "Entfolgen" : "Folgen"}</button>
            <button onClick={message}>Nachricht</button>
            <button onClick={() => act(info.blocked ? "profile/unblock" : "profile/block")}>{info.blocked ? "Entblocken" : "Blocken"}</button>
          </span>
        )}
      </div>
      <div className="tabs">
        <button className={tab === "uploads" ? "active" : ""} onClick={() => setTab("uploads")}>Uploads ({info.uploadCount})</button>
        <button className={tab === "comments" ? "active" : ""} onClick={() => setTab("comments")}>Kommentare ({info.commentCount})</button>
        <button className={tab === "collections" ? "active" : ""} onClick={() => setTab("collections")}>Sammlungen ({info.collections.length})</button>
      </div>
      {tab === "uploads" && (
        <div className="grid">{info.uploads.map((u) => <Link key={u.id} className="tile" href={`/item/${u.id}`}><img src={mediaUrl(u.thumb)} alt="" /></Link>)}</div>
      )}
      {tab === "comments" && info.comments.map((c) => (
        <div key={c.id} className="comment"><div className="meta"><Link href={`/item/${c.itemId}`}>Beitrag {c.itemId}</Link><span>{ago(c.created)}</span><span>▲{c.up} ▼{c.down}</span></div>{c.content}</div>
      ))}
      {tab === "collections" && info.collections.map((c) => (
        <div key={c.id} className="panel" style={{ marginBottom: ".8rem" }}>
          <div className="row"><b>{c.name}</b><span className="dim">{c.itemCount} Beiträge</span>
            {me && !self && <button onClick={() => api.post("collections/follow", { collectionId: c.id }).catch(() => undefined)}>Folgen</button>}
          </div>
          <div className="grid" style={{ marginTop: ".5rem" }}>{c.items.map((i) => <Link key={i.id} className="tile" href={`/item/${i.id}`}><img src={mediaUrl(i.thumb)} alt="" /></Link>)}</div>
        </div>
      ))}
    </div>
  );
}
