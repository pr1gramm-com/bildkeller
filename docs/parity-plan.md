# Parity-Plan: Bildkeller ↔ pr0gramm.com

Stand: 2026-10-20 · Referenz: https://pr0gramm.com (eingeloggt als `wonka`) · Lokal: http://localhost:3100

## Scope
Alle **Imageboard-Funktionen** von pr0gramm.com. Nicht übernommen (kein Imageboard-Feature, laut
Projekt-Doku bewusst out of scope): Casino/Slots, pr0mium-Bezahlung, OAuth-Autorisierte-Apps,
Push-/SSE-Tiles, Multi-Board, native Apps.

## Ist-Soll (Lücken)

| # | Bereich | pr0gramm | Bildkeller | Status |
|---|---|---|---|---|
| 1 | Header Tabs | `/new` neu, `/top` beliebt, `/junk` müll | `/` neu | ☐ |
| 2 | Header Suche | „Suchbegriffe:" + Suchen + „in:"-Feed-Wahl + „Erweiterte Suche"-Link | nur Input | ☐ |
| 3 | Filter-Menü | Flags, Minimaler Benis, Ausschließen (Tags), Weitere Tags ausschließen, Speichern | nur Flags | ☐ |
| 4 | Feed-Links | u meine Hochlads, @ Stelzungen, Weitere, Kalender, Chronik | – | ☐ |
| 5 | Item-View | Stelzen/Unstelzen, Sammeln, Blockieren, Tag-Ausklappen, 16-Tag-Hinweis | Share/Download/Melden | ☐ |
| 6 | Kommentare | Antworten, Bearbeiten (+Verlauf), Favorisieren, Einklappen, Melden, Blockieren | Basis | ☐ |
| 7 | Einstellungen | 6 Tabs, ~20 Optionen | 3 Anker, 6 Optionen | ☐ |
| 8 | Konto | Username, E-Mail, Selbstsperre, Passwort, lokale Daten, Export, Löschung | Passwort/Export/Löschung | ☐ |
| 9 | Postfach | 7 Tabs (Alle, Kommentare, System, Highlights, Stelz-Abos, PM, Blockierungen) | 2 Tabs | ☐ |
| 10 | Upload | URL, Sammlung, Kommentar, Kontingent, 16 Tags | Datei/Tags/Quelle | ☐ |
| 11 | Suche | 7 Kriterientypen, UND/ODER, Rückwärtssuche, Speichern | 1 Typ, nur UND | ☐ |
| 12 | Profil | Kommentar-Favoriten, „Alle …"-Links, Benutzer-Status, Profilhintergrund | Basis | ☐ |
| 13 | Statische Seiten | FAQ, Grundsätze, Datenschutz, Impressum, Log, Kontakt | – | ☐ |
| 14 | Extra-Feeds | /stalk, /chronicle, /calendar, /user/x/uploads | – | ☐ |

## Phasen
- **P1** Routing + Header + Filter-Menü (1,2,3)
- **P2** Einstellungen: 5 Tabs + Konto (7,8) + Themes + Profilhintergrund
- **P3** Postfach: 7 Tabs (9) + Highlights-Endpunkt
- **P4** Upload (10)
- **P5** Erweiterte Suche (11) + Backend: Datum, Auflösung, Userrang, exakter Tag, User-Liste
- **P6** Profil (12) + Benutzer-Status
- **P7** Item-View + Kommentare (5,6)
- **P8** Extra-Feeds + statische Seiten + Footer (4,13,14)
- **P9** Verify: type-check, Tests, Build, Browser-QA gegen Referenz

## Backend-Erweiterungen (bewusst minimal)
- `tagquery.ts`: `d:`-Datum, `r:`-Auflösung, `m:`-Userrang, exakter vs. Teil-Tag, `u:`-Liste
- `items.get`: `users` (Stelz-Feed), Datum/Auflösung/Rang-Filter
- Neu: `user.changename`, `user.changeemail`, `user.selfban`, `user.invitelist`
- `inbox.digests` (Highlights) und `inbox.all` real statt leer
- `users.background` (Profilhintergrund) + Migration
