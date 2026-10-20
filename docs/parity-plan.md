# Imageboard-Parität: Bildkeller, pr0gramm.com und pr0.app

Stand: 2026-10-20. **Keine vollständige 1:1-Parität nachgewiesen.**
Die frühere Aussage „alle Lücken geschlossen“ wurde im erneuten Livevergleich widerlegt.

## Verbindlicher Umfang

Der Nutzer bestätigte: gesamtes Imageboard in beiden Designs. pr0mium/Zahlungen,
Casino, Gamekeys, Kontakte, native Apps und externe Shops gehören nicht zum Auftrag.
Branding und eigene Inhalte bleiben eigenständig; die Referenzen werden beobachtet,
nicht deren Quellcode oder Assets übernommen.

## Vergleich und erste Korrekturen

Referenzen: [pr0gramm.com](https://pr0gramm.com), [pr0.app](https://pr0.app).
Werkzeuge: agent-browser CLI und ego-browser/ego-lite. Die Referenzen wurden nur gelesen.
Lokales Bildkeller wurde über einen SSH-Tunnel gegen eine isolierte Validierungs-VM auf
webserver geprüft, mit eigener PostgreSQL-Instanz und eigenen QA-Konten.

- Startseite zeigt standardmäßig den beliebten Feed.
- `/new`, `/top`, `/junk` unterstützen Suchbegriffe und Beitrags-Deep-Links:
  `/<feed>/<suchbegriff>/<id>`. `/item/<id>` bleibt erreichbar.
- Öffnen, Nachbarbeiträge und Schließen erhalten Feed und Suchfilter; Popular-Deep-Links
  verwenden die Reihenfolge `(promoted, id)`.
- Zahlensuchen werden eindeutig quotiert und nicht als Beitrags-ID interpretiert.
- Mehrteilige quotierte Tags, Apostrophe und ODER ohne Leerzeichen werden verarbeitet.
- Gespeicherte Suchen sind benutzergebundene Lesezeichen mit Name und Feed; Speicherung,
  Aufruf und Entfernen funktionieren. Gleichzeitige Änderungen werden serialisiert.
- „Best of“ verwendet wie der beobachtete Referenzlink den Mindestscore 600.
- Profilmenü, Sidebar einklappen, mobiles Menü und mobile Suche sind bedienbar.
- App-Beiträge stehen unter der angeklickten Kachelreihe, statt erzwungen in Zeile 1.
- Inhaltsfilter haben eindeutige IDs und echte Tastatur-/Checkbox-Bedienung.
- App-Metriken aus dem Livevergleich: Sans-Serif, Desktopheader 64 px, Mobilheader 48 px,
  Sidebar 240 px unter 2000 px bzw. 288 px ab 2000 px, Mobilansicht unter 640 px.

## Noch abzugleichen

Diese Liste ist ein Arbeitsstand und keine abschließende Inventur:

- Sämtliche angebotenen Einstellungen müssen die tatsächliche Darstellung und das
  Verhalten steuern; gespeicherte Werte allein gelten nicht als Umsetzung.
- App-Einstellungen besitzen weitere Bereiche und Layoutvarianten gegenüber Classic.
- Profile: Avatarfunktionen, Sammlungsnavigation, sichtbare Kommentarfavoriten.
- Beiträge/Kommentare: Favoritenzustand, Fehlerbehandlung, Permalinks, Blockverhalten.
- Feed-/Suchfunktionen: weitere Referenzfilter, geklammerte Suchausdrücke,
  blockierte Tags, Abos und Sammlungen.
- Postfach: neue Unterhaltungen, ungelesene Zustände und Sichtbarkeitsfilter.
- Upload und Sammlungen: vollständige Funktions- und Browserabnahme.
- Rückwärtssuche vergleicht bisher nur identische Dateien; Ähnlichkeitssuche fehlt.
- Mail-/Digest-Einstellungen sind bisher keine bestätigte Mailzustellung.

## Zweite Korrektureinheit

- Kontoeinstellungen werden zentral gelesen und nach Änderungen veröffentlicht;
  schnelle Schreibvorgänge werden in Reihenfolge gespeichert.
- Verlauf ist opt-in, benutzergebunden, nach Aufruf sortiert, paginiert und löschbar.
  Gesehene Kacheln, Verlaufsnavigation und Startfeed folgen den Einstellungen.
- Favoriten und eigene Votes zeigen den serverseitigen Zustand. Automatischer
  Favoriten-Upvote ist unter derselben Sperre wie normale Votes idempotent.
  Der lokale Sync speichert Votes und Cursor atomar und funktioniert ohne Browserstorage.
- Kommentare unterstützen Antwort-/Bearbeitungsfehler ohne Entwurfsverlust,
  Bearbeitungsverlauf, direkte Kommentarlinks, Link-/Erwähnungserkennung und
  Einstellungen für lange, negative oder tief verschachtelte Kommentare.
- Kommentarfavoriten respektieren die Profil-Privatsphäre. Öffentliche Sammlungen
  sind für Gäste lesbar; blockierte Tags werden aus Feeds ausgeschlossen.
- Benachrichtigungen sind paginiert und berücksichtigen sichtbare Beiträge;
  das Postfach unterstützt neue Empfänger und erhält fehlgeschlagene Nachrichtenentwürfe.

Remote-Nachweis dieser Einheit: Typecheck und **152/152 Tests in 21 Dateien** bestanden,
Produktionsbuild erfolgreich. Das fokussierte Review der Verlaufsabfrage,
Kommentar-Clipping-, Präferenzcache- und Vote-Synchronisierungskorrekturen ist freigegeben.
Ego-Browser bestätigt Favoriten inklusive automatischem Upvote nach Neuladen sowie
Verlauf und Gesehen-Markierung. Weitere Browserabnahme und die oben genannten Lücken
stehen weiterhin aus; dies ist keine vollständige Paritätsbestätigung.

## Nachweise der ersten Korrektureinheit

In der separaten Validierungs-VM: `pnpm install --frozen-lockfile`, `pnpm type-check`,
`TEST_PG_URL=... pnpm test`: **139/139 Tests, 19 Dateien**; `pnpm build`: erfolgreich.
Es gibt kein Lint-Skript im Repository. Next.js-Dokumentation und Drizzle-Typen wurden
lokal aus den installierten Paketen geprüft. Keine neuen Abhängigkeiten oder Lockfileänderungen.

Browsernachweise liegen lokal unter `.qa/parity-2026-10-20/` (git-ignoriert).
Geprüft wurden unter anderem Suchlesezeichen anlegen/neu laden/entfernen,
Beitrags-Deep-Link/Neu laden/Schließen und mobile Zahlensuche im Produktionsbuild.
Die automatisierten Tests ersetzen keine vollständige Browserabnahme der übrigen Flows.

## Dritte Korrektureinheit

- Sammlungsfeeds paginieren in Hinzufügungsreihenfolge `(added, id)` und prüfen
  öffentlichen Zugriff beziehungsweise Eigentümerschaft.
- Upload-, Sammlungs-, Verlaufs-, Abo- und Chronikfeeds behalten ihren Kontext in
  Beitrags- und Kommentar-URLs, auch nach Neuladen und Schließen.
- Ein Dateiwechsel verwirft sofort den bisherigen Staging-Schlüssel; verspätete
  Uploadantworten können keine neuere Auswahl überschreiben. Objekt-URLs werden
  freigegeben; Dateiauswahl ist per Tastatur erreichbar.
- App-Einstellungen haben zehn eigene Navigationsbereiche; neue Optionsseiten
  für Darstellung, Verhalten, Kommentare, Sicherheit und Blockierungen sind angebunden.
  Seitenbreite, Benutzer-/Tagblockierungen und Kommentar-Blockmodi wirken tatsächlich.
- Die beobachteten Kommentargrenzen sind 400 Zeichen beziehungsweise Tiefe 3;
  negativ bewertete eigene Kommentare bleiben sichtbar.
- Vote-Toggle steuert App-Votes und Tastaturvotes; Eingabefelder bleiben unberührt.
- Mobiles Logo bleibt in Originalgröße, statt auf die kleine Ausschnittbreite zu schrumpfen.

Remote-Typecheck, **156/156 Tests in 22 Dateien** und Produktionsbuild bestanden;
gezieltes Diff-Review freigegeben. Ego bestätigt zehn Einstellungsbereiche,
Seitenbreite nach Reload und Sammlungsbeitrag → Reload → Escape zur Sammlung.
Agent-browser bestätigt: Nach fehlgeschlagenem Ersatzupload ist die alte Datei nicht
mehr absendbar. Die weiteren Layoutvarianten, Avatarfunktionen, besondere Feeds,
Suchgruppen und vollständige Abnahme aller Imageboard-Flows bleiben offen.

## Vierte Korrektureinheit

- Verschachtelte Suchgruppen mit AND, OR und negierten Gruppen werden als
  begrenzter Ausdrucksbaum ausgewertet und parameterisiert in SQL übersetzt.
- Die beobachtete Zufallsroute `!-(x:random | x:<seed>)` liefert eine stabile,
  seedabhängige Reihenfolge mit korrekter Fortsetzung und Beitrags-Deep-Links.
- Browserprüfung fand doppelt kodierte Suchsegmente: Die installierte Next.js-Version
  liefert sie an dieser Seitengrenze kodiert. FeedPage dekodiert genau einmal;
  ein Regressionstest deckt Mehrwortsuche, Prozentliterale und ungültige Kodierung ab.

Remote-Typecheck, **163/163 Tests in 24 Dateien** und Build bestanden; Diff-Review freigegeben.
Browserabnahme mit ego-lite und agent-browser: gruppierte Such-URL liefert passende
Beiträge, Zufallsreihenfolge bleibt nach Reload stabil; Beitrags-Deep-Link, Reload und
Escape erhalten die Zufallssuche. Agent-browser meldet dabei keine Runtime-Fehler.

## Fünfte Korrektureinheit

- Eigene Profilbilder lassen sich als PNG/JPG hochladen, frei positionieren und
  zoomen, speichern und entfernen. Serverseitig: 64–8192 px, höchstens 20 MB,
  normalisierte Ausgabe 512×512 ohne Quellmetadaten; ausschließlich Hash-Dateipfade.
- Avatare erscheinen im Profil, in Kommentaren und in der App-Navigation;
  die Avatar-Anzeige folgt der Kontoeinstellung.
- Session, Nonce und Rate-Limit schützen die Änderung. Der gesamte Multipart-Body
  wird vor Parsing begrenzt, auch ohne Content-Length und bei großen Zusatzfeldern.
  Dasselbe begrenzte Einlesen ersetzt das unbeschränkte Parsing im Medienupload.
- Das App-Profil wechselt bei engem Inhaltsbereich in eine Spalte.

Remote-Typecheck, **171/171 Tests in 26 Dateien**, Produktionsbuild und Sicherheits-
Nachreview bestanden. Ego bestätigt Zuschnitt, 512px-Ausgabe, Reload und Navigation;
agent-browser bestätigt Classic-Anzeige und Entfernen nach Reload ohne Runtimefehler.
Mobiles Profil bei 390×844: kein horizontaler Überlauf.

## Sechste Korrektureinheit

- App-Profile haben getrennte Bereiche für Hochlads, Sammlungen, Kommentare und
  sichtbare Kommentarfavoriten. Kommentarbereiche behalten Profilkopf und Pagination.
  Profilkacheln verlinken in den jeweiligen Upload-/Sammlungsfeed.
- Sammlungsabos zeigen ihren gespeicherten Zustand und lassen sich entfolgen.
  Der Abo-Feed kombiniert gefolgte Benutzer mit Beiträgen abonnierter Sammlungen;
  hinzugefügte Sammlungsbeiträge werden mit ihrem Hinzufügungszeitpunkt berücksichtigt.
- Aboverwaltung listet Benutzer und zugängliche Sammlungen. Private Fremdsammlungen,
  gesperrte Inhaltsratings und blockierte Uploader werden ausgeschlossen.
  Ein leerer Abo-Feed zeigt keine unverbundenen globalen Beiträge.

Remote-Typecheck, **175/175 Tests in 27 Dateien**, Build und Review bestanden.
Zwei-Konten-Browserablauf: Admin erstellt öffentliche Sammlung und fügt Beitrag hinzu;
Alice abonniert, öffnet Beitrag, lädt neu, schließt und entfolgt wieder. Classic über
agent-browser ohne Runtimefehler; App über ego-lite zusätzlich bei 390×844 ohne Überlauf.
