"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "include" | "exclude";
type FeedKind = "new" | "top" | "junk";

function Row({ value, mode, onChange, onMode }: { value: string; mode: Mode; onChange: (v: string) => void; onMode: (m: Mode) => void }) {
  return (
    <div className="search-row">
      <select aria-label="Suchtyp" defaultValue="tag"><option value="tag">Tag</option></select>
      <select aria-label="Einschließen oder ausschließen" value={mode} onChange={(e) => onMode(e.target.value as Mode)}>
        <option value="include">einschließen</option>
        <option value="exclude">ausschließen</option>
      </select>
      <input type="text" placeholder="Bitte gib einen Tag ein…" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function AdvancedSearch() {
  const router = useRouter();
  const [terms, setTerms] = useState<Array<{ value: string; mode: Mode }>>([{ value: "", mode: "include" }, { value: "", mode: "include" }]);
  const [feed, setFeed] = useState<FeedKind>("new");
  const [saved, setSaved] = useState(false);

  const set = (i: number, patch: Partial<{ value: string; mode: Mode }>) =>
    setTerms((t) => t.map((row, n) => (n === i ? { ...row, ...patch } : row)));

  const query = terms.map((t) => (t.value.trim() ? `${t.mode === "exclude" ? "-" : ""}${t.value.trim()}` : "")).filter(Boolean).join(" ");

  function search(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ tags: query });
    if (feed === "top") params.set("promoted", "1");
    if (feed === "junk") params.set("junk", "1");
    router.push(`/search?${params}`);
  }

  function save() {
    localStorage.setItem("bildkeller.search", query);
    setSaved(true);
  }

  return (
    <>
      <h1 className="pane-head">Erweiterte Suche</h1>
      <form className="adv-search" onSubmit={search}>
        <Row value={terms[0].value} mode={terms[0].mode} onChange={(v) => set(0, { value: v })} onMode={(m) => set(0, { mode: m })} />
        <div className="and">UND</div>
        <Row value={terms[1].value} mode={terms[1].mode} onChange={(v) => set(1, { value: v })} onMode={(m) => set(1, { mode: m })} />
        <div className="search-feeds">
          {(["new", "top", "junk"] as const).map((f) => (
            <label key={f}>
              <input type="radio" name="feed" checked={feed === f} onChange={() => setFeed(f)} />
              {f === "new" ? "neu" : f === "top" ? "beliebt" : "müll"}
            </label>
          ))}
        </div>
        <div className="search-actions">
          <button className="primary">Suchen</button>
          <button type="button" onClick={save}>Speichern</button>
        </div>
        {saved && <p className="dim">Suche gespeichert.</p>}
      </form>
      <div className="adv-explanation">
        <h2 className="section">Erklärung</h2>
        <p>Ein Tag kann in die Suche eingeschlossen oder von ihr ausgeschlossen werden. Mehrere Kriterien werden UND-verknüpft.</p>
        <p>Dieselbe Syntax funktioniert auch direkt in der Suchleiste der Kopfzeile: <code>! katze -hund</code>, <code>s:100</code> für den Benis und <code>u:name</code> für Uploads eines Nutzers.</p>
      </div>
    </>
  );
}
