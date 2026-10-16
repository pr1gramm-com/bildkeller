"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ago, getMe } from "@/lib/client/api";
import { markColor } from "@/lib/marks";
import Icon from "./Icon";
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
      className="comment-form reply"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        api.post("comments/post", { itemId, parent, content: text }).then(() => { setText(""); onDone(); }).catch(() => undefined);
      }}
    >
      <textarea
        className="comment"
        id={parent === 0 ? "comment-input" : undefined}
        placeholder="Kommentar schreiben…"
        title="Kommentar schreiben [c]"
        minLength={3}
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div><button className="primary">Abschicken</button></div>
    </form>
  );
}

function count(n: Node): number {
  return n.children.reduce((sum, c) => sum + 1 + count(c), 0);
}

function CommentNode({ n, itemId, op, onChange }: { n: Node; itemId: number; op: string; onChange: () => void }) {
  const [replying, setReplying] = useState(false);
  const [open, setOpen] = useState(!n.blocked);
  const [folded, setFolded] = useState(false);
  const me = getMe();
  const [score, setScore] = useState(n.up - n.down);
  const hidden = count(n);
  return (
    <div className="comment-box">
      <div className="comment">
        <VoteBox kind="comment" id={n.id} up={n.up} down={n.down} onScore={setScore} />
        {open && <div className="comment-content">{n.content}</div>}
        <div className="comment-foot">
          {n.name === op && <span className="user-comment-op">OP</span>}
          <Link href={`/user/${n.name}`} className="user">{n.name}</Link>
          <span className="mark" style={{ color: markColor(n.mark) }}>●</span>
          <span className="score">{score} Benis</span>
          <span className="time">{ago(n.created)}{n.editedAt ? " (bearbeitet)" : ""}</span>
          {me && (
            <button className="link hot comment-reply-link" onClick={() => setReplying(!replying)}>
              <Icon name="reply" size={12} /> antworten
            </button>
          )}
          <button className="link hot fold" onClick={() => setFolded(!folded)}>{folded ? "[+]" : "[–]"}</button>
          {folded && hidden > 0 && <span className="folded-comments-message">({hidden} eingeklappt)</span>}
          {n.blocked && <button className="link hot" onClick={() => setOpen(!open)}>{open ? "ausblenden" : "anzeigen"}</button>}
        </div>
        {open && !folded && replying && <Reply itemId={itemId} parent={n.id} onDone={() => { setReplying(false); onChange(); }} />}
      </div>
      {open && !folded && n.children.map((c) => <CommentNode key={c.id} n={c} itemId={itemId} op={op} onChange={onChange} />)}
    </div>
  );
}

export default function Comments({ itemId, op, comments, onChange }: { itemId: number; op: string; comments: ApiComment[]; onChange: () => void }) {
  const roots = useMemo(() => tree(comments), [comments]);
  return (
    <div className="item-comments">
      <div className="comments-head"><Icon name="comment" size={14} /> {comments.length} {comments.length === 1 ? "Kommentar" : "Kommentare"}</div>
      {getMe() && <Reply itemId={itemId} parent={0} onDone={onChange} />}
      <section className="comments">
        {roots.map((n) => <CommentNode key={n.id} n={n} itemId={itemId} op={op} onChange={onChange} />)}
      </section>
    </div>
  );
}
