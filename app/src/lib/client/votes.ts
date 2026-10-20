import { api, getMe } from "./api";

type VoteMap = Record<string, boolean>;
type Cache = { votes: VoteMap; offset: number };
export type Inbox = { comments: number; mentions: number; messages: number; notifications: number; follows: number; digests: number };

const memory = new Map<string, Cache>();
let storageBlocked = false;

function readCache(name: string): Cache {
  if (!storageBlocked) {
    try {
      const raw = localStorage.getItem(`bk.sync.${name}`);
      const value = raw ? JSON.parse(raw) as Partial<Cache> : {
        votes: JSON.parse(localStorage.getItem(`bk.votes.${name}`) ?? "{}") as VoteMap,
        offset: Number(localStorage.getItem(`bk.offset.${name}`) ?? 0),
      };
      if (value && typeof value.votes === "object" && value.votes !== null && Number.isSafeInteger(value.offset) && Number(value.offset) >= 0) {
        return { offset: Number(value.offset), votes: Object.fromEntries(Object.entries(value.votes).filter(([key, vote]) => /^[ic]:\d+$/.test(key) && typeof vote === "boolean")) };
      }
    } catch { storageBlocked = true; }
  }
  return memory.get(name) ?? { votes: {}, offset: 0 };
}

export function loadVotes(): VoteMap {
  const me = getMe();
  return me ? readCache(me.n).votes : {};
}

let inFlight: { owner: string; request: Promise<Inbox | null> } | null = null;

/** Shares background reads; a mutation requests a fresh snapshot after any existing read. */
export function syncOnce(fresh = false): Promise<Inbox | null> {
  const owner = getMe()?.id ?? "";
  if (inFlight?.owner === owner) return fresh
    ? inFlight.request.catch(() => null).then(() => syncOnce())
    : inFlight.request;
  const request = replay().finally(() => { if (inFlight?.request === request) inFlight = null; });
  inFlight = { owner, request };
  return request;
}

async function replay(): Promise<Inbox | null> {
  const me = getMe();
  if (!me) return null;
  const cache = readCache(me.n);
  const votes = { ...cache.votes };
  let offset = cache.offset;
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
  const next = { votes, offset };
  memory.set(me.n, next);
  if (!storageBlocked) {
    try { localStorage.setItem(`bk.sync.${me.n}`, JSON.stringify(next)); }
    catch { storageBlocked = true; }
  }
  window.dispatchEvent(new Event("bildkeller:votes"));
  return inbox;
}
