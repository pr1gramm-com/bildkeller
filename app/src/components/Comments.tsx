"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ago, getMe } from "@/lib/client/api";
import { markColor } from "@/lib/marks";
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
      className="row reply"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        api.post("comments/post", { itemId, parent, content: text }).then(() => { setText(""); onDone(); }).catch(() => undefined);
      }}
    >
      <textarea id={parent === 0 ? "comment-input" : undefined} placeholder="Kommentar schreiben [c]" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      <button className="primary">Abschicken</button>
    </form>
  );
}

function count(n: Node): number {
  return n.children.reduce((sum, c) => sum + 1 + count(c), 0);
}

function CommentNode({ n, itemId, onChange }: { n: Node; itemId: number; onChange: () => void }) {
  const [replying, setReplying] = useState(false);
  const [open, setOpen] = useState(!n.blocked);
  const [folded, setFolded] = useState(false);
  const me = getMe();
  const [score, setScore] = useState(n.up - n.down);
  const hidden = count(n);
  return (
    <div className="comment">
      <VoteBox kind="comment" id={n.id} up={n.up} down={n.down} onScore={setScore} />
      <div className="body">
        {open && !folded && <div className="text">{n.content}</div>}
        <div className="meta">
          <Link href={`/user/${n.name}`} className="uname">{n.name}</Link>
          <span className="dot" style={{ background: markColor(n.mark) }} />
          <span className="pts">{score} Benis</span>
          <span className="dim">{ago(n.created)}{n.editedAt ? " (bearbeitet)" : ""}</span>
          {me && <button className="link hot" onClick={() => setReplying(!replying)}>antworten</button>}
          <button className="link hot" onClick={() => setFolded(!folded)}>[{folded ? `+${hidden}` : "−"}]</button>
          {n.blocked && <button className="link hot" onClick={() => setOpen(!open)}>{open ? "ausblenden" : "anzeigen"}</button>}
        </div>
        {open && !folded && (
          <>
            {replying && <Reply itemId={itemId} parent={n.id} onDone={() => { setReplying(false); onChange(); }} />}
            <div className="children">
              {n.children.map((c) => <CommentNode key={c.id} n={c} itemId={itemId} onChange={onChange} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Comments({ itemId, comments, onChange }: { itemId: number; comments: ApiComment[]; onChange: () => void }) {
  const roots = useMemo(() => tree(comments), [comments]);
  return (
    <section className="comments">
      <h3 className="count">{comments.length} Kommentare</h3>
      {getMe() && <Reply itemId={itemId} parent={0} onDone={onChange} />}
      {roots.map((n) => <CommentNode key={n.id} n={n} itemId={itemId} onChange={onChange} />)}
    </section>
  );
}
