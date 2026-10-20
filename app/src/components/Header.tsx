"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, type Me } from "@/lib/client/api";
import { syncOnce } from "@/lib/client/votes";
import { useSearch } from "@/lib/client/search";
import BookmarksMenu from "./BookmarksMenu";
import FlagFilter from "./FlagFilter";
import Icon from "./Icon";
import Logo from "./Logo";
import SearchMenu from "./SearchMenu";

const TABS = [
  { href: "/new", label: "neu" },
  { href: "/top", label: "beliebt" },
  { href: "/junk", label: "müll" },
];

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<"search" | "bookmarks" | null>(null);
  const search = useSearch();
  const section = path.split("/")[1] ?? ""; // opening posts inline changes the path; only a real section change re-syncs

  useEffect(() => {
    setMe(getMe());
    const tick = () =>
      syncOnce()
        .then((i) => i && setUnread(i.messages + i.notifications))
        .catch(() => undefined);
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [section]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("tags") ?? params.get("q");
    if (value) setQ(value);
  }, [path]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  return (
    <header id="head">
      <Link href="/" className="logo" aria-label="Startseite"><Logo /></Link>
      <nav>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={path === t.href ? "active" : ""}>{t.label}</Link>
        ))}
      </nav>
      <button
        id="bookmarks-link"
        className="iconbtn"
        title="Lesezeichen und Feeds"
        aria-label="Lesezeichen und Feeds"
        aria-expanded={menu === "bookmarks"}
        onClick={(e) => { e.stopPropagation(); setMenu(menu === "bookmarks" ? null : "bookmarks"); }}
      >
        &#8943;
      </button>
      {me && <FlagFilter />}
      <form className="search" onSubmit={(e) => { e.preventDefault(); router.push(`/search?tags=${encodeURIComponent(q)}`); }}>
        <input id="search" placeholder="Suchen" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="iconbtn" aria-label="Suchen"><Icon name="search" size={18} /></button>
      </form>
      <button
        id="search-button"
        className="iconbtn"
        title="Erweiterte Suche"
        aria-label="Erweiterte Suche"
        aria-expanded={menu === "search"}
        onClick={(e) => { e.stopPropagation(); setMenu(menu === "search" ? null : "search"); }}
      >
        q
      </button>
      {me && (
        <Link href="/upload" className="iconbtn head-upload" title="Upload" aria-label="Upload">
          <Icon name="upload" size={20} />
        </Link>
      )}
      <div className="right">
        {me ? (
          <>
            {me.a === "1" && <Link href="/admin" className="pill">Mod</Link>}
            <Link href={`/user/${me.n}`} id="user-profile-name" className="uname">{me.n}</Link>
            <Link href="/inbox" id="inbox-link" className="iconbtn" title="Nachrichten">
              <Icon name="mail" size={20} />
              <span className="count" id="inbox-count">{unread}</span>
            </Link>
            <Link href="/settings" id="settings-link" className="iconbtn" title="Einstellungen">
              <Icon name="settings" size={20} />
            </Link>
          </>
        ) : (
          <Link href="/login" className="login-link"><Icon name="star" size={14} /> anmelden</Link>
        )}
      </div>
      {menu === "search" && (
        <div onClick={(e) => e.stopPropagation()}>
          <SearchMenu state={search} onClose={() => setMenu(null)} />
        </div>
      )}
      {menu === "bookmarks" && (
        <div onClick={(e) => e.stopPropagation()}>
          <BookmarksMenu onClose={() => setMenu(null)} />
        </div>
      )}
    </header>
  );
}
