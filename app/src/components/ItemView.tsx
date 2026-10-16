"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ApiItem } from "@/lib/api/endpoints/items";
import { api, ago, getMe, isVideo, mediaUrl } from "@/lib/client/api";
import { markColor } from "@/lib/marks";
import Comments, { type ApiComment } from "./Comments";
import Icon from "./Icon";
import TagBar, { type ApiTag } from "./TagBar";
import VoteBox from "./VoteBox";

type Props = { id: number; item?: ApiItem; onPrev: () => void; onNext: () => void; onClose: () => void };

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** One opened post: media, vote/meta/tags row and comments. Lives inside the feed grid. */
export default function ItemView({ id, item: given, onPrev, onNext, onClose }: Props) {
  const [item, setItem] = useState<ApiItem | null>(given ?? null);
  const [tags, setTags] = useState<ApiTag[]>([]);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [views, setViews] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const me = getMe();

  const loadInfo = useCallback(async () => {
    const info = await api.get("items/info", { itemId: id });
    setTags(info.tags);
    setComments(info.comments);
    setViews(info.views);
  }, [id]);

  useEffect(() => {
    setError("");
    const known = given ? Promise.resolve(given) : api.get("items/get", { id, flags: 31 }).then((res) => {
      const found = res.items.find((i: ApiItem) => i.id === id);
      if (!found) throw new Error("Nicht gefunden");
      return found as ApiItem;
    });
    known
      .then((found) => {
        setItem(found);
        return loadInfo();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler"));
  }, [id, given, loadInfo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // browser shortcuts (copy, history back) stay untouched
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable || t.closest(".flagpop")) return;
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "Escape") onClose();
      if (e.key === "c") { e.preventDefault(); document.getElementById("comment-input")?.focus(); }
      if (e.key === "k") { e.preventDefault(); document.getElementById("search")?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext, onClose]);

  async function report() {
    const reason = window.prompt("Grund der Meldung?");
    if (reason) await api.post("contact/report", { itemId: id, reason }).catch(() => undefined);
  }

  async function favorite() {
    const { collections } = await api.get("collections/get");
    const fav = collections.find((c: { isDefault: number }) => c.isDefault === 1);
    if (fav) await api.post("collections/add", { collectionId: fav.id, itemId: id }).catch(() => undefined);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/item/${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: nothing to copy to
    }
  }

  if (error) return <p className="err">{error}</p>;
  if (!item) return <p className="dim">Lade…</p>;

  return (
    <div className="item">
      <div className="stage">
        {isVideo(item.image) ? (
          <video src={mediaUrl(item.image)} controls loop autoPlay muted={!item.audio} playsInline />
        ) : (
          <img src={mediaUrl(item.image)} alt="" />
        )}
        <button className="nav prev" onClick={onPrev} aria-label="Vorheriges"><Icon name="left" size={36} /></button>
        <button className="nav next" onClick={onNext} aria-label="Nächstes"><Icon name="right" size={36} /></button>
      </div>
      <div className="item-info">
        <VoteBox kind="item" id={item.id} up={item.up} down={item.down} />
        {me && <button className="iconbtn vote-fav" onClick={favorite} title="Favorisieren"><Icon name="heart" size={24} /></button>}
        <div className="item-details">
          <span className="time">{ago(item.created)}</span>
          <span className="time">von</span>
          <Link href={`/user/${item.user}`} className="user">{item.user}</Link>
          <span className="mark" style={{ color: markColor(item.mark) }}>●</span>
          <span className="item-views">{views.toLocaleString("de-DE")} Aufrufe</span>
          <span className="item-extra">
            <button className="link hot" onClick={share}>{copied ? "Link kopiert" : "Teilen"}</button>
            {" | "}
            <a href={mediaUrl(item.image)} download className="hot">herunterladen</a>
          </span>
          {item.source && <a href={item.source} rel="noreferrer noopener" target="_blank" className="src">{host(item.source)}</a>}
          {me && <span className="bracket">[<button className="link hot" onClick={report}>melden</button>]</span>}
        </div>
        <TagBar itemId={item.id} tags={tags} onChange={loadInfo} />
      </div>
      <Comments itemId={item.id} op={item.user} comments={comments} onChange={loadInfo} />
    </div>
  );
}
