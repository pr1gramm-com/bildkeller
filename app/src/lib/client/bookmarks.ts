"use client";
import { useEffect, useState } from "react";
import { api, getMe, SESSION_EVENT } from "./api";
import type { SavedSearch } from "@/lib/saved-searches";

const EVENT = "bildkeller:bookmarks";

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () => {
      if (!getMe()) return;
      api.get("bookmarks/get").then((r) => {
        if (active) { setSearches(r.searches ?? []); setError(""); }
      }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Fehler"); });
    };
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener(SESSION_EVENT, load);
    return () => { active = false; window.removeEventListener(EVENT, load); window.removeEventListener(SESSION_EVENT, load); };
  }, []);
  return { searches, error };
}

export async function saveSearch(search: SavedSearch) {
  await api.post("bookmarks/saveSearch", search);
  window.dispatchEvent(new Event(EVENT));
}

export async function deleteSearch(search: SavedSearch) {
  await api.post("bookmarks/deleteSearch", { feed: search.feed, tags: search.tags });
  window.dispatchEvent(new Event(EVENT));
}
