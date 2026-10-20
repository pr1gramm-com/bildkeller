"use client";
import { useEffect, useState } from "react";

export type Feed = "new" | "top" | "junk";

export type SearchState = {
  terms: string;
  feed: Feed;
  /** Minimaler Benis: minimum net score of a post. */
  minScore: number;
  /** Ausschließen: sound | video | repost | ftb */
  exclude: string[];
  /** Weitere Tags ausschließen */
  excludeTags: string[];
};

export const MEDIA_EXCLUDES = ["sound", "video", "repost", "ftb"] as const;

export const DEFAULT_SEARCH: SearchState = {
  terms: "",
  feed: "new",
  minScore: 0,
  exclude: [],
  excludeTags: [],
};

const KEY = "pr1.search";
const EVENT = "pr1:search";

export function readSearch(): SearchState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SEARCH };
    const s = JSON.parse(raw) as Partial<SearchState>;
    return {
      terms: typeof s.terms === "string" ? s.terms : "",
      feed: s.feed === "top" || s.feed === "junk" ? s.feed : "new",
      minScore: Number.isFinite(Number(s.minScore)) ? Math.max(0, Math.min(100, Number(s.minScore))) : 0,
      exclude: Array.isArray(s.exclude) ? s.exclude.filter((e) => MEDIA_EXCLUDES.includes(e as never)) : [],
      excludeTags: Array.isArray(s.excludeTags) ? s.excludeTags.filter((t) => typeof t === "string" && t.trim()) : [],
    };
  } catch {
    return { ...DEFAULT_SEARCH };
  }
}

export function writeSearch(state: SearchState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage blocked: the state only lives until reload
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Query string for `items.get`: tags to include, media/tags to exclude and the minimum score. */
export function toTags(state: SearchState): string {
  const parts: string[] = state.terms.split(/\s+/).filter(Boolean);
  for (const e of state.exclude) {
    // sound/video/repost are media excludes (quoted in the grammar), ftb is a plain tag
    parts.push(e === "ftb" ? "-ftb" : '-' + '"' + e + '"');
  }
  for (const t of state.excludeTags) parts.push(`-${t.trim().toLowerCase()}`);
  if (state.minScore > 0) parts.push(`s:${state.minScore}`);
  return parts.join(" ");
}

export function useSearch(): SearchState {
  const [state, setState] = useState<SearchState>(DEFAULT_SEARCH);
  useEffect(() => {
    const sync = () => setState(readSearch());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return state;
}
