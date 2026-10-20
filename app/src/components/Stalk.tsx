"use client";
import { useEffect, useState } from "react";
import Feed from "@/components/Feed";
import { api, getMe } from "@/lib/client/api";

/** "Stelzungen": uploads of the users this account follows. */
export default function Stalk() {
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => {
    if (!getMe()) { setNames([]); return; }
    api.get("user/followlist").then((r) => setNames((r.list ?? []).map((u: { name: string }) => u.name))).catch(() => setNames([]));
  }, []);

  if (names === null) return <p className="dim">Lade…</p>;
  if (names.length === 0)
    return (
      <>
        <h1 className="pane-head">Stelzungen</h1>
        <p className="dim">Du folgst noch niemandem. Folge einem Nutzer, um seine Hochlads hier zu sehen.</p>
      </>
    );
  return (
    <>
      <h1 className="pane-head">Stelzungen</h1>
      <Feed users={names.join(",")} base="/stalk" />
    </>
  );
}
