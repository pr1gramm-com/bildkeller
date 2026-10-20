"use client";
import Link from "next/link";
import { useState } from "react";
import { api, useMe } from "@/lib/client/api";

export type ApiTag = { id: number; tag: string; confidence: number };
const MIN_CONFIDENCE = 0.2;
const MAX_VISIBLE = 4;
const MAX_TAGS = 16;

export default function TagBar({ itemId, tags, onChange }: { itemId: number; tags: ApiTag[]; onChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const me = useMe();
  const visible = tags.filter((t) => t.confidence >= MIN_CONFIDENCE).sort((a, b) => b.confidence - a.confidence);
  const shown = expanded ? visible : visible.slice(0, MAX_VISIBLE);

  const vote = (tag: string, up: boolean) =>
    api.post("tags/vote", { itemId, tag, up: up ? 1 : 0 }).then(onChange).catch(() => undefined);

  return (
    <div className="item-tags">
      <div className="tags">
        {shown.map((t) => (
          <span className="tag" key={t.id}>
            <Link href={`/search?tags=${encodeURIComponent(t.tag)}`}>{t.tag}</Link>
            {me && (
              <span className="tv">
                <button title="passt" onClick={() => vote(t.tag, true)}>+</button>
                <button title="passt nicht" onClick={() => vote(t.tag, false)}>−</button>
                <button title="Tag blockieren" onClick={() => api.post("profile/blockTag", { tag: t.tag }).catch(() => undefined)}>⊘</button>
              </span>
            )}
          </span>
        ))}
        {!expanded && visible.length > MAX_VISIBLE && (
          <button className="link hot" onClick={() => setExpanded(true)}>{visible.length - MAX_VISIBLE} weitere anzeigen…</button>
        )}
        {expanded && visible.length > MAX_VISIBLE && (
          <button className="link hot" onClick={() => setExpanded(false)}>einklappen…</button>
        )}
        {me && !adding && visible.length < MAX_TAGS && <button className="link hot" onClick={() => setAdding(true)}>Tags hinzufügen…</button>}
      </div>
      {me && adding && (
        <form
          className="row tag-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            api.post("tags/add", { itemId, tags: text }).then(() => { setText(""); setAdding(false); onChange(); }).catch(() => undefined);
          }}
        >
          <input autoFocus placeholder="Tags hinzufügen, mit Komma trennen" value={text} onChange={(e) => setText(e.target.value)} />
          <button>+</button>
        </form>
      )}
      {me && visible.length >= MAX_TAGS && <p className="dim">Du kannst maximal {MAX_TAGS} Tags hinzufügen!</p>}
    </div>
  );
}
