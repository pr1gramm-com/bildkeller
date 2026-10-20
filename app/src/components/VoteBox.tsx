"use client";
import { useEffect, useRef, useState } from "react";
import { api, useMe } from "@/lib/client/api";
import { loadVotes, syncOnce } from "@/lib/client/votes";
import Icon from "./Icon";

type Props = { kind: "item" | "comment"; id: number; up: number; down: number; initialVote: boolean | null; onScore?: (score: number) => void };

/** Own vote state comes from the replayed sync log; counts update by the state delta. */
export default function VoteBox({ kind, id, up, down, initialVote, onScore }: Props) {
  const key = `${kind === "item" ? "i" : "c"}:${id}`;
  const [mine, setMine] = useState<boolean | undefined>(undefined);
  const [counts, setCounts] = useState({ up, down });
  const me = useMe();
  const currentVote = useRef<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    currentVote.current = initialVote ?? undefined;
    setMine(currentVote.current);
    const sync = () => {
      const next = loadVotes()[key];
      const previous = currentVote.current;
      currentVote.current = next;
      setCounts((c) => ({ up: c.up + Number(next === true) - Number(previous === true), down: c.down + Number(next === false) - Number(previous === false) }));
      setMine(next);
    };
    window.addEventListener("bildkeller:votes", sync);
    return () => window.removeEventListener("bildkeller:votes", sync);
  }, [key, initialVote]);
  useEffect(() => setCounts({ up, down }), [up, down]);
  useEffect(() => {
    onScore?.(counts.up - counts.down);
  }, [counts, onScore]);

  async function vote(dir: boolean) {
    if (!me || busy) return;
    setBusy(true); setError("");
    try {
      await api.post(kind === "item" ? "items/vote" : "comments/vote", { id, up: dir ? 1 : 0 });
      await syncOnce(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusy(false); }
  }

  return (
    <span className={`vote vote-${kind}${mine === true ? " mine-up" : mine === false ? " mine-down" : ""}`}>
      <button className={mine === true ? "on-up" : ""} onClick={() => vote(true)} disabled={!me || busy} title="Upvote" aria-label="Upvote" aria-pressed={mine === true}>
        <Icon name="plus" size={kind === "item" ? 14 : 11} />
      </button>
      <span className="score" title={`${counts.up} up, ${counts.down} down`}>{counts.up - counts.down}</span>
      <button className={mine === false ? "on-down" : ""} onClick={() => vote(false)} disabled={!me || busy} title="Downvote" aria-label="Downvote" aria-pressed={mine === false}>
        <Icon name="minus" size={kind === "item" ? 14 : 11} />
      </button>
      {error && <span className="err" role="alert">{error}</span>}
    </span>
  );
}
