import Link from "next/link";
import { connection } from "next/server";
import { config } from "@/lib/config";

/** Static information pages, mirroring the reference board's footer pages. */
export default async function TextPage({ slug }: { slug: string }) {
  await connection();
  const name = (await config("site.name")) as string | undefined;
  const operator = (await config("site.operator")) as string | undefined;
  const email = (await config("site.email")) as string | undefined;
  const site = name ?? "Bildkeller";

  const pages: Record<string, { title: string; body: React.ReactNode }> = {
    faq: {
      title: "FAQ",
      body: (
        <>
          <h3>Was kann ich hochladen?</h3>
          <p>JPEG, PNG, GIF, WebM, MP4 und MOV. Bilder bis 50 MB, Videos bis 5 GB. Der Upload zählt gegen dein tägliches Kontingent.</p>
          <h3>Was bedeuten die Einstufungen?</h3>
          <p><b>sfw</b> ist für alle sichtbar. <b>nsfw</b> und <b>nsfl</b> brauchen eine Altersbestätigung. <b>nsfp</b> ist nur für registrierte Nutzer sichtbar, <b>pol</b> markiert politische und wirtschaftliche Themen.</p>
          <h3>Was ist der Benis?</h3>
          <p>Der Benis ist dein Punktestand: er verdoppelt sich für jede positive Bewertung deiner eigenen Hochlads und zählt für jeden Kommentar.</p>
          <h3>Wie funktioniert die Suche?</h3>
          <p>Die Suchleiste kennt eine eigene Syntax: <code>! katze -hund</code> schließt Tags aus, <code>s:100</code> setzt einen Mindest-Benis, <code>u:name</code> sucht Uploads eines Nutzers, <code>~kat</code> sucht Tags, die „kat" enthalten, <code>d:2024-01-01..2024-12-31</code> einen Zeitraum und <code>r:1920x1080</code> eine Auflösung. Die erweiterte Suche erklärt alles im Detail.</p>
          <h3>Wie bearbeite ich einen Kommentar?</h3>
          <p>Eigene Kommentare lassen sich über „[bearbeiten]" ändern; ältere Versionen bleiben unter „[verlauf]" sichtbar.</p>
          <h3>Wie lösche ich ein Hochlad?</h3>
          <p>Über „[löschen]" im Beitrag. Das Medium wird dabei auch vom Server entfernt.</p>
          <h3>Gibt es eine API?</h3>
          <p>Ja. Alle Endpunkte stehen unter <code>/api/</code> und sind in der <a href="https://github.com/pr1gramm-com/bildkeller/blob/main/docs/api-spec.md" rel="noreferrer noopener">API-Dokumentation</a> beschrieben.</p>
        </>
      ),
    },
    principles: {
      title: "Grundsätze",
      body: (
        <>
          <p>Damit ein Bildboard für alle angenehm bleibt, gelten einige Regeln:</p>
          <ul>
            <li>Keine Beleidigungen, keine Belästigung, keine Personalausgriffe.</li>
            <li>Kein Spam, keine Werbung, keine KI-Spam-Farmen.</li>
            <li>Keine illegalen Inhalte, keine Hetze, keine Verbreitung von personenbezogenen Daten.</li>
            <li>NSFW und NSFL werden immer richtig eingestuft – eine falsche Einstufung ist ein Grund für eine Meldung.</li>
            <li>Respektiere die Rechte der Urheber und gib die Quelle an, wenn sie dir bekannt ist.</li>
            <li>Markiere Beiträge, die nicht in den normalen Feed gehören, als Müll.</li>
          </ul>
          <p>Verstöße werden gemeldet und können zu einer Sperre führen.</p>
        </>
      ),
    },
    datasafety: {
      title: "Datenschutz",
      body: (
        <>
          <h3>Welche Daten werden gespeichert?</h3>
          <p>Dein Benutzername, deine E-Mail-Adresse (falls angegeben), dein Passwort (nur als Hash), deine Hochlads, Kommentare, Bewertungen, Nachrichten und Einstellungen.</p>
          <h3>Cookies</h3>
          <p>Nach dem Anmelden wird ein Sitzungs-Cookie gesetzt. Filter und Favoriten werden lokal in deinem Browser gespeichert und nicht übertragen.</p>
          <h3>Deine Rechte</h3>
          <p>Unter <Link href="/settings/account">Konto</Link> kannst du deine Daten als JSON exportieren, dein Konto löschen oder dein Passwort ändern.</p>
          <h3>Drittanbieter</h3>
          <p>Es werden keine Daten an Drittanbieter übertragen. Es kommen keine Tracker, keine Werbung und keine externen Einbettungen zum Einsatz.</p>
        </>
      ),
    },
    imprint: {
      title: "Impressum",
      body: (
        <>
          <p>Angaben gemäß § 5 DDG:</p>
          <p>Betreiber: {operator ?? "wird vom Betreiber dieses Boards eingetragen"}</p>
          <p>E-Mail: {email ?? "wird vom Betreiber dieses Boards eingetragen"}</p>
          <p>Diese Seite läuft auf einer selbst gehosteten Instanz von {site}. Der Betreiber der Instanz ist für den Inhalt verantwortlich.</p>
        </>
      ),
    },
    changelog: {
      title: "Log",
      body: (
        <>
          <h3>Aktuell</h3>
          <ul>
            <li>Erweiterte Suche mit sieben Kriterientypen, UND/ODER-Verknüpfung und Rückwärtssuche</li>
            <li>Suche im Kopfmenü mit Mindest-Benis, Ausschluss-Tags und Feed-Wahl</li>
            <li>Postfach mit sieben Reitern (Alle, Kommentare, Systembenachrichtigungen, Highlights, Stelz-Abos, Private Nachrichten, Blockierungen)</li>
            <li>Einstellungen mit Reitern für Seite, Konto, Einladungen, Kuratierte Sammlungen, Benachrichtigungen und Apps</li>
            <li>Upload per URL, in Sammlungen und mit Kommentar</li>
            <li>Stelzungen, Chronik und Kalender</li>
            <li>Themes, Profilhintergrund und Benutzer-Status</li>
          </ul>
          <h3>API</h3>
          <p>Die API folgt der Struktur des Referenz-Boards: Endpunkte, Parameter und Antwortformen sind unter <code>/api/</code> verfügbar und in der <a href="https://github.com/pr1gramm-com/bildkeller/blob/main/docs/api-spec.md" rel="noreferrer noopener">API-Dokumentation</a> beschrieben.</p>
        </>
      ),
    },
    contact: {
      title: "Kontakt",
      body: (
        <>
          <p>Für Fragen zum Board, zu Meldungen oder zu einer Anzeige wende dich bitte an:</p>
          <p>{email ?? "wird vom Betreiber dieses Boards eingetragen"}</p>
          <h3>Verstöße melden</h3>
          <p>Beiträge und Kommentare lassen sich direkt über den Button „[melden]" im jeweiligen Beitrag melden. Meldungen werden von den Moderatoren bearbeitet.</p>
        </>
      ),
    },
  };

  const page = pages[slug];
  if (!page) return null;
  return (
    <>
      <h1 className="pane-head">{page.title}</h1>
      <div className="pane text-page">{page.body}</div>
    </>
  );
}
