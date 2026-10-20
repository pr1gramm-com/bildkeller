"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiItem } from "@/lib/api/endpoints/items";
import { api, mediaUrl } from "@/lib/client/api";
import { useFlags } from "@/lib/client/flags";
import VoteBox from "./VoteBox";

export default function Television({ tags }: { tags: string }) {
  const flags = useFlags();
  const [seed, setSeed] = useState("");
  useEffect(() => setSeed(String(Date.now())), []);
  return flags !== null && seed ? <Playlist key={`${flags}:${tags}:${seed}`} flags={flags} tags={tags} seed={seed} /> : <p>Lädt …</p>;
}

function Playlist({ flags, tags, seed }: { flags: number; tags: string; seed: string }) {
  const [items, setItems] = useState<ApiItem[]>([]);
  const [index, setIndex] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [waiting, setWaiting] = useState(false);
  const [vote, setVote] = useState<{ id: number; value: boolean | null } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLElement>(null);
  const request = useRef<AbortController | null>(null);
  const item = items[index];

  useEffect(() => {
    if (!item) return;
    setMediaError("");
    let active = true;
    api.get("items/info", { itemId: item.id }).then((info: { vote?: boolean | null }) => {
      if (active) setVote({ id: item.id, value: info.vote ?? null });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [item]);

  const load = useCallback(async (older?: number) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ flags: String(flags), media: "video", show_junk: "0", tags: `!-(x:random | x:${seed})${tags ? ` ${tags}` : ""}` });
      if (older) query.set("older", String(older));
      const response = await fetch(`/api/items/get?${query}`, { signal: controller.signal });
      const result: { items: ApiItem[]; atEnd: boolean; error?: string } = await response.json();
      if (!response.ok || result.error) throw new Error(result.error ?? "Playlist konnte nicht geladen werden.");
      if (controller.signal.aborted) return;
      setItems((previous) => older ? [...previous, ...result.items] : result.items);
      setAtEnd(result.atEnd);
    } catch (e) {
      if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "Fehler"); setWaiting(false); }
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [flags, tags, seed]);

  useEffect(() => {
    void load();
    return () => { request.current?.abort(); request.current = null; };
  }, [load]);
  useEffect(() => {
    if (!loading && !error && !atEnd && items.length > 0 && index >= items.length - 4) void load(items[items.length - 1].id);
  }, [index, items, atEnd, loading, error, load]);
  useEffect(() => {
    if (!waiting) return;
    if (index + 1 < items.length) { setIndex(index + 1); setWaiting(false); }
    else if (atEnd) setWaiting(false);
  }, [waiting, index, items.length, atEnd]);

  const next = useCallback(() => {
    if (index + 1 < items.length) setIndex(index + 1);
    else if (!atEnd) setWaiting(true);
  }, [index, items.length, atEnd]);
  const togglePlayback = useCallback(() => {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setMediaError("Wiedergabe nicht möglich. Bitte erneut starten."));
    else element.pause();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || target.isContentEditable || target.closest("input, textarea, select, button, video, [role=dialog]")) return;
      if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); setIndex((previous) => Math.max(0, previous - 1)); }
      if (event.key === " ") { event.preventDefault(); togglePlayback(); }
      if (event.key.toLowerCase() === "m") setMuted((previous) => !previous);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, togglePlayback]);

  return <section className="television" ref={screen} aria-label="pr1TV">
    {item && <video key={item.id} ref={video} src={mediaUrl(item.image)} poster={mediaUrl(item.thumb)} controls autoPlay muted={muted} playsInline
      onEnded={next} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onLoadedMetadata={(event) => { event.currentTarget.playbackRate = rate; }}
      onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
      onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      onError={() => setMediaError("Video konnte nicht geladen werden. Du kannst zum nächsten Video wechseln.")} />}
    <span className="tv-brand">pr1TV</span>
    <div className="tv-panel">
      <form className="tv-search" action="/tv"><input name="tags" aria-label="TV-Suche" defaultValue={tags} placeholder="Playlist nach Tags filtern" /><button>Suchen</button></form>
      {!item && !loading && !error && <p>Keine Videos für diese Filter gefunden.</p>}
      {error && <p className="err" role="alert">{error} <button onClick={() => load(items.at(-1)?.id)}>Erneut laden</button></p>}
      {mediaError && <p className="err" role="alert">{mediaError} <button onClick={() => { setMediaError(""); video.current?.load(); }}>Video erneut laden</button></p>}
      {loading && <span role="status">Playlist lädt …</span>}
      {item && <>
        <div className="tv-meta"><Link href={`/user/${encodeURIComponent(item.user)}`}>{item.user}</Link><Link href={`/new/${item.id}`}>Hochlad #{item.id}</Link>
          {vote?.id === item.id && <VoteBox key={item.id} kind="item" id={item.id} up={item.up} down={item.down} initialVote={vote.value} />}
          <span aria-live="polite">#{index + 1}/{items.length}{atEnd ? "" : "+"} in Playlist</span>
        </div>
        <div className="tv-actions">
          <button aria-label="Vorheriges Video" disabled={index === 0} onClick={() => setIndex(index - 1)}>⏮</button>
          <button aria-label={playing ? "Pause" : "Wiedergabe"} onClick={togglePlayback}>{playing ? "Ⅱ" : "▶"}</button>
          <button aria-label="Nächstes Video" disabled={index + 1 >= items.length && atEnd} onClick={next}>⏭</button>
          <button aria-label={muted ? "Ton einschalten" : "Ton ausschalten"} onClick={() => setMuted(!muted)}>{muted ? "Ton aus" : "Ton an"}</button>
          <select aria-label="Wiedergabegeschwindigkeit" value={rate} onChange={(event) => { const value = Number(event.target.value); setRate(value); if (video.current) video.current.playbackRate = value; }}>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value === 1 ? "Normal" : `${value}×`}</option>)}
          </select>
          <button onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => setMediaError("Vollbild nicht verfügbar.")); else void screen.current?.requestFullscreen().catch(() => setMediaError("Vollbild nicht verfügbar.")); }}>Vollbild</button>
        </div>
      </>}
    </div>
  </section>;
}
