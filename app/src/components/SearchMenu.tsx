"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { searchHref } from "@/lib/feed-route";
import { MEDIA_EXCLUDES, toTags, writeSearch, type Feed, type SearchState } from "@/lib/client/search";

/** The reference board's search panel: search terms, feed, minimum score, media and tag excludes. */
export default function SearchMenu({ state, onClose }: { state: SearchState; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SearchState>(state);

  const set = (patch: Partial<SearchState>) => setDraft((d) => ({ ...d, ...patch }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    writeSearch(draft);
    const tags = toTags(draft);
    onClose();
    router.push(searchHref(draft.feed, tags));
  }

  return (
    <form id="search-menu" className="tip-menu search-menu" onSubmit={submit}>
      <div className="tip-menu-body">
        <div className="search-row">
          <div className="search-row-head">Suchbegriffe:</div>
          <input
            id="search-terms"
            type="text"
            placeholder="Suchen"
            value={draft.terms}
            onChange={(e) => set({ terms: e.target.value })}
          />
        </div>
        <div className="search-row">
          <div className="search-row-head">
            Suchen in:{" "}
            <a href="/search" className="search-help" onClick={onClose}>
              Erweiterte Suche <span className="pict">p</span>
            </a>
          </div>
          {(["new", "top", "junk"] as Feed[]).map((f) => (
            <label key={f} className="box-from-label">
              <input type="radio" name="feed" checked={draft.feed === f} onChange={() => set({ feed: f })} /> {f}
            </label>
          ))}
        </div>
        <div className="search-row">
          <div className="search-row-head">
            Minimaler Benis: <span id="search-score-indicator">{draft.minScore > 0 ? draft.minScore : "schnurz"}</span>
          </div>
          <input
            id="search-score"
            type="range"
            min={0}
            max={100}
            step={1}
            value={draft.minScore}
            onChange={(e) => set({ minScore: Number(e.target.value) })}
          />
        </div>
        <div className="search-row">
          <div className="search-row-head">Ausschließen:</div>
          {MEDIA_EXCLUDES.map((e) => (
            <label key={e} className="box-from-label">
              <input
                type="checkbox"
                checked={draft.exclude.includes(e)}
                onChange={(ev) =>
                  set({ exclude: ev.target.checked ? [...draft.exclude, e] : draft.exclude.filter((x) => x !== e) })
                }
              />{" "}
              {e}
            </label>
          ))}
        </div>
        <div className="search-row">
          <div className="search-row-head">Weitere Tags ausschließen:</div>
          <input
            id="search-exclude-tags"
            type="text"
            placeholder="süßvieh kadse"
            value={draft.excludeTags.join(" ")}
            onChange={(e) => set({ excludeTags: e.target.value.split(/[\s,]+/).filter(Boolean) })}
          />
        </div>
      </div>
      <div className="tip-menu-footer">
        <button type="submit" className="primary search-submit">Suchen</button>
      </div>
    </form>
  );
}
