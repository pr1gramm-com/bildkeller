import { api, getMe } from "./api";

type VoteMap = Record<string, boolean>; // "i:<id>" | "c:<id>" -> true=up, false=down
export type Inbox = { comments: number; mentions: number; messages: number; notifications: number; follows: number; digests: number };

const keys = (name: string) => ({ votes: `bk.votes.${name}`, offset: `bk.offset.${name}` });

export function loadVotes(): VoteMap {
  const me = getMe();
  if (!me) return {};
  try {
    return JSON.parse(localStorage.getItem(keys(me.n).votes) ?? "{}") as VoteMap;
  } catch {
    return {};
  }
}

/** Replays the server's vote log (toggle semantics) into a local cache; returns the inbox counters. */
export async function syncOnce(): Promise<Inbox | null> {
  const me = getMe();
  if (!me) return null;
  const k = keys(me.n);
  const votes = loadVotes();
  let offset = Number(localStorage.getItem(k.offset) ?? 0);
  let inbox: Inbox | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const res = await api.get("user/sync", { offset, chunked: "true", limit: 1000 });
    inbox = res.inbox;
    for (const e of JSON.parse(atob(res.log)) as Array<{ type: string; target: string; id: number; up: boolean }>) {
      if (e.type !== "vote") continue;
      const key = `${e.target === "item" ? "i" : "c"}:${e.id}`;
      if (votes[key] === e.up) delete votes[key];
      else votes[key] = e.up;
    }
    offset = res.nextOffset;
    if (!res.hasMore) break;
  }
  localStorage.setItem(k.votes, JSON.stringify(votes));
  localStorage.setItem(k.offset, String(offset));
  return inbox;
}
