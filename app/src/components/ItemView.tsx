"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ApiItem } from "@/lib/api/endpoints/items";
import { api, ago, useMe, isVideo, mediaUrl } from "@/lib/client/api";
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
  const [favorites, setFavorites] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [collections, setCollections] = useState<Array<{ id: number; name: string }>>([]);
  const [picker, setPicker] = useState(false);
  const [following, setFollowing] = useState(false);
  const me = useMe();

  const loadInfo = useCallback(async () => {
    const info = await api.get("items/info", { itemId: id });
    setTags(info.tags);
    setComments(info.comments);
    setViews(info.views);
    setFavorites(info.favorites ?? []);
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

  useEffect(() => {
    if (!me || !item) return;
    api.get("collections/get").then((r) => setCollections((r.collections ?? []).map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })))).catch(() => undefined);
    api.get("profile/info", { name: item.user, flags: 31 }).then((r) => setFollowing(Boolean(r.following))).catch(() => undefined);
  }, [me, item]);

  async function report() {
    const reason = window.prompt("Grund der Meldung?");
    if (reason) await api.post("contact/report", { itemId: id, reason }).catch(() => undefined);
  }

  async function favorite() {
    const { collections } = await api.get("collections/get");
    const fav = collections.find((c: { isDefault: number }) => c.isDefault === 1);
    if (fav) await api.post("collections/add", { collectionId: fav.id, itemId: id }).catch(() => undefined);
  }

  async function collect(collectionId: number) {
    setPicker(false);
    await api.post("collections/add", { collectionId, itemId: id }).catch(() => undefined);
  }

  async function stalk() {
    if (!item) return;
    await api.post(following ? "profile/unfollow" : "profile/follow", { name: item.user }).catch(() => undefined);
    setFollowing(!following);
  }

  async function block() {
    if (!item) return;
    await api.post("profile/block", { name: item.user }).catch(() => undefined);
  }

  async function remove() {
    if (!item || !window.confirm("Diesen Beitrag wirklich löschen?")) return;
    await api.post("items/delete", { id: item.id }).catch(() => undefined);
    onClose();
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
  const own = me?.n.toLowerCase() === item.user.toLowerCase();

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
        <div className="item-actions">
          <VoteBox kind="item" id={item.id} up={item.up} down={item.down} />
          {me && (
            <span className="item-fav">
              <button className="iconbtn vote-fav" onClick={favorite} title="Favorisieren"><Icon name="heart" size={24} /></button>
              <button className="iconbtn vote-collect" onClick={() => setPicker((v) => !v)} title="In Sammlung speichern"><Icon name="star" size={20} /></button>
              {picker && (
                <span className="collect-menu">
                  {collections.map((c) => (
                    <button key={c.id} className="link hot" onClick={() => collect(c.id)}>{c.name}</button>
                  ))}
                </span>
              )}
            </span>
          )}
          <button className="iconbtn act-share" onClick={share} title="Teilen"><Icon name="share" size={20} /></button>
          <a className="iconbtn act-download" href={mediaUrl(item.image)} download title="Herunterladen"><Icon name="download" size={20} /></a>
          {me && <button className="iconbtn act-report" onClick={report} title="Melden"><Icon name="flag" size={20} /></button>}
          {own && <button className="iconbtn act-delete" onClick={remove} title="Löschen"><Icon name="trash" size={20} /></button>}
        </div>
        <div className="item-details">
          <span className="time">{ago(item.created)}</span>
          <span className="time von">von</span>
          <Link href={`/user/${item.user}`} className="user">{item.user}</Link>
          <span className="mark" style={{ color: markColor(item.mark) }}>●</span>
          {me && !own && (
            <span className="item-stalk">
              <button className="link hot" onClick={stalk}>{following ? "Unstelzen" : "Stelzen"}</button>
            </span>
          )}
          <span className="item-views">{views.toLocaleString("de-DE")} Aufrufe</span>
          <span className="item-extra">
            <button className="link hot" onClick={share}>{copied ? "Link kopiert" : "Teilen"}</button>
            {" | "}
            <a href={mediaUrl(item.image)} download className="hot">herunterladen</a>
          </span>
          {item.source && <a href={item.source} rel="noreferrer noopener" target="_blank" className="src">{host(item.source)}</a>}
          {me && <span className="bracket">[<button className="link hot" onClick={report}>melden</button>]</span>}
          {me && !own && <span className="bracket">[<button className="link hot" onClick={block}>{item.user} blockieren</button>]</span>}
          {own && <span className="bracket">[<button className="link hot" onClick={remove}>löschen</button>]</span>}
        </div>
        <TagBar itemId={item.id} tags={tags} onChange={loadInfo} />
      </div>
      <Comments itemId={item.id} op={item.user} comments={comments} favorites={favorites} onChange={loadInfo} />
    </div>
  );
}
