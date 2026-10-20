"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ago, mediaUrl } from "@/lib/client/api";

type Cmt = { id: number; content: string; created: number; itemId: number; up: number; down: number; thumb?: string };

/** "Alle Kommentare…" / "Alle Kommentar-Favoriten…" of a profile. */
export default function UserComments({ name, likes }: { name: string; likes?: boolean }) {
  const [comments, setComments] = useState<Cmt[]>([]);
  const [error, setError] = useState("");
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const path = likes ? "profile/commentlikes" : "profile/comments";
    setError("");
    api.get(path, { name })
      .then((r) => { setComments(r.comments ?? []); setHasOlder(r.hasOlder ?? false); })
      .catch((e) => setError(e.message));
  }, [name, likes]);

  if (error) return <p className="err">{error}</p>;
  return (
    <>
      <h1 className="pane-head">{likes ? "Kommentar-Favoriten" : `Kommentare von ${name}`}</h1>
      <div className="pane">
        <div className="comments">
          {comments.length === 0 && <span className="dim">Keine Kommentare.</span>}
          {comments.map((c) => (
            <div key={c.id} className="comment plain">
              {c.thumb && <Link href={`/item/${c.itemId}`}><img className="comment-thumb" src={mediaUrl(c.thumb)} alt="" /></Link>}
              <div className="comment-content">{c.content}</div>
              <div className="comment-foot">
                <span className="score">{c.up - c.down} Benis</span>
                <span className="time">{ago(c.created)}</span>
              <Link href={`/item/${c.itemId}:comment${c.id}`} className="hot">Beitrag {c.itemId}</Link>
              </div>
            </div>
          ))}
          {hasOlder && <button disabled={loading} onClick={() => {
            setLoading(true);
            void api.get(likes ? "profile/commentlikes" : "profile/comments", { name, before: comments.at(-1)?.id ?? 0 }).then((r) => {
              setComments((old) => [...old, ...(r.comments ?? [])]); setHasOlder(r.hasOlder ?? false);
            }).catch((e) => setError(e.message)).finally(() => setLoading(false));
          }}>Ältere Kommentare</button>}
        </div>
      </div>
    </>
  );
}
