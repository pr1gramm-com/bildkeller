"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, getMe, type Me } from "@/lib/client/api";
import { feedPath, searchHref } from "@/lib/feed-route";
import { inboxHref, unreadTotal, useInbox } from "@/lib/client/inbox";
import FlagFilter from "./FlagFilter";
import Icon from "./Icon";
import Logo from "./Logo";
import { usePreferences } from "@/lib/client/preferences";
import { avatarPath } from "@/lib/avatar-path";
import { mediaUrl } from "@/lib/client/api";

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
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [menuError, setMenuError] = useState("");
  const userMenu = useRef<HTMLDivElement>(null);
  const preferences = usePreferences();

  const section = path.split("/")[1] ?? "";
  const inbox = useInbox(section);
  const unread = unreadTotal(inbox);

  useEffect(() => setMe(getMe()), [section]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("tags") ?? params.get("q");
    const route = feedPath(path);
    setQ(value ?? route?.tags ?? "");
    setMenu(false);
    setMobileSearch(false);
    document.documentElement.classList.remove("side-open");
  }, [path]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!userMenu.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(false);
      setMobileSearch(false);
      document.documentElement.classList.remove("side-open");
    };
    const observer = new MutationObserver(() => setSideOpen(document.documentElement.classList.contains("side-open")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (mobileSearch) document.getElementById("app-search")?.focus();
  }, [mobileSearch]);

  return (
    <>
      <nav id="app-nav">
        <div className="an-left">
          <Link href="/" className="logo" aria-label="Startseite"><Logo /></Link>
          <button
            id="app-burger"
            className="iconbtn"
            aria-label="Menü"
            aria-controls="app-side"
            aria-expanded={sideOpen}
            onClick={() => {
              document.documentElement.classList.remove("side-collapsed");
              document.documentElement.classList.toggle("side-open");
            }}
          >
            <Icon name="menu" size={20} />
          </button>
        </div>
        <div className="an-center">
          <FlagFilter variant="app" />
          <button className="an-mobile-search iconbtn" aria-label="Suche öffnen" aria-expanded={mobileSearch} aria-controls="app-search-form" onClick={() => setMobileSearch(!mobileSearch)}><Icon name="search" size={18} /></button>
          <form
            id="app-search-form"
            className={`an-search${mobileSearch ? " mobile-search-open" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              const feed = path.startsWith("/new") ? "new" : path.startsWith("/junk") ? "junk" : "top";
              router.push(searchHref(feed, q));
            }}
          >
            <input id="app-search" name="query" aria-label="Suchbegriff" placeholder="Suchen" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="iconbtn" aria-label="Suchen"><Icon name="search" size={18} /></button>
          </form>
          <Link href="/upload" className="an-create"><Icon name="plus" size={16} /> Erstellen</Link>
        </div>
        <div className="an-right">
          {me ? (
            <>
              <Link href={inboxHref(inbox)} className={`iconbtn${unread > 0 ? " has-unread" : ""}`} title="Nachrichten" aria-label={unread > 0 ? `Nachrichten, ${unread} ungelesen` : "Nachrichten"}>
                <Icon name="mail" size={20} />
                {unread > 0 && <span className="count">{unread}</span>}
              </Link>
              <div className="an-user-menu" ref={userMenu}>
                <button className="an-user iconbtn" aria-label={`${me.n}, Profil und Einstellungen`} aria-expanded={menu} aria-controls="app-profile-menu" onClick={() => setMenu(!menu)}>
                  {preferences.showAvatars && avatarPath(preferences.avatar) && <img className="an-avatar" src={mediaUrl(preferences.avatar)} alt="" />}
                  <span className="an-name">{me.n}</span>
                  <span className="an-caret">▾</span>
                </button>
                {menu && <nav id="app-profile-menu" aria-label="Profil und Einstellungen">
                  <Link href={`/user/${me.n}`}>Mein Profil</Link>
                  <Link href="/settings/collections">Sammlungen</Link>
                  <Link href="/bookmarks">Lesezeichen</Link>
                  <Link href={`/user/${me.n}/likes`}>Kommentarfavoriten</Link>
                  <Link href={`/user/${me.n}/uploads`}>Hochlads</Link>
                  <Link href="/settings/account">Einstellungen</Link>
                  <Link href="/chronicle">Chronik</Link>
                  <Link href="/faq">FAQ</Link>
                  <Link href="/principles">Regeln</Link>
                  <button className="link" onClick={async () => {
                    setMenuError("");
                    try { await api.post("user/logout"); window.location.assign("/"); }
                    catch (e) { setMenuError(e instanceof Error ? e.message : "Fehler"); }
                  }}>Abmelden</button>
                  {menuError && <p className="err" role="alert">{menuError}</p>}
                </nav>}
              </div>
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
          <Link key={t.href} href={t.href} className={path === t.href || path.startsWith(`${t.href}/`) || (path === "/" && t.href === "/top") ? "active" : ""}>
            <Icon name={t.icon} size={18} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
      <button id="app-side-backdrop" aria-label="Menü schließen" onClick={() => document.documentElement.classList.remove("side-open")} />
    </>
  );
}
