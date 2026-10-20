"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Feed from "@/components/Feed";
import { api, getMe } from "@/lib/client/api";

type Subscription = { id: number; name: string; owner: string };

export default function Stalk({ base = "/stalk", startAt }: { base?: string; startAt?: number }) {
  const [names, setNames] = useState<string[]>([]);
  const [collections, setCollections] = useState<Subscription[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [manage, setManage] = useState(false);
  const [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    if (!getMe()) { setReady(true); return; }
    const [users, result] = await Promise.all([api.get("user/followlist"), api.get("collections/subscriptions")]);
    setNames((users.list ?? []).map((user: { name: string }) => user.name));
    setCollections(result.subscriptions ?? []); setReady(true);
  }, []);
  useEffect(() => { void load().catch((e) => { setError(e.message); setReady(true); }); }, [load]);
  async function unfollow(name: string | number) {
    setError("");
    try {
      await api.post(typeof name === "number" ? "collections/unfollow" : "profile/unfollow", typeof name === "number" ? { collectionId: name } : { name });
      await load(); setRevision((value) => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler"); }
  }
  if (!ready) return <p className="dim">Lade…</p>;
  return <>
    <h1 className="pane-head">Abos</h1>
    {error && <p className="err" role="alert">{error}</p>}
    {getMe() ? <button onClick={() => setManage(!manage)} aria-expanded={manage}>Abos verwalten</button> : <p className="dim">Bitte <Link className="hot" href="/login">einloggen</Link>, um Abos zu sehen.</p>}
    {manage && <section className="pane">
      <h2>Benutzer</h2>
      {names.length === 0 && <p className="dim">Keine Benutzer abonniert.</p>}
      {names.map((name) => <div className="preference-row" key={name}><Link href={`/user/${encodeURIComponent(name)}`}>{name}</Link><button onClick={() => unfollow(name)}>Entfolgen</button></div>)}
      <h2>Sammlungen</h2>
      {collections.length === 0 && <p className="dim">Keine Sammlungen abonniert.</p>}
      {collections.map((collection) => <div className="preference-row" key={collection.id}><Link href={`/user/${encodeURIComponent(collection.owner)}/collections/${collection.id}`}>{collection.name} von {collection.owner}</Link><button onClick={() => unfollow(collection.id)}>Entfolgen</button></div>)}
    </section>}
    {names.length || collections.length ? <Feed key={revision} subscribed base={base} startAt={startAt} /> : getMe() && <p className="dim">Du folgst noch niemandem. Abonniere Benutzer oder öffentliche Sammlungen für diesen Feed.</p>}
  </>;
}
