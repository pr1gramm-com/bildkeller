"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiItem } from "@/lib/api/endpoints/items";
import { api, mediaUrl } from "@/lib/client/api";

type Props = { promoted?: 0 | 1; junk?: boolean; tags?: string; user?: string };

const FLAG_LABEL: Record<number, string> = { 2: "nsfw", 4: "nsfl", 8: "nsfp", 16: "pol" };

export default function Feed({ promoted = 0, junk = false, tags = "", user = "" }: Props) {
  const [items, setItems] = useState<ApiItem[]>([]);
  const [atEnd, setAtEnd] = useState(false);
  const [error, setError] = useState("");
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (older?: number) => {
      if (loading.current) return;
      loading.current = true;
      try {
        const params: Record<string, string | number> = { flags: 31, promoted, show_junk: junk ? 1 : 0 };
        if (older) params.older = older;
        if (tags) params.tags = tags;
        if (user) params.user = user;
        const res = await api.get("items/get", params);
        setItems((prev) => {
          const next = older ? [...prev, ...res.items] : res.items;
          sessionStorage.setItem("bk.feed", JSON.stringify(next.map((i: ApiItem) => i.id)));
          return next;
        });
        setAtEnd(res.atEnd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler");
      } finally {
        loading.current = false;
      }
    },
    [promoted, junk, tags, user],
  );

  useEffect(() => {
    setItems([]);
    setAtEnd(false);
    void load();
  }, [load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || atEnd) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && items.length > 0) void load(items[items.length - 1].id);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [items, atEnd, load]);

  if (error) return <p className="err">{error}</p>;
  return (
    <>
      <div className="grid">
        {items.map((i) => (
          <Link key={i.id} href={`/item/${i.id}`} className="tile">
            <img src={mediaUrl(i.thumb)} alt="" loading="lazy" />
            {FLAG_LABEL[i.flags] && <span className="flag">{FLAG_LABEL[i.flags]}</span>}
          </Link>
        ))}
      </div>
      {items.length === 0 && atEnd && <p className="dim">Nichts gefunden.</p>}
      {!atEnd && <div ref={sentinel} style={{ height: 40 }} />}
    </>
  );
}
