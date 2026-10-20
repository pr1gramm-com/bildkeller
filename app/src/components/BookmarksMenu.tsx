"use client";
import Link from "next/link";
import { useMe } from "@/lib/client/api";

/** The reference board's "⋯" menu: quick links to the personal feeds. */
export default function BookmarksMenu({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const rows: Array<[string, string, string]> = [
    ["/user/uploads", "u", "meine Hochlads"],
    ["/stalk", "@", "Stelzungen"],
  ];
  return (
    <div id="bookmarks-menu" className="tip-menu bookmarks-menu">
      <div className="tip-menu-body">
        {rows.map(([href, pict, label]) => (
          <div className="bookmark-row" key={href}>
            <Link
              href={href === "/user/uploads" ? `/user/${me?.n ?? ""}/uploads` : href}
              onClick={onClose}
            >
              <span className={`pict bookmark-${label.split(" ")[0]}`}>{pict}</span> {label}
            </Link>
          </div>
        ))}
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
