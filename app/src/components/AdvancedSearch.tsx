"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";

type Type = "tag" | "exactTag" | "user" | "date" | "score" | "rank" | "res";
type Mode = "include" | "exclude";
type Logic = "&" | "|";

const TYPES: [Type, string][] = [
  ["tag", "Tag"],
  ["exactTag", "Genauer Tag"],
  ["user", "User"],
  ["date", "Datum"],
  ["score", "Benis"],
  ["rank", "Userrang"],
  ["res", "Auflösung"],
];

const PLACEHOLDER: Record<Type, string> = {
  tag: "Tag",
  exactTag: "Genauer Tag",
  user: "User",
  date: "2024-01-01..2024-12-31",
  score: "100",
  rank: "2",
  res: "1920x1080",
};

type Row = { type: Type; mode: Mode; value: string; logic: Logic };

/** Encodes one criterion as a query token. */
function token(r: Row): string {
  const v = r.value.trim().replace(/\s+/g, "");
  if (!v) return "";
  const body =
    r.type === "tag" ? `~${v}` :
    r.type === "user" ? `u:${v}` :
    r.type === "date" ? `d:${v}` :
    r.type === "score" ? `s:${v}` :
    r.type === "rank" ? `m:${v}` :
    r.type === "res" ? `r:${v}` : v;
  return r.mode === "exclude" ? `-${body}` : body;
}

export default function AdvancedSearch() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([
    { type: "tag", mode: "include", value: "", logic: "&" },
    { type: "tag", mode: "include", value: "", logic: "&" },
  ]);
  const [feed, setFeed] = useState<"new" | "top" | "junk">("new");
  const [saved, setSaved] = useState(false);
  const [reverse, setReverse] = useState("");
  const [reverseError, setReverseError] = useState("");
  const [reverseHits, setReverseHits] = useState<Array<{ id: number; user: string }>>([]);

  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, n) => (n === i ? { ...row, ...patch } : row)));
  const add = () => setRows((r) => [...r, { type: "tag", mode: "include", value: "", logic: r.length ? "&" : "&" }]);
  const remove = (i: number) => setRows((r) => r.filter((_, n) => n !== i));

  /** Rows joined by their logic: "|" starts a new OR group, "&" keeps the AND group. */
  const query = () => {
    const groups: string[] = [];
    let current: string[] = [];
    rows.forEach((r, i) => {
      const t = token(r);
      if (t) current.push(t);
      if (i < rows.length - 1 && rows[i + 1].logic === "|") {
        groups.push(current.join(" "));
        current = [];
      }
    });
    groups.push(current.join(" "));
    return groups.filter(Boolean).join(" | ");
  };

  function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query();
    if (!q) return;
    const params = new URLSearchParams({ tags: q });
    if (feed === "top") params.set("promoted", "1");
    if (feed === "junk") params.set("junk", "1");
    router.push(`/search?${params.toString()}`);
  }

  function save() {
    localStorage.setItem("bildkeller.search", query());
    setSaved(true);
  }

  async function reverseSearch(e: React.FormEvent) {
    e.preventDefault();
    setReverseError("");
    setReverseHits([]);
    try {
      const r = await api.post("items/reverse", { url: reverse });
      setReverseHits(r.items ?? []);
      if (!r.items?.length) setReverseError("Kein passender Post gefunden.");
    } catch (err) {
      setReverseError(err instanceof Error ? err.message : "Fehler");
    }
  }

  return (
    <>
      <h1 className="pane-head">Erweiterte Suche</h1>
      <form className="adv-search" onSubmit={search}>
        {rows.map((r, i) => (
          <div key={i}>
            {i > 0 && (
              <div className="and">
                <select aria-label="Verknüpfung" value={r.logic} onChange={(e) => set(i, { logic: e.target.value as Logic })}>
                  <option value="&">UND</option>
                  <option value="|">ODER</option>
                </select>
              </div>
            )}
            <div className="search-row">
              <select aria-label="Suchtyp" value={r.type} onChange={(e) => set(i, { type: e.target.value as Type })}>
                {TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <select aria-label="Einschließen oder ausschließen" value={r.mode} onChange={(e) => set(i, { mode: e.target.value as Mode })}>
                <option value="include">einschließen</option>
                <option value="exclude">ausschließen</option>
              </select>
              <input type="text" placeholder={PLACEHOLDER[r.type]} value={r.value} onChange={(e) => set(i, { value: e.target.value })} />
              {rows.length > 1 && <button type="button" className="link hot" onClick={() => remove(i)}>entfernen</button>}
            </div>
          </div>
        ))}
        <div className="search-actions">
          <button type="button" onClick={add}>Kriterium hinzufügen</button>
        </div>
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
      <div className="adv-search">
        <h3>Rückwärtssuche</h3>
        <p className="dim">Hast du nur einen Direktlink zu einem Bild und suchst den passenden Post?</p>
        <form className="row" onSubmit={reverseSearch}>
          <input type="text" placeholder="https://img.example/post.jpg" value={reverse} onChange={(e) => setReverse(e.target.value)} />
          <button type="submit">Post suchen</button>
        </form>
        {reverseError && <p className="err">{reverseError}</p>}
        {reverseHits.length > 0 && (
          <ul>
            {reverseHits.map((h) => <li key={h.id}><a href={`/item/${h.id}`}>Beitrag {h.id} von {h.user}</a></li>)}
          </ul>
        )}
        <h3>Erklärung</h3>
        <p>Um die Verwendung der erweiterten Suchsyntax zu erleichtern, gibt es nun diese Seite. Zunächst wählt man ein Suchkriterium aus der Liste. Anschließend kann man angeben wie sich das jeweilige Kriterium auf das Ergebnis auswirken soll. Sollen Posts mit diesem Kriterium angezeigt werden, wählt man einschließen. Wenn die Posts mit dem jeweiligen Kriterium jedoch ausgeschlossen werden sollen, wählt man ausschließen. Im Anschluss definiert man den Wert und wählt die Art der Verknüpfung (Und/oder) zum nächsten Kriterium aus. Die Suche funktioniert nach den Prinzipien der booleschen Algebra, hierbei ist das &amp; (und) stärker gewichtet als das | (oder) und das - (ausschließen) bindet wiederum schwächer als das Oder.</p>
        <p>Dieselbe Syntax funktioniert auch direkt in der Suchleiste der Kopfzeile: <code>! katze -hund</code>, <code>s:100</code> für den Benis, <code>u:name</code> für Uploads eines Nutzers, <code>~kat</code> für Tags, die „kat" enthalten, <code>d:2024-01-01..2024-12-31</code> für einen Zeitraum und <code>r:1920x1080</code> für die Auflösung.</p>
      </div>
    </>
  );
}
