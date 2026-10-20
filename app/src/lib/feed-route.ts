export type FeedName = "new" | "top" | "junk";

export function feedRoute(feed: FeedName, segments: string[] = []) {
  if (segments.length > 2) return null;
  const last = segments.at(-1) ?? "";
  const item = /^(\d+)(?::comment\d+)?$/.exec(last);
  const isItem = item !== null;
  if (segments.length === 2 && !isItem) return null;
  const id = item ? Number(item[1]) : undefined;
  if (id !== undefined && (!Number.isSafeInteger(id) || id < 1)) return null;
  const tags = segments.length > (isItem ? 1 : 0) ? segments[0] : "";
  const base = `/${feed}${tags ? `/${encodeURIComponent(tags)}` : ""}`;
  return { base, tags, startAt: id };
}

export function itemIdFromPath(path: string): number | null {
  const match = /^\/(?:item|new|top|junk)\/(?:[^/]+\/)?(\d+)(?::comment\d+)?$/.exec(path);
  return match ? Number(match[1]) : null;
}

export function itemHref(base: string, id: number): string {
  return /^\/(new|top|junk)(\/|$)/.test(base) ? `${base}/${id}` : `/item/${id}`;
}

export function searchHref(feed: FeedName, tags: string): string {
  const value = tags.trim();
  const query = /^\d+$/.test(value) ? `'${value}'` : value;
  return `/${feed}${query ? `/${encodeURIComponent(query)}` : ""}`;
}

export function feedPath(path: string) {
  const [, feed, ...segments] = path.split("/");
  if (feed !== "new" && feed !== "top" && feed !== "junk") return null;
  try {
    return feedRoute(feed, segments.map(decodeURIComponent));
  } catch {
    return null;
  }
}
