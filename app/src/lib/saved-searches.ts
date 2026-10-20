import { searchHref, type FeedName } from "./feed-route";

export type SavedSearch = { name: string; tags: string; feed: FeedName };

export function savedSearches(raw: string): SavedSearch[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((s): s is SavedSearch => s !== null && typeof s === "object"
      && typeof s.name === "string" && s.name.length > 0 && s.name.length <= 100
      && typeof s.tags === "string" && s.tags.length > 0 && s.tags.length <= 1000
      && ["new", "top", "junk"].includes(s.feed)).slice(0, 50);
  } catch {
    return [];
  }
}

export const savedSearchHref = (s: SavedSearch) => searchHref(s.feed, s.tags);
