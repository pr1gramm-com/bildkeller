"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

type Value = string | number | boolean;
type Props = { tab: string; settings: Record<string, Value>; save: (patch: Record<string, Value>) => void };
const TOGGLES: Record<string, Array<[string, string, string]>> = {
  appearance: [
    ["showBookmarkBar", "Lesezeichen anzeigen", "Zeigt deine gespeicherten Suchen in der Navigation."],
    ["showThumbnailFlags", "Inhaltsmarkierungen anzeigen", "Kennzeichnet die Einstufung der Kacheln."],
    ["showSeenNav", "Verlauf in der Navigation", "Zeigt den Link zu deinen gesehenen Hochlads."],
  ],
  behavior: [
    ["enableVoteToggle", "Vote-Toggle aktivieren", "Ein erneuter Vote kann deine Bewertung zurücknehmen."],
    ["favUpvote", "Favoriten automatisch upvoten", "Favorisierte Hochlads erhalten automatisch einen Upvote."],
    ["junkSeparation", "Müll-Trennung", "Blendet Müllhochlads im Neu-Stream aus."],
    ["defaultToNew", "Standardmäßig Neu statt Beliebt", "Öffnet auf der Startseite den Neu-Stream."],
    ["showVideoPreview", "Video-Vorschau aktivieren", "Spielt Video-Kacheln beim Hovern ab."],
    ["enableItemHistory", "Besuchte Hochlads merken", "Speichert deine besuchten Hochlads in deinem Konto."],
    ["markSeenItems", "Gesehene Posts markieren", "Kennzeichnet bereits besuchte Hochlads im Feed."],
  ],
  comments: [
    ["collapseLongComments", "Lange Kommentare automatisch einklappen", "Klappt Kommentare über 400 Zeichen ein."],
    ["hideDownvotedComments", "Schlecht bewertete Kommentare automatisch einklappen", "Deine eigenen Kommentare bleiben sichtbar."],
    ["autoCollapseDeepComments", "Tief verschachtelte Kommentare automatisch einklappen", "Klappt Threads ab Tiefe 3 ein."],
    ["colorCommentIndentationLines", "Einzugslinien farbig anzeigen", "Färbt Einzugslinien nach Verschachtelungstiefe."],
  ],
  privacy: [["likesArePublic", "Kommentar-Favoriten öffentlich anzeigen", "Erlaubt anderen Nutzern, deine favorisierten Kommentare zu sehen."]],
};
const TITLES: Record<string, string> = { appearance: "Darstellung", behavior: "Verhalten", comments: "Kommentare", privacy: "Sicherheit", filters: "Blockierungen" };

export default function AppPreferences({ tab, settings, save }: Props) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  async function loadBlocks() {
    const [users, result] = await Promise.all([api.get("user/blocklist"), api.get("user/blockedTags")]);
    setBlocked(users.blocked.map((u: { name: string }) => u.name)); setTags(result.tags);
  }
  useEffect(() => { if (tab === "filters") void loadBlocks().catch((e) => setError(e.message)); }, [tab]);
  async function block(kind: "user" | "tag", value: string, remove = false) {
    if (!value.trim()) return;
    setError("");
    try {
      await api.post(kind === "tag" ? `profile/${remove ? "unblockTag" : "blockTag"}` : `profile/${remove ? "unblock" : "block"}`, kind === "tag" ? { tag: value.trim() } : { name: value.trim() });
      if (kind === "tag") setTag(""); else setName("");
      await loadBlocks(); window.dispatchEvent(new Event("bildkeller:blocks"));
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler"); }
  }
  return <section className="app-preferences">
    <h2>{TITLES[tab]}</h2>
    {tab === "appearance" && <>
      <h3>Seitenbreite</h3>
      <select aria-label="Seitenbreite" value={String(settings.contentMaxWidth ?? "auto")} onChange={(e) => save({ contentMaxWidth: e.target.value })}>
        {[["auto", "Automatisch"], ["2200", "Breit (2200px)"], ["1800", "Mittel (1800px)"], ["1400", "Kompakt (1400px)"], ["1100", "Schmal (1100px)"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <h3>Farbschema</h3>
      <select aria-label="Farbschema" value={String(settings.themeId ?? 0)} onChange={(e) => save({ themeId: Number(e.target.value) })}>
        {["Orange", "Grün", "Olivgrün", "Blau", "Pink"].map((label, id) => <option key={id} value={id}>{label}</option>)}
      </select>
    </>}
    {(TOGGLES[tab] ?? []).map(([key, label, detail]) => <label className="preference-row" key={key}>
      <span><strong>{label}</strong><small>{detail}</small></span>
      <input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => save({ [key]: e.target.checked })} />
    </label>)}
    {tab === "filters" && <>
      <h3>Blockierte Benutzer</h3>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void block("user", name); }}><input aria-label="Benutzer blockieren" value={name} onChange={(e) => setName(e.target.value)} required /><button>Blockieren</button></form>
      {blocked.map((value) => <div className="preference-row" key={value}><span>{value}</span><button onClick={() => block("user", value, true)}>Entblocken</button></div>)}
      <h3>Blockierte Tags</h3>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void block("tag", tag); }}><input aria-label="Tag blockieren" value={tag} onChange={(e) => setTag(e.target.value)} required /><button>Blockieren</button></form>
      {tags.length === 0 && <p className="dim">Du hast keine Tags blockiert.</p>}
      {tags.map((value) => <div className="preference-row" key={value}><span>{value}</span><button onClick={() => block("tag", value, true)}>Entblocken</button></div>)}
      <h3>Kommentare blockierter Nutzer</h3>
      <select aria-label="Kommentare blockierter Nutzer" value={String(settings.blockedCommentMode ?? "collapse_subtree")} onChange={(e) => save({ blockedCommentMode: e.target.value })}>
        {[["collapse_subtree", "Einklappen mit Antworten"], ["collapse_comment", "Nur den Kommentar einklappen"], ["hide", "Komplett ausblenden"], ["show", "Normal anzeigen"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </>}
    {error && <p className="err" role="alert">{error}</p>}
  </section>;
}
