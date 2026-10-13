"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ApiItem } from "@/lib/api/endpoints/items";
import { api, ago, getMe, isVideo, mediaUrl } from "@/lib/client/api";
import Comments, { type ApiComment } from "./Comments";
import TagBar, { type ApiTag } from "./TagBar";
import VoteBox from "./VoteBox";

export default function ItemView({ id }: { id: number }) {
  const router = useRouter();
  const [item, setItem] = useState<ApiItem | null>(null);
  const [tags, setTags] = useState<ApiTag[]>([]);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [views, setViews] = useState(0);
  const [error, setError] = useState("");
  const me = getMe();

  const loadInfo = useCallback(async () => {
    const info = await api.get("items/info", { itemId: id });
    setTags(info.tags);
    setComments(info.comments);
    setViews(info.views);
  }, [id]);

  useEffect(() => {
    setItem(null);
    setError("");
    api.get("items/get", { id, flags: 31 })
      .then((res) => {
        const found = res.items.find((i: ApiItem) => i.id === id);
        if (!found) throw new Error("Nicht gefunden");
        setItem(found);
        return loadInfo();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler"));
  }, [id, loadInfo]);

  const go = useCallback(
    (dir: -1 | 1) => {
      const ids: number[] = JSON.parse(sessionStorage.getItem("bk.feed") ?? "[]");
      const next = ids[ids.indexOf(id) + dir];
      if (next) router.push(`/item/${next}`);
    },
    [id, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName);
      if (typing) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "c") { e.preventDefault(); document.getElementById("comment-input")?.focus(); }
      if (e.key === "k") { e.preventDefault(); document.getElementById("search")?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  async function report() {
    const reason = window.prompt("Grund der Meldung?");
    if (reason) await api.post("contact/report", { itemId: id, reason }).catch(() => undefined);
  }

  async function favorite() {
    const { collections } = await api.get("collections/get");
    const fav = collections.find((c: { isDefault: number }) => c.isDefault === 1);
    if (fav) await api.post("collections/add", { collectionId: fav.id, itemId: id }).catch(() => undefined);
  }

  if (error) return <p className="err">{error}</p>;
  if (!item) return <p className="dim">Lade…</p>;

  return (
    <div className="item">
      <div>
        <div className="stage">
          {isVideo(item.image) ? (
            <video src={mediaUrl(item.image)} controls loop autoPlay muted={!item.audio} playsInline />
          ) : (
            <img src={mediaUrl(item.image)} alt="" />
          )}
        </div>
        <div className="bar">
          <button onClick={() => go(-1)}>‹</button>
          <button onClick={() => go(1)}>›</button>
          <VoteBox kind="item" id={item.id} up={item.up} down={item.down} />
          {me && <button onClick={favorite} title="Zu Favoriten">★</button>}
          <span className="dim">
            {ago(item.created)} von <Link href={`/user/${item.user}`}>{item.user}</Link> · {views} Aufrufe
          </span>
          {item.source && <a href={item.source} rel="noreferrer noopener" target="_blank">Quelle</a>}
          <a href={mediaUrl(item.image)} download>herunterladen</a>
          {me && <button onClick={report}>melden</button>}
        </div>
        <TagBar itemId={item.id} tags={tags} onChange={loadInfo} />
      </div>
      <Comments itemId={item.id} comments={comments} onChange={loadInfo} />
    </div>
  );
}
