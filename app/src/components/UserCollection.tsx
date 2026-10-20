"use client";
import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/client/api";

type Col = { id: number; name: string; itemCount: number; items: Array<{ id: number; thumb: string }>; isPublic: number; isDefault: number };

/** "Alle Hochlads in dieser Sammlung…" */
export default function UserCollection({ id }: { id: number }) {
  const [col, setCol] = useState<Col | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get("collections/get", { id }).then((r) => setCol(r.collections?.[0] ?? null)).catch((e) => setError(e.message));
  }, [id]);
  if (error) return <p className="err">{error}</p>;
  if (!col) return <p className="dim">Lade…</p>;
  return (
    <>
      <h1 className="pane-head">{col.name}</h1>
      <div className="pane">
        <h2 className="section">Alle Hochlads in dieser Sammlung… <span className="section-meta">{col.itemCount}</span></h2>
        <div className="grid">
          {col.items.map((i) => (
            <a key={i.id} className="tile" href={`/item/${i.id}`}><img src={mediaUrl(i.thumb)} alt="" /></a>
          ))}
        </div>
      </div>
    </>
  );
}
