"use client";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/client/api";
import { deleteSearch, useSavedSearches } from "@/lib/client/bookmarks";
import { savedSearchHref } from "@/lib/saved-searches";

export default function SavedSearches() {
  const me = useMe();
  const { searches, error } = useSavedSearches();
  const [actionError, setActionError] = useState("");
  return <div className="pane">
    <h1 className="pane-head">Lesezeichen</h1>
    {!me ? <Link href="/login">Bitte einloggen.</Link> : <>
      <Link className="hot" href="/search">Lesezeichen hinzufügen</Link>
      {(error || actionError) && <p className="err" role="alert">{error || actionError}</p>}
      {searches.length === 0 && <p className="dim">Keine Lesezeichen.</p>}
      {searches.map((s) => <div className="saved-search-row" key={savedSearchHref(s)}>
        <Link className="hot" href={savedSearchHref(s)}>{s.name}</Link>
        <span className="dim">{s.feed === "top" ? "beliebt" : s.feed === "new" ? "neu" : "müll"}</span>
        <button className="link" onClick={() => {
          setActionError("");
          void deleteSearch(s).catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Fehler"));
        }}>Entfernen</button>
      </div>)}
    </>}
  </div>;
}
