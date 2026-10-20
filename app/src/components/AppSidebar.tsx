"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, useMe } from "@/lib/client/api";
import Icon from "./Icon";
import { useSavedSearches } from "@/lib/client/bookmarks";
import { savedSearchHref } from "@/lib/saved-searches";

const REPO = "https://github.com/pr1gramm-com/bildkeller";

const TABS = [
  { href: "/top", label: "beliebt" },
  { href: "/new", label: "neu" },
  { href: "/junk", label: "müll" },
];

type Collection = { id: number; name: string; isDefault: number; itemCount: number };

/** pr0.app sidebar: feed tabs, navigation, saved posts, collections and the footer links. */
export default function AppSidebar() {
  const path = usePathname();
  const me = useMe();
  const { searches, error } = useSavedSearches();
  const [collections, setCollections] = useState<Collection[]>([]);

  const load = useCallback(() => {
    api.get("collections/get").then((r) => setCollections(r.collections ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!me) return;
    load();
  }, [me, load]);

  async function addCollection() {
    const name = window.prompt("Name der Sammlung:");
    if (!name?.trim()) return;
    await api.post("collections/create", { name: name.trim() }).then(load).catch((e) => window.alert(e.message));
  }

  const nav = [
    { href: "/stalk", label: "Abos", icon: "rss" as const },
    { href: "/top/!%20s%3A600", label: "Best of", icon: "star" as const },
    { href: "/calendar", label: "Kalender", icon: "calendar" as const },
    ...(me ? [{ href: `/user/${me.n}/uploads`, label: "Meine Uploads", icon: "user" as const }] : []),
    ...(me ? [{ href: "/settings", label: "Einstellungen", icon: "settings" as const }] : []),
  ];

  return (
    <aside id="app-side" onClick={(e) => {
      if ((e.target as HTMLElement).closest("a")) document.documentElement.classList.remove("side-open");
    }}>
      <div className="side-tabs" role="tablist">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} role="tab" aria-selected={path === t.href || path.startsWith(`${t.href}/`) || (path === "/" && t.href === "/top")} className={path === t.href || path.startsWith(`${t.href}/`) || (path === "/" && t.href === "/top") ? "active" : ""}>
            {t.label}
          </Link>
        ))}
      </div>

      <nav className="side-nav">
        {nav.map((n) => (
          <Link key={n.href} href={n.href}>
            <Icon name={n.icon} size={16} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>

      <div className="side-section">
        <div className="side-head">
          <span>Lesezeichen</span>
          <span className="side-head-line" />
          <Link href="/search" className="side-add" aria-label="Lesezeichen hinzufügen">+</Link>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
        {searches.length === 0 && <div className="side-empty">Keine Lesezeichen</div>}
        {searches.map((s) => (
          <Link key={savedSearchHref(s)} href={savedSearchHref(s)} className="side-row">
            <Icon name="bookmark" size={14} />
            <span>{s.name}</span>
          </Link>
        ))}
      </div>

      <div className="side-section">
        <div className="side-head">
          <span>Sammlungen</span>
          <span className="side-head-line" />
          {me && <button className="side-add" onClick={addCollection} aria-label="Sammlung anlegen">+</button>}
        </div>
        {collections.length === 0 && <div className="side-empty">Keine Sammlungen</div>}
        {collections.map((c) => (
          <Link key={c.id} href={`/user/${me?.n ?? ""}/collections/${c.id}`} className="side-row">
            <Icon name="bookmark" size={14} />
            <span>{c.name}</span>
          </Link>
        ))}
      </div>

      <div className="side-footer">
        <div className="side-footer-row">
          <Link href="/faq">FAQ</Link>
          <Link href="/principles">Grundsätze</Link>
          <Link href="/contact">Kontakt</Link>
          <Link href="/changelog">Log</Link>
          <Link href="/datasafety">Datenschutz</Link>
          <Link href="/imprint">Impressum</Link>
        </div>
        <div className="side-footer-row">
          <a href={REPO} rel="noreferrer noopener">Quellcode</a>
          <a href={`${REPO}/blob/main/LICENSE`} rel="noreferrer noopener">Lizenz</a>
          <a href={`${REPO}/blob/main/docs/api-spec.md`} rel="noreferrer noopener">API</a>
        </div>
        <div className="side-footer-row">
          <a href={`${REPO}/blob/main/docs/self-hosting.md`} rel="noreferrer noopener">Selbst hosten</a>
        </div>
      </div>
      <button className="side-collapse iconbtn" aria-label="Sidebar einklappen" onClick={() => {
        document.documentElement.classList.add("side-collapsed");
        document.documentElement.classList.remove("side-open");
      }}><Icon name="left" size={16} /></button>
    </aside>
  );
}
