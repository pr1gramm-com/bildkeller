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

## Nachweise der ersten Korrektureinheit

In der separaten Validierungs-VM: `pnpm install --frozen-lockfile`, `pnpm type-check`,
`TEST_PG_URL=... pnpm test`: **139/139 Tests, 19 Dateien**; `pnpm build`: erfolgreich.
Es gibt kein Lint-Skript im Repository. Next.js-Dokumentation und Drizzle-Typen wurden
lokal aus den installierten Paketen geprüft. Keine neuen Abhängigkeiten oder Lockfileänderungen.

Browsernachweise liegen lokal unter `.qa/parity-2026-10-20/` (git-ignoriert).
Geprüft wurden unter anderem Suchlesezeichen anlegen/neu laden/entfernen,
Beitrags-Deep-Link/Neu laden/Schließen und mobile Zahlensuche im Produktionsbuild.
Die automatisierten Tests ersetzen keine vollständige Browserabnahme der übrigen Flows.
