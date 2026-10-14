"use client";
import Link from "next/link";
import { useState } from "react";
import { api, getMe } from "@/lib/client/api";

export type ApiTag = { id: number; tag: string; confidence: number };
const MIN_CONFIDENCE = 0.2;
const MAX_VISIBLE = 4;

export default function TagBar({ itemId, tags, onChange }: { itemId: number; tags: ApiTag[]; onChange: () => void }) {
  const [all, setAll] = useState(false);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const me = getMe();
  const visible = tags.filter((t) => t.confidence >= MIN_CONFIDENCE).sort((a, b) => b.confidence - a.confidence);
  const shown = all ? visible : visible.slice(0, MAX_VISIBLE);

  const vote = (tag: string, up: boolean) =>
    api.post("tags/vote", { itemId, tag, up: up ? 1 : 0 }).then(onChange).catch(() => undefined);

  return (
    <div>
      <div className="tags">
        {shown.map((t) => (
          <span className="tag" key={t.id}>
            <Link href={`/search?tags=${encodeURIComponent(t.tag)}`}>{t.tag}</Link>
            {me && (
              <span className="tv">
                <button title="passt" onClick={() => vote(t.tag, true)}>+</button>
                <button title="passt nicht" onClick={() => vote(t.tag, false)}>−</button>
              </span>
            )}
          </span>
        ))}
        {!all && visible.length > MAX_VISIBLE && (
          <button className="link hot" onClick={() => setAll(true)}>{visible.length - MAX_VISIBLE} weitere anzeigen…</button>
        )}
        {me && !adding && <button className="link hot" onClick={() => setAdding(true)}>Tags hinzufügen…</button>}
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
    </div>
  );
}
