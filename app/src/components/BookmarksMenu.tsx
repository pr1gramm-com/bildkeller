"use client";
import Link from "next/link";
import { useMe } from "@/lib/client/api";
import { useSavedSearches } from "@/lib/client/bookmarks";
import { savedSearchHref } from "@/lib/saved-searches";
import { usePreferences } from "@/lib/client/preferences";
import { useEffect, useState } from "react";
import { searchHref } from "@/lib/feed-route";

/** The reference board's "⋯" menu: quick links to the personal feeds. */
export default function BookmarksMenu({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const { searches } = useSavedSearches();
  const preferences = usePreferences();
  const [randomSeed, setRandomSeed] = useState(0);
  useEffect(() => setRandomSeed(Math.floor(Date.now() / 1000)), []);
  const rows: Array<[string, string, string]> = [
    ["/user/uploads", "u", "meine Hochlads"],
    ["/stalk", "@", "Stelzungen"],
    [searchHref("new", `!-(x:random | x:${randomSeed})`), "↝", "Zufall"],
  ];
  return (
    <div id="bookmarks-menu" className="tip-menu bookmarks-menu">
      <div className="tip-menu-body">
        {rows.map(([href, pict, label]) => (
          <div className="bookmark-row" key={href}>
            <Link
              href={href === "/user/uploads" ? me ? `/user/${me.n}/uploads` : "/login" : href}
              onClick={onClose}
            >
              <span className={`pict bookmark-${label.split(" ")[0]}`}>{pict}</span> {label}
            </Link>
          </div>
        ))}
        {searches.map((s) => <div className="bookmark-row" key={savedSearchHref(s)}>
          <Link href={savedSearchHref(s)} onClick={onClose}>{s.name}</Link>
        </div>)}
        {me && <div className="bookmark-row"><Link href="/bookmarks" onClick={onClose}>Lesezeichen verwalten</Link></div>}
        {me && preferences.showSeenNav && <div className="bookmark-row"><Link href="/seen" onClick={onClose}>Gesehene Hochlads</Link></div>}
        <div className="bookmarks-head">
          <span className="bookmarks-head-type">Weitere</span>
          <span className="bookmarks-head-divider" />
        </div>
        <div className="bookmark-row">
          <Link href="/calendar" onClick={onClose}>
            <span className="pict">&#128197;</span> Kalender
          </Link>
        </div>
        <div className="bookmark-row">
          <Link href="/chronicle" onClick={onClose}>
            <span className="pict">&#128339;</span> Chronik
          </Link>
        </div>
      </div>
    </div>
  );
}
