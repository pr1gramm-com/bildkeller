"use client";
import { useEffect, useState } from "react";
import { api, getMe } from "@/lib/client/api";

const TOGGLES: Array<[string, string]> = [
  ["enableVoteToggle", "Votes zurücknehmen erlauben"], ["favUpvote", "Upvote favorisiert automatisch"],
  ["showVideoPreview", "Video-Vorschau"], ["junkSeparation", "Müll vom Hauptfeed trennen"],
  ["hideDownvotedComments", "Schlecht bewertete Kommentare ausblenden"], ["showAvatars", "Avatare zeigen"],
];

export default function Settings() {
  const [s, setS] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [invite, setInvite] = useState("");
  const [pw, setPw] = useState({ old: "", next: "" });
  const [pending, setPending] = useState(false);
  const me = getMe();

  useEffect(() => {
    if (!me) return;
    api.get("user/sync", { offset: 0, limit: 1 }).then((r) => setS(r.settings)).catch(() => undefined);
    api.get("user/deletionStatus").then((r) => setPending(r.pending)).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return <p className="err">Bitte einloggen.</p>;
  const run = (p: Promise<unknown>, ok: string) => p.then(() => setMsg(ok)).catch((e) => setMsg(e.message));

  return (
    <div className="stack">
      <div className="panel stack">
        <h3>Anzeige</h3>
        {TOGGLES.map(([k, label]) => (
          <label key={k} className="row"><input type="checkbox" checked={Boolean(s[k])} onChange={(e) => { setS({ ...s, [k]: e.target.checked }); void api.post("user/sitesettings", { [k]: e.target.checked ? 1 : 0 }); }} /> {label}</label>
        ))}
      </div>
      <div className="panel stack">
        <h3>Konto</h3>
        {me.v !== "1" && <button onClick={() => run(api.post("user/ageVerified"), "Altersbestätigung gespeichert – bitte neu einloggen.")}>Ich bin mindestens 18 (NSFW/NSFL freischalten)</button>}
        <button onClick={async () => { const r = await api.post("user/invite"); setInvite(r.code); }}>Einladungscode erzeugen</button>
        {invite && <code>{invite}</code>}
        <input type="password" placeholder="Altes Passwort" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
        <input type="password" placeholder="Neues Passwort (min. 8)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <button onClick={() => run(api.post("user/changepassword", { old: pw.old, new: pw.next }), "Passwort geändert.")}>Passwort ändern</button>
      </div>
      <div className="panel stack">
        <h3>Daten & Löschung</h3>
        <button onClick={async () => { const r = await api.get("user/dataExport"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" })); a.download = "bildkeller-export.json"; a.click(); }}>Daten exportieren</button>
        {!pending ? (
          <button onClick={() => run(api.post("user/requestAccountDeletion").then(() => setPending(true)), "Löschung beantragt.")}>Konto löschen beantragen</button>
        ) : (
          <div className="row">
            <button className="primary" onClick={() => { if (window.confirm("Konto endgültig löschen?")) void api.post("user/confirmAccountDeletion").then(() => { window.location.href = "/"; }); }}>Löschung bestätigen</button>
            <button onClick={() => run(api.post("user/cancelAccountDeletion").then(() => setPending(false)), "Abgebrochen.")}>Abbrechen</button>
          </div>
        )}
      </div>
      {msg && <span className="dim">{msg}</span>}
    </div>
  );
}
