"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import Feed from "./Feed";

type Col = { id: number; name: string; itemCount: number; items: Array<{ id: number; thumb: string }>; isPublic: number; isDefault: number };

/** "Alle Hochlads in dieser Sammlung…" */
export default function UserCollection({ id, base, startAt }: { id: number; base: string; startAt?: number }) {
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
        <Feed collection={id} base={base} startAt={startAt} chronicle />
      </div>
    </>
  );
}
