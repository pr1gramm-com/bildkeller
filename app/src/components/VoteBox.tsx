"use client";
import { useEffect, useState } from "react";
import { api, useMe } from "@/lib/client/api";
import { loadVotes, syncOnce } from "@/lib/client/votes";
import Icon from "./Icon";

type Props = { kind: "item" | "comment"; id: number; up: number; down: number; onScore?: (score: number) => void };

/** Own vote state comes from the replayed sync log; counts update by the state delta. */
export default function VoteBox({ kind, id, up, down, onScore }: Props) {
  const key = `${kind === "item" ? "i" : "c"}:${id}`;
  const [mine, setMine] = useState<boolean | undefined>(undefined);
  const [counts, setCounts] = useState({ up, down });
  const me = useMe();

  useEffect(() => setMine(loadVotes()[key]), [key]);
  useEffect(() => setCounts({ up, down }), [up, down]);
  useEffect(() => {
    onScore?.(counts.up - counts.down);
  }, [counts, onScore]);

  async function vote(dir: boolean) {
    if (!me) return;
    await api.post(kind === "item" ? "items/vote" : "comments/vote", { id, up: dir ? 1 : 0 });
    await syncOnce();
    const next = loadVotes()[key];
    setCounts((c) => ({
      up: c.up + (next === true ? 1 : 0) - (mine === true ? 1 : 0),
      down: c.down + (next === false ? 1 : 0) - (mine === false ? 1 : 0),
    }));
    setMine(next);
  }

  return (
    <span className={`vote vote-${kind}${mine === true ? " mine-up" : mine === false ? " mine-down" : ""}`}>
      <button className={mine === true ? "on-up" : ""} onClick={() => vote(true)} disabled={!me} title="Upvote" aria-label="Upvote">
        <Icon name="plus" size={kind === "item" ? 14 : 11} />
      </button>
      <span className="score" title={`${counts.up} up, ${counts.down} down`}>{counts.up - counts.down}</span>
      <button className={mine === false ? "on-down" : ""} onClick={() => vote(false)} disabled={!me} title="Downvote" aria-label="Downvote">
        <Icon name="minus" size={kind === "item" ? 14 : 11} />
      </button>
    </span>
  );
}
