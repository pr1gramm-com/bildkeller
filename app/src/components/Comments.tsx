"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ago, getMe } from "@/lib/client/api";
import VoteBox from "./VoteBox";

export type ApiComment = {
  id: number; parent: number; content: string; created: number; editedAt: number | null;
  up: number; down: number; confidence: number; name: string; mark: number; blocked: boolean;
};

type Node = ApiComment & { children: Node[] };

function tree(list: ApiComment[]): Node[] {
  const byId = new Map<number, Node>(list.map((c) => [c.id, { ...c, children: [] }]));
  const roots: Node[] = [];
  for (const n of byId.values()) {
    const parent = byId.get(n.parent);
    (parent ? parent.children : roots).push(n);
  }
  const sort = (ns: Node[]) => { ns.sort((a, b) => b.confidence - a.confidence || a.id - b.id); ns.forEach((n) => sort(n.children)); };
  sort(roots);
  return roots;
}

function Reply({ itemId, parent, onDone }: { itemId: number; parent: number; onDone: () => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        api.post("comments/post", { itemId, parent, content: text }).then(() => { setText(""); onDone(); }).catch(() => undefined);
      }}
    >
      <textarea id={parent === 0 ? "comment-input" : undefined} placeholder="Kommentar schreiben [c]" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} rows={2} />
      <button className="primary">Abschicken</button>
    </form>
  );
}

function CommentNode({ n, itemId, onChange }: { n: Node; itemId: number; onChange: () => void }) {
  const [replying, setReplying] = useState(false);
  const [open, setOpen] = useState(!n.blocked);
  const me = getMe();
  return (
    <div className="comment">
      <div className="meta">
        <Link href={`/user/${n.name}`}>{n.name}</Link>
        <span>{ago(n.created)}{n.editedAt ? " (bearbeitet)" : ""}</span>
        {n.blocked && <button onClick={() => setOpen(!open)}>{open ? "ausblenden" : "anzeigen"}</button>}
      </div>
      {open && (
        <>
          <div style={{ whiteSpace: "pre-wrap" }}>{n.content}</div>
          <div className="row">
            <VoteBox kind="comment" id={n.id} up={n.up} down={n.down} />
            {me && <button onClick={() => setReplying(!replying)}>antworten</button>}
          </div>
          {replying && <Reply itemId={itemId} parent={n.id} onDone={() => { setReplying(false); onChange(); }} />}
          <div className="children">
            {n.children.map((c) => <CommentNode key={c.id} n={c} itemId={itemId} onChange={onChange} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function Comments({ itemId, comments, onChange }: { itemId: number; comments: ApiComment[]; onChange: () => void }) {
  const roots = useMemo(() => tree(comments), [comments]);
  return (
    <section>
      <h3>{comments.length} Kommentare</h3>
      {getMe() && <Reply itemId={itemId} parent={0} onDone={onChange} />}
      {roots.map((n) => <CommentNode key={n.id} n={n} itemId={itemId} onChange={onChange} />)}
    </section>
  );
}
