"use client";
import { useEffect, useState } from "react";
import { api, getMe } from "@/lib/client/api";
import { loadVotes, syncOnce } from "@/lib/client/votes";

type Props = { kind: "item" | "comment"; id: number; up: number; down: number };

/** Own vote state comes from the replayed sync log; counts update by the state delta. */
export default function VoteBox({ kind, id, up, down }: Props) {
  const key = `${kind === "item" ? "i" : "c"}:${id}`;
  const [mine, setMine] = useState<boolean | undefined>(undefined);
  const [counts, setCounts] = useState({ up, down });
  const me = getMe();

  useEffect(() => setMine(loadVotes()[key]), [key]);
  useEffect(() => setCounts({ up, down }), [up, down]);

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
    <span className="vote row" style={{ gap: ".3rem" }}>
      <button className={mine === true ? "on-up" : ""} onClick={() => vote(true)} disabled={!me} title="Upvote">▲ {counts.up}</button>
      <button className={mine === false ? "on-down" : ""} onClick={() => vote(false)} disabled={!me} title="Downvote">▼ {counts.down}</button>
    </span>
  );
}
