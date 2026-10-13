"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getMe, type Me } from "@/lib/client/api";
import { syncOnce } from "@/lib/client/votes";

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

  useEffect(() => {
    setMe(getMe());
    const tick = () =>
      syncOnce()
        .then((i) => i && setUnread(i.messages + i.notifications))
        .catch(() => undefined);
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [path]);

  async function logout() {
    await api.post("user/logout").catch(() => undefined);
    setMe(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="top">
      <Link href="/" className="logo">Bildkeller</Link>
      <nav>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={path === t.href ? "active" : ""}>{t.label}</Link>
        ))}
      </nav>
      <form onSubmit={(e) => { e.preventDefault(); router.push(`/search?tags=${encodeURIComponent(q)}`); }}>
        <input id="search" placeholder="Suche [k]" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="right">
        {me ? (
          <>
            <Link href="/upload">Upload</Link>
            <Link href="/inbox">Inbox {unread > 0 && <span className="badge">{unread}</span>}</Link>
            <Link href={`/user/${me.n}`}>{me.n}</Link>
            <Link href="/settings">⚙</Link>
            {me.a === "1" && <Link href="/admin">Mod</Link>}
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/register">Registrieren</Link>
          </>
        )}
      </div>
    </header>
  );
}
