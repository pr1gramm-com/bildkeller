"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getMe, type Me } from "@/lib/client/api";
import { BACKGROUNDS } from "@/lib/backgrounds";

const TABS = [
  { href: "/settings/site", label: "Seite" },
  { href: "/settings/account", label: "Konto" },
  { href: "/settings/invites", label: "Einladungen" },
  { href: "/settings/collections", label: "Kuratierte Sammlungen" },
  { href: "/settings/notifications", label: "Benachrichtigungen" },
  { href: "/settings/apps", label: "Autorisierte Apps" },
];

const THEMES = [
  [0, "bewährtes Orange"], [1, "angenehmes Grün"], [2, "Olivgrün des Friedens"],
  [3, "episches Blau"], [4, "altes Pink"],
] as const;

/** Radio row in the reference board's "Aktiviert / Deaktiviert" style. */
function Radio({ name, value, options, onChange }: { name: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="settings-radio">
      {options.map(([v, label]) => (
        <label key={v}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} /> {label}
        </label>
      ))}
    </div>
  );
}

type Setting = boolean | number | string;

export default function Settings({ tab }: { tab: string }) {
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [s, setS] = useState<Record<string, Setting>>({});
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState({ old: "", next: "" });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [selfban, setSelfban] = useState({ password: "", days: "7" });
  const [pending, setPending] = useState(false);
  const [invite, setInvite] = useState("");
  const [invites, setInvites] = useState<Array<{ code: string; used: boolean; created: number }>>([]);
  const [collections, setCollections] = useState<Array<{ id: number; name: string; isPublic: number; isDefault: number; itemCount: number }>>([]);
  const [newCollection, setNewCollection] = useState("");

  useEffect(() => {
    setMe(getMe());
    setReady(true);
    if (!getMe()) return;
    api.get("user/sync", { offset: 0, limit: 1 }).then((r) => setS(r.settings)).catch(() => undefined);
    api.get("user/deletionStatus").then((r) => setPending(r.pending)).catch(() => undefined);
    api.get("user/info").then((r) => setEmail(r.account?.email ?? "")).catch(() => undefined);
    api.get("user/invitelist").then((r) => setInvites(r.invites ?? [])).catch(() => undefined);
    api.get("collections/get").then((r) => setCollections(r.collections ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = String(s.themeId ?? 0);
  }, [s.themeId]);

  if (!ready) return null;
  if (!me) return <p className="err">Bitte einloggen.</p>;

  const set = (key: string, value: Setting) => {
    setS((prev) => ({ ...prev, [key]: value }));
    void api.post("user/sitesettings", { [key]: value as string | number });
  };
  const run = (p: Promise<unknown>, ok: string) => p.then(() => setMsg(ok)).catch((e) => setMsg(e.message));

  async function logout() {
    await api.post("user/logout").catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="pane-head">Einstellungen</h1>
      <div className="tab-bar">
        <nav>
          {TABS.map((t) => (
            <a key={t.href} href={t.href} className={tab === t.href.split("/").pop() ? "active" : ""}>{t.label}</a>
          ))}
        </nav>
        <button className="action" onClick={logout}>abmelden</button>
      </div>
      <div className="pane">
        {tab === "site" && (
          <>
            <h2 className="settings-heading">Allgemeine Einstellungen</h2>
            <section className="stack">
              <h3>Meine Kommentar-Favoriten sind sichtbar für</h3>
              <Radio name="likesArePublic" value={String(s.likesArePublic ?? false)} options={[["true", "Jeden"], ["false", "Nur für mich"]]} onChange={(v) => set("likesArePublic", v === "true")} />
              <h3>Verhalten beim Favorisieren</h3>
              <Radio name="favUpvote" value={String(s.favUpvote ?? false)} options={[["true", "Automatischer Upvote"], ["false", "Nicht upvoten"]]} onChange={(v) => set("favUpvote", v === "true")} />
              <h3>Medien-Server</h3>
              <Radio name="mediaServer" value={String(s.mediaServer ?? "default")} options={[["default", "Standard-Server (empfohlen)"], ["fallback", "Ausweich-Server"]]} onChange={(v) => set("mediaServer", v)} />
              <h3>Thumbnail-Video-Vorschau</h3>
              <Radio name="showVideoPreview" value={String(s.showVideoPreview ?? true)} options={[["true", "Vorschau bei Videos anzeigen"], ["false", "Vorschau nicht anzeigen"]]} onChange={(v) => set("showVideoPreview", v === "true")} />
              <h3>Wertung rückgängig machen</h3>
              <p className="dim">Bei der Vergabe eines Blussi oder Minus mittels Tastatur kann die Bewertung mit einem erneuten Druck der gleichen Taste wieder rückgängig gemacht werden.</p>
              <Radio name="enableVoteToggle" value={String(s.enableVoteToggle ?? false)} options={[["true", "Aktiviert"], ["false", "Deaktiviert"]]} onChange={(v) => set("enableVoteToggle", v === "true")} />
              <h3>Mülltrennung</h3>
              <p className="dim">Wenn du Mülltrennung deaktivierst, werden Müllhochlads im Neu Feed angezeigt.</p>
              <Radio name="junkSeparation" value={String(s.junkSeparation ?? false)} options={[["true", "Aktiviert"], ["false", "Deaktiviert"]]} onChange={(v) => set("junkSeparation", v === "true")} />
              <h3>Blockieren-Buttons</h3>
              <p className="dim">Blendet die Block-Buttons im Hochlad, in Kommentaren und an Tags aus. Bestehende Blockierungen bleiben aktiv.</p>
              <Radio name="showBlockActions" value={String(s.showBlockActions ?? true)} options={[["true", "Anzeigen"], ["false", "Ausblenden"]]} onChange={(v) => set("showBlockActions", v === "true")} />
              <h3>E-Mail-Benachrichtigungen</h3>
              <p className="dim">Erhalte eine E-Mail, wenn jemand auf deinen Kommentar antwortet oder dir eine private Nachricht schreibt.</p>
              <Radio name="enableEmailNotifications" value={String(s.enableEmailNotifications ?? false)} options={[["true", "E-Mail-Benachrichtigungen aktiviert"], ["false", "Deaktiviert"]]} onChange={(v) => set("enableEmailNotifications", v === "true")} />
              <h3>Zusammenfassungen</h3>
              <p className="dim">Erhalte täglich oder wöchentlich eine Zusammenfassung der Highlights und Top-Hochlads direkt in dein Postfach.</p>
              <Radio name="enableDailyDigest" value={String(s.enableDailyDigest ?? false)} options={[["true", "Tägliche Zusammenfassung"], ["false", "Wöchentliche Zusammenfassung"]]} onChange={(v) => { set("enableDailyDigest", v === "true"); set("enableWeeklyDigest", v !== "true"); }} />
            </section>
            <h2 className="settings-heading">Mein Benutzer-Status</h2>
            <p>{me.n}</p>
            <h2 className="settings-heading">Themes</h2>
            <div className="settings-row">
              {THEMES.map(([id, label]) => (
                <button key={id} className={Number(s.themeId ?? 0) === id ? "primary" : ""} onClick={() => set("themeId", id)}>{label}</button>
              ))}
            </div>
            <h2 className="settings-heading">Verlauf gesehener Hochlads</h2>
            <p className="dim">Beim Aufrufen eines Hochlads wird dieser für dich als gesehen gespeichert.</p>
            <Radio name="enableItemHistory" value={String(s.enableItemHistory ?? false)} options={[["true", "Verlauf speichern"], ["false", "Verlauf nicht speichern"]]} onChange={(v) => set("enableItemHistory", v === "true")} />
            <h2 className="settings-heading">Gesehene Hochlads kennzeichnen</h2>
            <Radio name="markSeenItems" value={String(s.markSeenItems ?? false)} options={[["true", "Gesehene Hochlads kennzeichen"], ["false", "Gesehene Hochlads nicht kennzeichen"]]} onChange={(v) => set("markSeenItems", v === "true")} />
            <h2 className="settings-heading">Profilhintergrund</h2>
            <p className="dim">Gestalte dein Profil einzigartig mit einem Profilhintergrund.</p>
            <div className="settings-row">
              {BACKGROUNDS.map((b) => (
                <button key={b.key} className={b.key === "" ? "" : ""} onClick={() => run(api.post("user/setbackground", { background: b.key }), "Profilhintergrund gespeichert.")}>
                  <span className="color-swatch" style={{ background: b.css || "transparent" }} /> {b.label}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "account" && (
          <>
            <h2 className="settings-heading">Sicherheitseinstellungen ändern</h2>
            <h3>E-Mail Benachrichtigung bei unbekanntem Gerät</h3>
            <Radio name="deviceMail" value={String(s.deviceMail ?? true)} options={[["true", "E-Mail versenden (empfohlen)"], ["false", "E-Mail nicht versenden"]]} onChange={(v) => set("deviceMail", v === "true")} />
            <h2 className="settings-heading">Nutzernamen ändern</h2>
            <p className="dim">Nach erfolgreicher Änderung wirst Du automatisch ausgeloggt!</p>
            <div className="row">
              <input placeholder="Neuer Nutzername" value={name} onChange={(e) => setName(e.target.value)} />
              <button onClick={() => run(api.post("user/changename", { name }), "Nutzername geändert – bitte neu einloggen.")}>Ändern</button>
            </div>
            <h2 className="settings-heading">Selbstsperre</h2>
            <p className="dim">Hier kannst Du Dich für eine Anzahl an Tagen selbst sperren. Dein Profil wird für diesen Zeitraum auf Inaktiv gesetzt.</p>
            <div className="row">
              <input type="password" placeholder="Passwort" value={selfban.password} onChange={(e) => setSelfban({ ...selfban, password: e.target.value })} />
              <input type="number" min={1} max={180} placeholder="Tage" value={selfban.days} onChange={(e) => setSelfban({ ...selfban, days: e.target.value })} />
              <button onClick={() => run(api.post("user/selfban", { password: selfban.password, days: selfban.days }), "Du bist für die angegebene Zeit gesperrt.")}>Sperren</button>
            </div>
            <h2 className="settings-heading">E-Mail Adresse ändern</h2>
            <div className="row">
              <input type="email" placeholder="E-Mail Adresse" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button onClick={() => run(api.post("user/changeemail", { email }), "E-Mail Adresse gespeichert.")}>Ändern</button>
            </div>
            <h2 className="settings-heading">Passwort ändern</h2>
            <div className="row">
              <input type="password" placeholder="Altes Passwort" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
              <input type="password" placeholder="Neues Passwort (min. 8)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              <button onClick={() => run(api.post("user/changepassword", { old: pw.old, new: pw.next }), "Passwort geändert.")}>Ändern</button>
            </div>
            {me.v !== "1" && (
              <>
                <h2 className="settings-heading">Altersbestätigung</h2>
                <button onClick={() => run(api.post("user/ageVerified"), "Altersbestätigung gespeichert – bitte neu einloggen.")}>Ich bin mindestens 18 (NSFW/NSFL freischalten)</button>
              </>
            )}
            <h2 className="settings-heading">Lokale Browserdaten zurücksetzen</h2>
            <p className="dim">Favoriten und Votes werden zusätzlich lokal in deinem Browser abgelegt. Hier kannst du diese Daten löschen und neu erzeugen lassen.</p>
            <button onClick={() => { localStorage.removeItem("pr1.flags"); localStorage.removeItem("pr1.filter"); window.location.reload(); }}>Lokale Daten löschen und neu erzeugen</button>
            <h2 className="settings-heading">Meine Daten (Bestandsdaten-Auskunft)</h2>
            <div className="settings-actions">
              <button onClick={async () => { const r = await api.get("user/dataExport"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" })); a.download = "bildkeller-export.json"; a.click(); }}>⬇ Als JSON herunterladen</button>
            </div>
            <h2 className="settings-heading">Account löschen</h2>
            {!pending ? (
              <button onClick={() => run(api.post("user/requestAccountDeletion").then(() => setPending(true)), "Löschung beantragt.")}>Konto löschen beantragen</button>
            ) : (
              <div className="settings-actions">
                <button className="primary" onClick={() => { if (window.confirm("Konto endgültig löschen?")) void api.post("user/confirmAccountDeletion").then(() => { window.location.href = "/"; }); }}>Löschung bestätigen</button>
                <button onClick={() => run(api.post("user/cancelAccountDeletion").then(() => setPending(false)), "Abgebrochen.")}>Abbrechen</button>
              </div>
            )}
          </>
        )}

        {tab === "invites" && (
          <>
            <h2 className="settings-heading">Einladungen</h2>
            <p className="dim">Mit einer Einladung kannst du Freunde auf das Board holen.</p>
            <button className="primary" onClick={async () => { const r = await api.post("user/invite"); setInvite(r.code); const l = await api.get("user/invitelist"); setInvites(l.invites ?? []); }}>Einladungscode erzeugen</button>
            {invite && <p><code>{invite}</code></p>}
            <table>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.code}>
                    <td><code>{i.code}</code></td>
                    <td>{i.used ? "eingelöst" : "offen"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "collections" && (
          <>
            <h2 className="settings-heading">Kuratierte Sammlungen</h2>
            <p className="dim">Sammlungen, die andere Nutzer sehen und mit ihren eigenen Beiträgen bestücken können.</p>
            <table>
              <tbody>
                {collections.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.isPublic ? "öffentlich" : "privat"}{c.isDefault ? ", Standard" : ""}</td>
                    <td>{c.itemCount} Beiträge</td>
                    <td>
                      <button onClick={() => run(api.post("collections/edit", { collectionId: c.id, isPublic: c.isPublic ? "0" : "1" }), "Gespeichert.")}>{c.isPublic ? "privat machen" : "öffentlich machen"}</button>
                      {!c.isDefault && <button onClick={() => run(api.post("collections/delete", { collectionId: c.id }).then(() => api.get("collections/get").then((r) => setCollections(r.collections ?? []))), "Gelöscht.")}>löschen</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row">
              <input placeholder="Name der Sammlung" value={newCollection} onChange={(e) => setNewCollection(e.target.value)} />
              <button onClick={() => run(api.post("collections/create", { name: newCollection, isPublic: "1" }).then(() => { setNewCollection(""); return api.get("collections/get"); }).then((r) => setCollections(r.collections ?? [])), "Sammlung angelegt.")}>Anlegen</button>
            </div>
          </>
        )}

        {tab === "notifications" && (
          <>
            <h2 className="settings-heading">Benachrichtigungen</h2>
            <h3>E-Mail-Benachrichtigungen</h3>
            <Radio name="enableEmailNotifications" value={String(s.enableEmailNotifications ?? false)} options={[["true", "E-Mail-Benachrichtigungen aktiviert"], ["false", "Deaktiviert"]]} onChange={(v) => set("enableEmailNotifications", v === "true")} />
            <h3>Zusammenfassungen</h3>
            <Radio name="enableDailyDigest" value={String(s.enableDailyDigest ?? false)} options={[["true", "Tägliche Zusammenfassung"], ["false", "Wöchentliche Zusammenfassung"]]} onChange={(v) => { set("enableDailyDigest", v === "true"); set("enableWeeklyDigest", v !== "true"); }} />
            <h3>Push-Notifications</h3>
            <p className="dim">Push-Benachrichtigungen brauchen eine installierte App und sind auf diesem Board nicht verfügbar.</p>
          </>
        )}

        {tab === "apps" && (
          <>
            <h2 className="settings-heading">Autorisierte Apps</h2>
            <p className="dim">Apps, die auf dein Konto zugreifen dürfen.</p>
            <p>Keine autorisierten Apps.</p>
          </>
        )}

        {msg && <p className="dim">{msg}</p>}
      </div>
    </>
  );
}
