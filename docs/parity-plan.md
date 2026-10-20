# Parity-Plan: Bildkeller ↔ pr0gramm.com

Stand: 2026-10-20 · Referenz: https://pr0gramm.com (eingeloggt als `wonka`) · Lokal: http://localhost:3100
Ergebnis: umgesetzt in `9a8700b` (Bericht: `.qa/parity-2026-10-20/report.md`)

## Scope
Alle **Imageboard-Funktionen** von pr0gramm.com. Nicht übernommen (kein Imageboard-Feature, laut
Projekt-Doku bewusst out of scope): Casino/Slots, pr0mium-Bezahlung, OAuth-Autorisierte-Apps,
Push-/SSE-Tiles, Multi-Board, native Apps, Bildscherzgenerator.

## Ist-Soll (Lücken) — alle geschlossen

| # | Bereich | pr0gramm | Bildkeller | Status |
|---|---|---|---|---|
| 1 | Header Tabs | `/new` neu, `/top` beliebt, `/junk` müll | `/` neu | ☑ `/new` ergänzt |
| 2 | Header Suche | „Suchbegriffe:" + Suchen + „in:"-Feed-Wahl + „Erweiterte Suche"-Link | nur Input | ☑ Suchpanel ergänzt |
| 3 | Filter-Menü | Flags, Minimaler Benis, Ausschließen, Weitere Tags ausschließen | nur Flags | ☑ Suchpanel |
| 4 | Feed-Links | u meine Hochlads, @ Stelzungen, Kalender, Chronik | – | ☑ ⋯-Menü + /stalk /calendar /chronicle |
| 5 | Item-View | Stelzen/Unstelzen, Sammeln, Blockieren, Tag-Ausklappen, 16-Tag-Hinweis | Share/Download/Melden | ☑ alle ergänzt |
| 6 | Kommentare | Antworten, Bearbeiten, Verlauf, Favorisieren, Einklappen, Melden, Blockieren | Basis | ☑ alle ergänzt |
| 7 | Einstellungen | 6 Tabs, ~20 Optionen | 3 Anker, 6 Optionen | ☑ 6 Tabs, 20+ Optionen |
| 8 | Konto | Username, E-Mail, Selbstsperre, Passwort, lokale Daten, Export, Löschung | Passwort/Export/Löschung | ☑ alle ergänzt |
| 9 | Postfach | 7 Tabs | 2 Tabs | ☑ 7 Tabs, echte Highlights + Stelz-Feed |
| 10 | Upload | URL, Sammlung, Kommentar, Kontingent, 16 Tags | Datei/Tags/Quelle | ☑ alle ergänzt |
| 11 | Suche | 7 Kriterientypen, UND/ODER, Rückwärtssuche, Speichern | 1 Typ, nur UND | ☑ 7 Typen, UND/ODER, Rückwärtssuche |
| 12 | Profil | Kommentar-Favoriten, „Alle …"-Links, Benutzer-Status, Profilhintergrund | Basis | ☑ alle ergänzt |
| 13 | Statische Seiten | FAQ, Grundsätze, Datenschutz, Impressum, Log, Kontakt | – | ☑ 6 Seiten + Footer |
| 14 | Extra-Feeds | /stalk, /chronicle, /calendar, /user/x/uploads | – | ☑ alle ergänzt |

## Phasen (alle erledigt)
- **P1** Routing + Header + Suchpanel ☑
- **P2** Einstellungen: 6 Tabs + Konto + Themes + Profilhintergrund ☑
- **P3** Postfach: 7 Tabs + Highlights-Endpunkt ☑
- **P4** Upload (URL, Sammlung, Kommentar) ☑
- **P5** Erweiterte Suche + Backend-Grammatik (Datum, Auflösung, Userrang, exakter/Teil-Tag, OR-Gruppen) ☑
- **P6** Profil (Kommentar-Favoriten, Benutzer-Status, Hintergrund) ☑
- **P7** Item-View + Kommentare ☑
- **P8** Extra-Feeds + statische Seiten + Footer ☑
- **P9** Verify: type-check 0 Fehler, 127/127 Tests, Build ok, Browser-QA ohne Fehler ☑

## Backend-Erweiterungen
- `tagquery.ts`: Term-Modell (Tag/Teil-Tag/User/Score/Rang/Datum/Auflösung/Media), Ausschluss-Varianten,
  OR-Gruppen via `|`
- `items.get`: Grammatik, `users`-Liste, `junk=1`, `user=`
- Neu: `items.calendar`, `items.reverse`, `items.setjunk`, `user.changename`, `user.changeemail`,
  `user.selfban`, `user.invitelist`, `user.setbackground`, `inbox.all`, `inbox.stalk`, echtes `inbox.digests`
- `users.background`, `users.inactiveUntil`, `notifications.content` + Migrationen 0002/0003
