"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ApiItem } from "@/lib/api/endpoints/items";
import { api, isVideo, mediaUrl } from "@/lib/client/api";
import { useFlags } from "@/lib/client/flags";
import { itemHref, itemIdFromPath } from "@/lib/feed-route";
import { usePreferences } from "@/lib/client/preferences";
import Icon from "./Icon";
import ItemView from "./ItemView";

type Props = {
  promoted?: 0 | 1;
  junk?: boolean;
  tags?: string;
  user?: string;
  /** Comma separated uploaders (the "Stelzungen" feed). */
  users?: string;
  /** Page the inline viewer returns to when it is closed. */
  base?: string;
  /** Chronicle: every upload, including the ones marked as junk. */
  chronicle?: boolean;
  /** Deep link: the first page of the stream starts at this item id. */
  startAt?: number;
  history?: boolean;
  collection?: number;
  subscribed?: boolean;
};

/** Thumbnail grid; a clicked post opens inline below its row (like pr0gramm.com), the URL follows via the History API. */
export default function Feed({ promoted = 0, junk = false, tags = "", user = "", users = "", chronicle = false, base: baseProp, startAt, history = false, collection, subscribed = false }: Props) {
  const [items, setItems] = useState<ApiItem[]>([]);
  const [atEnd, setAtEnd] = useState(false);
  const [error, setError] = useState("");
  const [cols, setCols] = useState(1);
  const flags = useFlags();
  const preferences = usePreferences();
  const [hovered, setHovered] = useState<number | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const path = usePathname();
  const router = useRouter();
  const loading = useRef(false);
  const gen = useRef(0); // bumps on every reset so late responses of an old query are dropped
  const sentinel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const opened = useRef<HTMLDivElement>(null);
  const pushed = useRef(false); // true while the open post owns a history entry that we pushed from the grid

  const base = baseProp ?? (promoted ? "/top" : junk ? "/junk" : "/new");
  const openId = itemIdFromPath(path);

  const load = useCallback(
    async (older?: number) => {
      if (loading.current) return;
      loading.current = true;
      const mine = gen.current;
      try {
        const params: Record<string, string | number> = { flags: flags ?? 1, promoted, show_junk: chronicle || (!promoted && !preferences.junkSeparation) ? 1 : 0 };
        if (junk) params.junk = 1;
        if (history) params.history = 1;
        if (collection) params.collection = collection;
        if (subscribed) params.subscribed = 1;
        if (older) params.older = older;
        else if (startAt) params.id = startAt;
        if (tags) params.tags = tags;
        if (user) params.user = user;
        if (users) params.users = users;
        const res = await api.get("items/get", params);
        if (mine !== gen.current) return;
        setItems((prev) => (older ? [...prev, ...res.items] : res.items));
        setAtEnd(res.atEnd);
        setSeen((previous) => older ? [...new Set([...previous, ...(res.seen ?? [])])] : res.seen ?? []);
      } catch (e) {
        if (mine === gen.current) setError(e instanceof Error ? e.message : "Fehler");
      } finally {
        if (mine === gen.current) loading.current = false;
      }
    },
    [flags, promoted, junk, tags, user, users, chronicle, startAt, history, collection, subscribed, preferences.junkSeparation, preferences.markSeenItems],
  );

  useEffect(() => {
    if (flags === null) return; // stored filter not read yet
    gen.current += 1;
    loading.current = false;
    setItems([]);
    setAtEnd(false);
    setError("");
    void load();
  }, [load]);

  useEffect(() => {
    const mark = (e: Event) => {
      const id = (e as CustomEvent<number>).detail;
      setSeen((previous) => previous.includes(id) ? previous : [...previous, id]);
    };
    const reset = () => setSeen([]);
    window.addEventListener("bildkeller:seen", mark);
    window.addEventListener("bildkeller:seen-reset", reset);
    return () => { window.removeEventListener("bildkeller:seen", mark); window.removeEventListener("bildkeller:seen-reset", reset); };
  }, []);

  useEffect(() => {
    const refresh = () => {
      gen.current += 1;
      loading.current = false;
      setError("");
      void load();
    };
    window.addEventListener("bildkeller:blocks", refresh);
    return () => window.removeEventListener("bildkeller:blocks", refresh);
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

  // Tiles per row, read from the resolved CSS grid so desktop (fixed 128px) and mobile (fluid) both work.
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => setCols(Math.max(1, getComputedStyle(el).gridTemplateColumns.split(" ").length));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [error]);

  // First open pushes one history entry; moving between posts replaces it, so Back (or Esc) returns to the grid.
  const open = useCallback((id: number) => {
    if (itemIdFromPath(window.location.pathname) !== null) {
      window.history.replaceState(null, "", itemHref(base, id));
    } else {
      window.history.pushState(null, "", itemHref(base, id));
      pushed.current = true;
    }
  }, [base]);
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      router.replace(base); // deep link: swap the page tree to the plain feed
    }
  }, [base, router]);

  const idx = openId === null ? -1 : items.findIndex((i) => i.id === openId);
  const go = (dir: -1 | 1) => {
    if (idx < 0) return;
    const next = items[idx + dir];
    if (next) open(next.id);
    else if (dir === 1 && !atEnd && items.length) void load(items[items.length - 1].id);
  };

  useEffect(() => {
    if (openId !== null) opened.current?.scrollIntoView({ block: "start" });
  }, [openId]);

  if (error) return <p className="err">{error}</p>;

  // The post opens after the last tile of the clicked row.
  const insertAfter = idx < 0 ? -1 : Math.min(items.length - 1, (Math.floor(idx / cols) + 1) * cols - 1);
  const viewer = openId !== null && (
    <div className="item-container" ref={opened} key="viewer">
      <ItemView key={openId} id={openId} item={idx >= 0 ? items[idx] : undefined} onPrev={() => go(-1)} onNext={() => go(1)} onClose={close} />
    </div>
  );
  // One array for tiles and viewer keeps the viewer mounted when it moves (e.g. when the stream arrives after a deep link).
  const nodes = items.flatMap((i, n) => [
    <Link
      key={i.id}
      href={itemHref(base, i.id)}
      prefetch={false}
      className={`tile${i.id === openId ? " on" : ""}${preferences.markSeenItems && seen.includes(i.id) ? " seen" : ""}`}
      aria-label={`Beitrag ${i.id}`}
      aria-expanded={i.id === openId}
      onMouseEnter={() => { if (preferences.showVideoPreview && isVideo(i.image)) setHovered(i.id); }}
      onMouseLeave={() => setHovered(null)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (i.id === openId) close();
        else open(i.id);
      }}
    >
      <img src={mediaUrl(i.thumb)} alt="" loading="lazy" />
      {hovered === i.id && <video src={mediaUrl(i.image)} autoPlay muted loop playsInline className="tile-preview" />}
      {preferences.showThumbnailFlags && i.flags !== 1 && <span className={`flag f${i.flags}`} />}
      {isVideo(i.image) && <span className="vid"><Icon name="play" size={14} /></span>}
    </Link>,
    ...(n === insertAfter ? [viewer] : []),
  ]);
  if (idx < 0 && viewer) nodes.unshift(viewer);

  return (
    <>
      <div className="grid" ref={grid}>{nodes}</div>
      {items.length === 0 && atEnd && openId === null && <p className="dim">Nichts gefunden.</p>}
      {!atEnd && <div ref={sentinel} className="sentinel" />}
    </>
  );
}
