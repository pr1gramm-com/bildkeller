import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), getMe: vi.fn() }));
vi.mock("@/lib/client/api", () => ({ api: { get: mocks.get }, getMe: mocks.getMe }));

const inbox = { comments: 0, mentions: 0, messages: 0, notifications: 0, follows: 0, digests: 0 };
const response = (up?: boolean, offset = 0) => ({ inbox, nextOffset: offset, hasMore: false, log: btoa(JSON.stringify(up === undefined ? [] : [{ type: "vote", target: "item", id: 5, up }])) });

beforeEach(() => {
  vi.resetModules(); mocks.get.mockReset(); mocks.getMe.mockReset();
  mocks.getMe.mockReturnValue({ id: "qa-session", n: "sync-cache" });
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("client vote synchronization", () => {
  it("shares concurrent background reads but refreshes after a completed mutation", async () => {
    let release: (value: unknown) => void = () => { throw new Error("request not started"); };
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; })).mockResolvedValueOnce(response(true, 1));
    const { syncOnce, loadVotes } = await import("@/lib/client/votes");
    const first = syncOnce();
    expect(syncOnce()).toBe(first);
    const afterMutation = syncOnce(true);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    release(response());
    await afterMutation;
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(loadVotes()).toEqual({ "i:5": true });
  });

  it("replays vote changes once and atomically stores their cursor with the votes", async () => {
    mocks.get.mockResolvedValueOnce(response(true, 1)).mockResolvedValueOnce(response(false, 2)).mockResolvedValueOnce(response(false, 3));
    const { syncOnce, loadVotes } = await import("@/lib/client/votes");
    await syncOnce(); expect(loadVotes()).toEqual({ "i:5": true });
    await syncOnce(); expect(loadVotes()).toEqual({ "i:5": false });
    await syncOnce(); expect(loadVotes()).toEqual({});
    expect(JSON.parse(localStorage.getItem("bk.sync.sync-cache")!)).toEqual({ votes: {}, offset: 3 });
    expect(mocks.get.mock.calls.map(([, query]) => query.offset)).toEqual([0, 1, 2]);
  });

  it("keeps working when browser storage is blocked", async () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    mocks.get.mockResolvedValueOnce(response(true, 1)).mockResolvedValueOnce(response(undefined, 1));
    const { syncOnce, loadVotes } = await import("@/lib/client/votes");
    await syncOnce(); await syncOnce();
    expect(loadVotes()).toEqual({ "i:5": true });
    expect(mocks.get.mock.calls[1][1].offset).toBe(1);
  });
});
