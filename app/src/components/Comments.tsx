"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, ago, useMe } from "@/lib/client/api";
import { markColor } from "@/lib/marks";
import Icon from "./Icon";
import VoteBox from "./VoteBox";
import { usePreferences } from "@/lib/client/preferences";

export type ApiComment = {
  id: number; parent: number; content: string; created: number; editedAt: number | null; editCount: number;
  up: number; down: number; confidence: number; name: string; mark: number; blocked: boolean; vote?: boolean | null;
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
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="comment-form reply"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        if (pending) return;
        setPending(true); setError("");
        api.post("comments/post", { itemId, parent, content: text }).then(() => { setText(""); onDone(); }).catch((e) => setError(e.message)).finally(() => setPending(false));
      }}
    >
      <textarea
        className="comment"
        id={parent === 0 ? "comment-input" : undefined}
        placeholder="Kommentar schreiben…"
        title="Kommentar schreiben [c]"
        minLength={3}
        maxLength={10000}
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div><button className="primary" disabled={pending}>Abschicken</button></div>
      {error && <p className="err" role="alert">{error}</p>}
    </form>
  );
}

function count(n: Node): number {
  return n.children.reduce((sum, c) => sum + 1 + count(c), 0);
}

function CommentNode({ n, itemId, op, onChange, favorites, base, depth = 0 }: { n: Node; itemId: number; op: string; onChange: () => void; favorites: number[]; base: string; depth?: number }) {
  const [replying, setReplying] = useState(false);
  const [open, setOpen] = useState(!n.blocked);
  const [folded, setFolded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(n.content);
  const [history, setHistory] = useState<Array<{ content: string; edited: number }> | null>(null);
  const me = useMe();
  const preferences = usePreferences();
  const [error, setError] = useState("");
  const failed = (e: unknown) => setError(e instanceof Error ? e.message : "Fehler");
  const [fullText, setFullText] = useState(false);
  const [score, setScore] = useState(n.up - n.down);
  const hidden = count(n);
  const own = me?.n.toLowerCase() === n.name.toLowerCase();
  const faved = favorites.includes(n.id);
  const longText = n.content.length > 500 || n.content.split("\n").length > 8;

  useEffect(() => {
    setOpen(!(n.blocked && preferences.blockedCommentMode !== "show") && !(preferences.hideDownvotedComments && n.up < n.down));
  }, [n.blocked, preferences.blockedCommentMode, preferences.hideDownvotedComments, n.up, n.down]);
  useEffect(() => {
    if (preferences.autoCollapseDeepComments && depth >= 5) setFolded(true);
  }, [preferences.autoCollapseDeepComments, depth]);

  async function report() {
    const reason = window.prompt("Grund der Meldung?");
    if (reason) await api.post("contact/report", { commentId: n.id, reason }).catch(failed);
  }
  async function block() {
    try {
      await api.post("profile/block", { name: n.name });
      window.dispatchEvent(new Event("bildkeller:blocks")); onChange();
    } catch (e) { failed(e); }
  }
  async function toggleFav() {
    try { await api.post(faved ? "comments/unfav" : "comments/fav", { id: n.id }); onChange(); }
    catch (e) { failed(e); }
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    try {
      await api.post("comments/edit", { id: n.id, content: draft });
      setEditing(false); onChange();
    } catch (e) { failed(e); }
  }
  async function showHistory() {
    try { const r = await api.get("comments/getEditHistory", { id: n.id }); setHistory(r.history ?? []); }
    catch (e) { failed(e); }
  }

  return (
    <div className={`comment-box${preferences.colorCommentIndentationLines ? " colored-indent" : ""}`} id={`comment${n.id}`}>
      <div className="comment">
        <VoteBox kind="comment" id={n.id} up={n.up} down={n.down} initialVote={n.vote ?? null} onScore={setScore} />
        {open && !folded && (editing
          ? (
            <form className="comment-form reply" onSubmit={saveEdit}>
              <textarea className="comment" maxLength={10000} value={draft} onChange={(e) => setDraft(e.target.value)} required />
              <div>
                <button className="primary">Speichern</button>
                <button type="button" onClick={() => { setEditing(false); setDraft(n.content); }}>Abbrechen</button>
              </div>
            </form>
          )
          : <div className={`comment-content${preferences.collapseLongComments && longText && !fullText ? " comment-short" : ""}`}>{n.content.split(/(https?:\/\/[^\s]+|@[\w-]{2,32})/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} className="hot" href={part} target="_blank" rel="noreferrer noopener">{part}</a> : /^@[\w-]{2,32}$/.test(part) ? <Link key={i} className="hot" href={`/user/${part.slice(1)}`}>{part}</Link> : part)}</div>)}
        {open && !folded && preferences.collapseLongComments && longText && <button className="link hot" onClick={() => setFullText(!fullText)}>{fullText ? "weniger anzeigen" : "mehr anzeigen"}</button>}
        <div className="comment-foot">
          {n.name === op && <span className="user-comment-op">OP</span>}
          <Link href={`/user/${n.name}`} className="user">{n.name}</Link>
          <span className="mark" style={{ color: markColor(n.mark) }}>●</span>
          <span className="score">{score} Benis</span>
          <Link className="time" href={`${base}:comment${n.id}`}>{ago(n.created)}{n.editedAt ? " (bearbeitet)" : ""}</Link>
          {me && (
            <button className="link hot comment-reply-link" onClick={() => setReplying(!replying)}>
              <Icon name="reply" size={12} /> antworten
            </button>
          )}
          {me && (
            <button className={`link hot comment-fav${faved ? " on" : ""}`} onClick={toggleFav} title="Favorisieren">
              <Icon name="star" size={12} />
            </button>
          )}
          <button className="link hot fold" aria-label={folded ? "Kommentar ausklappen" : "Kommentar einklappen"} aria-expanded={!folded} onClick={() => setFolded(!folded)}>{folded ? "[+]" : "[–]"}</button>
          {own && <button className="link hot" onClick={() => setEditing(!editing)}>[bearbeiten]</button>}
          {n.editCount > 0 && <button className="link hot" onClick={showHistory}>[verlauf]</button>}
          {me && <span className="bracket">[<button className="link hot" onClick={report}>melden</button>]</span>}
          {me && !own && preferences.showBlockActions && <span className="bracket">[<button className="link hot" onClick={block}>blockieren</button>]</span>}
          {folded && hidden > 0 && <span className="folded-comments-message">({hidden} eingeklappt)</span>}
          {(n.blocked || !open) && <button className="link hot" onClick={() => setOpen(!open)}>{open ? "ausblenden" : "anzeigen"}</button>}
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        {history && (
          <div className="comment-history">
            {history.length === 0 && <span className="dim">Keine älteren Versionen.</span>}
            {history.map((h, i) => (
              <div key={i} className="comment-history-entry">
                <span className="time">{ago(h.edited)}</span> {h.content}
              </div>
            ))}
            <button className="link hot" onClick={() => setHistory(null)}>schließen</button>
          </div>
        )}
        {open && !folded && replying && <Reply itemId={itemId} parent={n.id} onDone={() => { setReplying(false); onChange(); }} />}
      </div>
      {!folded && (open || (n.blocked && preferences.blockedCommentMode === "collapse_comment")) && n.children.map((c) => <CommentNode key={c.id} n={c} itemId={itemId} op={op} onChange={onChange} favorites={favorites} base={base} depth={depth + 1} />)}
    </div>
  );
}

export default function Comments({ itemId, op, comments, onChange, favorites = [] }: { itemId: number; op: string; comments: ApiComment[]; onChange: () => void; favorites?: number[] }) {
  const roots = useMemo(() => tree(comments), [comments]);
  const me = useMe();
  const path = usePathname();
  const base = path.replace(/:comment\d+$/, "");
  return (
    <div className="item-comments">
      <div className="comments-head"><Icon name="comment" size={14} /> {comments.length} {comments.length === 1 ? "Kommentar" : "Kommentare"}</div>
      {me && <Reply itemId={itemId} parent={0} onDone={onChange} />}
      <section className="comments">
        {roots.map((n) => <CommentNode key={n.id} n={n} itemId={itemId} op={op} onChange={onChange} favorites={favorites} base={base} />)}
      </section>
    </div>
  );
}
