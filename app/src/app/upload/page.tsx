"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, getMe } from "@/lib/client/api";

const RATINGS = [
  ["sfw", "Safe for work"], ["nsfw", "Nackte Haut u. ä."], ["nsfl", "Gewalt, Ekliges"],
  ["nsfp", "SFW, nur für Registrierte"], ["pol", "Politik, Wirtschaft"],
] as const;

export default function Upload() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState("");
  const [preview, setPreview] = useState<{ url: string; video: boolean } | null>(null);
  const [rating, setRating] = useState("");
  const [tags, setTags] = useState("");
  const [source, setSource] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getMe()) router.push("/login");
    else api.get("items/ratelimited").then((r) => setLeft(r.left)).catch(() => undefined);
  }, [router]);

  async function pick(file: File) {
    setError("");
    setBusy(true);
    setPreview({ url: URL.createObjectURL(file), video: file.type.startsWith("video") });
    const fd = new FormData();
    fd.append("image", file);
    try {
      const body = await (await fetch("/api/items/upload", { method: "POST", body: fd })).json();
      if (body.error) throw new Error(body.error === "ratelimited" ? "Upload-Limit erreicht" : "Datei ungültig");
      setKey(body.key);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post("items/post", { key, sfwstatus: rating, tags, source });
      router.push(`/item/${res.itemId}`);
    } catch (err) {
      const m = err instanceof Error ? err.message : "Fehler";
      setError(m === "similar" ? "Dieses Bild gibt es schon (Repost)." : m === "verification required" ? "NSFW/NSFL erst nach Altersbestätigung (Einstellungen)." : m);
      setBusy(false);
    }
  }

  return (
    <form className="stack panel" onSubmit={submit}>
      <h2>Upload {left !== null && <span className="dim">· noch {left} frei</span>}</h2>
      {!preview ? (
        <div className="dropzone" onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void pick(f); }}>
          Datei hierher ziehen oder klicken (PNG, JPEG, GIF, WebM, MP4, MOV)
          <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/gif,video/webm,video/mp4,video/quicktime"
            onChange={(e) => e.target.files?.[0] && void pick(e.target.files[0])} />
        </div>
      ) : preview.video ? (
        <video src={preview.url} controls muted loop style={{ maxWidth: "100%" }} />
      ) : (
        <img src={preview.url} alt="" style={{ maxWidth: "100%" }} />
      )}
      <fieldset>
        <legend>Einstufung</legend>
        {RATINGS.map(([v, d]) => (
          <label key={v} className="row"><input type="radio" name="sfwstatus" value={v} checked={rating === v} onChange={() => setRating(v)} required /> {v} <span className="dim">{d}</span></label>
        ))}
      </fieldset>
      <input placeholder="Tags, mit Komma getrennt (max. 16)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <input placeholder="Quelle (optional)" value={source} onChange={(e) => setSource(e.target.value)} />
      {error && <span className="err">{error}</span>}
      <button className="primary" disabled={!key || !rating || busy}>{busy ? "…" : "Hochladen"}</button>
    </form>
  );
}
