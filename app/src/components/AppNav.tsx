"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, type Me } from "@/lib/client/api";
import { syncOnce } from "@/lib/client/votes";
import FlagFilter from "./FlagFilter";
import Icon from "./Icon";
import Logo from "./Logo";

const BOTTOM = [
  { href: "/top", label: "Beliebt", icon: "star" as const },
  { href: "/new", label: "Neu", icon: "play" as const },
  { href: "/junk", label: "Müll", icon: "comment" as const },
  { href: "/stalk", label: "Abos", icon: "rss" as const },
];

/** pr0.app top bar: logo left, filter/search/create in the middle, notifications and user right. */
export default function AppNav() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    setMe(getMe());
    const tick = () =>
      syncOnce()
        .then((i) => i && setUnread(i.messages + i.notifications))
        .catch(() => undefined);
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [path.split("/")[1] ?? ""]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("tags") ?? params.get("q");
    if (value) setQ(value);
  }, [path]);

  return (
    <>
      <nav id="app-nav">
        <div className="an-left">
          <Link href="/" className="logo" aria-label="Startseite"><Logo /></Link>
          <button
            id="app-burger"
            className="iconbtn"
            aria-label="Menü"
            onClick={() => document.documentElement.classList.toggle("side-open")}
          >
            <Icon name="menu" size={20} />
          </button>
        </div>
        <div className="an-center">
          <FlagFilter />
          <form
            className="an-search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/search?tags=${encodeURIComponent(q)}`);
            }}
          >
            <input id="app-search" placeholder="Suchen" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="iconbtn" aria-label="Suchen"><Icon name="search" size={18} /></button>
          </form>
          <Link href="/upload" className="an-create"><Icon name="plus" size={16} /> Erstellen</Link>
        </div>
        <div className="an-right">
          {me ? (
            <>
              <Link href="/inbox" className="iconbtn" title="Nachrichten" aria-label="Nachrichten">
                <Icon name="mail" size={20} />
                {unread > 0 && <span className="count">{unread}</span>}
              </Link>
              <Link href={`/user/${me.n}`} className="an-user">
                <span className="an-avatar">{me.n.slice(0, 2).toUpperCase()}</span>
                <span className="an-name">{me.n}</span>
                <span className="an-caret">▾</span>
              </Link>
            </>
          ) : (
            <Link href="/login" className="an-user">
              <span className="an-name">anmelden</span>
              <span className="an-caret">▾</span>
            </Link>
          )}
        </div>
      </nav>
      <nav id="app-bottom">
        {BOTTOM.map((t) => (
          <Link key={t.href} href={t.href} className={path === t.href ? "active" : ""}>
            <Icon name={t.icon} size={18} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
