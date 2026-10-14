"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getMe, type Me } from "@/lib/client/api";
import { syncOnce } from "@/lib/client/votes";
import FlagFilter from "./FlagFilter";
import Icon from "./Icon";
import Logo from "./Logo";

const TABS = [
  { href: "/", label: "neu" },
  { href: "/top", label: "beliebt" },
  { href: "/junk", label: "müll" },
];

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
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

  async function logout() {
    await api.post("user/logout").catch(() => undefined);
    setMe(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header id="head">
      <Link href="/" className="logo" aria-label="Startseite"><Logo /></Link>
      <nav>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={path === t.href ? "active" : ""}>{t.label}</Link>
        ))}
      </nav>
      <FlagFilter />
      <form className="search" onSubmit={(e) => { e.preventDefault(); router.push(`/search?tags=${encodeURIComponent(q)}`); }}>
        <input id="search" placeholder="Suche [k]" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="iconbtn" aria-label="Suchen"><Icon name="search" /></button>
      </form>
      <div className="right">
        {me ? (
          <>
            <Link href="/upload" className="iconbtn" title="Upload"><Icon name="upload" /></Link>
            <Link href="/inbox" id="inbox-link" className="iconbtn" title="Nachrichten">
              <Icon name="mail" />
              {unread > 0 && <span className="badge" id="inbox-count">{unread}</span>}
            </Link>
            <Link href={`/user/${me.n}`} id="user-profile-name" className="uname">{me.n}</Link>
            <Link href="/settings" id="settings-link" className="iconbtn" title="Einstellungen"><Icon name="settings" /></Link>
            {me.a === "1" && <Link href="/admin" className="uname">Mod</Link>}
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/register" className="btn-primary">Registrieren</Link>
          </>
        )}
      </div>
    </header>
  );
}
