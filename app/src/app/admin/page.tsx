"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";

type Report = { id: number; reporter: string; itemId: number | null; commentId: number | null; reason: string; message: string; created: number };

export default function Admin() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [ban, setBan] = useState({ name: "", reason: "", days: "" });
  const [msg, setMsg] = useState("");
  const load = useCallback(() => api.get("admin/reports").then((r) => setReports(r.reports)).catch((e) => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="err">{error === "forbidden" ? "Nur für Moderatoren." : error}</p>;
  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      <div className="panel">
        <h3>Meldungen</h3>
        {reports.length === 0 && <span className="dim">Keine offenen Meldungen.</span>}
        <table><tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td>{r.reporter}</td>
              <td>{r.itemId ? <Link href={`/item/${r.itemId}`}>Beitrag {r.itemId}</Link> : `Kommentar ${r.commentId}`}</td>
              <td>{r.reason} <span className="dim">{r.message}</span></td>
              <td className="row">
                {r.itemId && <button onClick={() => api.post("items/delete", { id: r.itemId! }).then(() => api.post("admin/resolveReport", { id: r.id })).then(load)}>Löschen</button>}
                <button onClick={() => api.post("admin/resolveReport", { id: r.id }).then(load)}>Erledigt</button>
              </td>
            </tr>
          ))}
        </tbody></table>
      </div>
      <form className="panel stack" onSubmit={(e) => { e.preventDefault(); api.post("admin/ban", ban).then(() => setMsg("Gebannt.")).catch((er) => setMsg(er.message)); }}>
        <h3>User bannen</h3>
        <input placeholder="Name" value={ban.name} onChange={(e) => setBan({ ...ban, name: e.target.value })} required />
        <input placeholder="Grund" value={ban.reason} onChange={(e) => setBan({ ...ban, reason: e.target.value })} required />
        <input placeholder="Tage (leer = permanent)" value={ban.days} onChange={(e) => setBan({ ...ban, days: e.target.value })} />
        <div className="row"><button className="primary">Bannen</button>
          <button type="button" onClick={() => api.post("admin/unban", { name: ban.name }).then(() => setMsg("Entbannt.")).catch((er) => setMsg(er.message))}>Entbannen</button></div>
        {msg && <span className="dim">{msg}</span>}
      </form>
    </div>
  );
}
