"use client";
import { useEffect, useRef, useState } from "react";
import { getMe, mediaUrl } from "@/lib/client/api";
import { publishPreferences, usePreferences } from "@/lib/client/preferences";
import { avatarPath, MAX_AVATAR_BYTES } from "@/lib/avatar-path";

type Selection = { file: File; url: string };
export default function AvatarEditor({ onChange }: { onChange: () => void }) {
  const settings = usePreferences();
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [x, setX] = useState(50), [y, setY] = useState(50), [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => () => { if (selection) URL.revokeObjectURL(selection.url); }, [selection]);
  const avatar = avatarPath(settings.avatar);

  async function save(remove = false) {
    if (busy || (!remove && !selection)) return;
    setBusy(true); setError("");
    const form = new FormData(); form.set("_nonce", getMe()?.id.slice(0, 16) ?? "");
    if (remove) form.set("remove", "1");
    else if (selection) { form.set("image", selection.file); form.set("x", String(x)); form.set("y", String(y)); form.set("zoom", String(zoom)); }
    try {
      const result = await (await fetch("/api/user/avatar", { method: "POST", body: form })).json();
      if (result.error) throw new Error(result.error);
      publishPreferences(result.settings); setSelection(null); onChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusy(false); }
  }
  return <section className="avatar-editor">
    <input ref={input} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => {
      const file = e.target.files?.[0]; e.target.value = "";
      if (!file) return;
      if (!["image/png", "image/jpeg"].includes(file.type) || file.size > MAX_AVATAR_BYTES) { setError("Bitte PNG oder JPG bis 20 MB auswählen."); return; }
      setError(""); setX(50); setY(50); setZoom(1); setSelection({ file, url: URL.createObjectURL(file) });
    }} />
    <button type="button" className="avatar-select" disabled={busy} aria-label="Avatar ändern" title="PNG oder JPG · 64–8192 px · max. 20 MB" onClick={() => input.current?.click()}>
      {avatar ? <img src={mediaUrl(avatar)} alt="Dein Avatar" /> : <span>Avatar hinzufügen</span>}
    </button>
    {selection && <p className="dim">PNG oder JPG · 64–8192 px · max. 20 MB · Ausschnitt frei wählbar, gespeichert als 512×512</p>}
    {selection && <div className="avatar-crop">
      <div className="avatar-preview"><img src={selection.url} alt="Avatar-Ausschnitt" style={{ objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` }} /></div>
      <label>Horizontal<input aria-label="Avatar horizontal" type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} /></label>
      <label>Vertikal<input aria-label="Avatar vertikal" type="range" min={0} max={100} value={y} onChange={(e) => setY(Number(e.target.value))} /></label>
      <label>Zoom<input aria-label="Avatar Zoom" type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
      <button disabled={busy} onClick={() => save()}>Avatar speichern</button>{" "}<button disabled={busy} onClick={() => setSelection(null)}>Abbrechen</button>
    </div>}
    {avatar && !selection && <button aria-label="Avatar entfernen" disabled={busy} onClick={() => save(true)}>Avatar entfernen</button>}
    {error && <p className="err" role="alert">{error}</p>}
  </section>;
}
