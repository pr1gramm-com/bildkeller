# Bildkeller — Design-Dokument

**Datum:** 2026-10-13 · **Status:** Draft (wartet auf Builder-Check + Freigabe) · **Lizenz (Entscheidung):** AGPL-3.0

---

## 1. Intent & Warum

Ein selbst-hostbares, Open-Source-Imageboard im Stil von pr0gramm: ein einzelner Bild-/Video-Stream mit Voting, Tags, threaded Comments, Benis-Score und komplettem Social-Layer (Profile, Follow, Inbox, Collections). Das Verhalten wurde durch dokumentiertes Reverse-Engineering erfasst (`~/pr0gramm-re/findings.md` — Feature-Mechanik, API-Endpunkte, Response-Schemas).

**Kernversprechen:** API-kompatibler Drop-in-Ersatz. Der Server implementiert die dokumentierten pr0gramm-Endpunkte und Response-Shapes, sodass bestehende pr0gramm-Clients/-Apps über Base-URL-Umschaltung dagegen arbeiten können. Dazu ein eigener Web-Client mit eigenem Design/Branding (Clean-Room — kein Code, keine Templates, keine Assets, kein Name von pr0gramm).

**Warum:** Es gibt keine wartbare, moderne, self-hostbare Imageboard-Software mit dieser Feature-Dichte (Feed-Mechanik + Social + Moderation). Klassische Boards (vichan & Co.) sind thread-/board-basiert; hier ist es ein Single-Stream-Modell.

## 2. Ziele

1. **API-Parität:** Alle in `findings.md` §6 gelisteten v1-Endpunkte mit beobachteten Request-Parametern und Response-Shapes (Quelle: `~/pr0gramm-re/schemas/*.json`).
2. **Kern-Loop:** Upload (PNG/JPEG/GIF/WEBM/MP4/MOV inkl. Thumb-Generierung), Feeds (neu/beliebt/müll, Tag-Feeds), Cursor-Pagination (`older=<itemId>`), Voting (Item+Kommentar, Toggle), Tags mit per-Tag-Votes + Confidence-Sorting, threaded Comments (parent-basiert, Edit-History), Favoriten/Bookmarks, Repost-Erkennung, Upload-Rate-Limits.
3. **Social:** Profile (Benis, Uploads-, Comments-, Kommentar-Likes-Views), Follow/Subscribe, Inbox (Nachrichten, Notifications, Mentions), Collections (erstellen/folgen/kuratieren), Block-Listen (User + Tags), Bookmarks.
4. **Betrieb:** Invite-Registrierung, Session-Auth (`me`-Cookie, langlebig), `_nonce`-CSRF-Verhalten, Sync-Endpoint (`user/sync` mit Event-Log + Inbox-Counter + Settings), Report-System, Mod-Tools (Delete, Ban), Admin-UI.
5. **Self-Hosting:** `docker compose up` reicht (App + Postgres, optional MinIO für S3). Läuft auch auf Dokploy.

## 3. Non-Goals (v1)

- Casino/Event-Spiele, Secret Santa, Meme-Generator, Kalender, Umfragen (polls), SSE-Live-Tiles
- pr0mium/Payments, Spenden-Backends, OAuth-Provider-Rolle
- Mobile-App (PWA-Manifest ja, native App nein)
- Multi-Board/Multi-Community (bewusst Single-Stream wie das Vorbild)

## 4. Anti-Goals (harte Grenzen)

- **Kein pr0gramm-Branding:** kein Name, keine Logos, keine pictogramm-Icons, kein 1:1-Design-Klon.
- **Kein kopierter Code/Templates:** Alles neu implementiert; Quelle der Wahrheit ist ausschließlich die Verhaltensdokumentation.
- **Kein Data-Mining:** Kein Tracking, keine Ads-Integration.

## 5. Feststehende Entscheidungen

| # | Entscheidung | Von wem | Begründung |
|---|---|---|---|
| D1 | Name **„Bildkeller"** | Ich (User: egal) | Umbenennbar; Branding zentral in `config/branding` |
| D2 | Lizenz **AGPL-3.0** | Ich | Server-Software-Standard; verhindert Closed-Source-Forks |
| D3 | **API 1:1 kompatibel** (Endpunkte + Response-Shapes) | User | Drop-in für bestehende Clients |
| D4 | Stack: **Next.js 16 (App Router, TS strict) als Monolith** — Route Handlers als API, Server Components für Shell, Client-Komponenten für Feed/Item | User-Stack | Eine App statt getrennter Server; genügt der Last |
| D5 | **PostgreSQL + Drizzle ORM** | User-Stack | — |
| D6 | **Eigene Cookie-Sessions statt Clerk** | Ich | OSS-Self-Hosting darf keine SaaS-Abhängigkeit haben |
| D7 | Media: **lokaler FS-Storage default, S3-kompatibel optional**; ffmpeg für Video-Thumbs/Dauer | Ich | Standard-Split |
| D8 | Deployment: **Docker-Compose** (+ Dokploy-kompatibel) | Ich | Self-Hosting-Anforderung |
| D9 | Monorepo: `app/` (Next.js), `worker/` (Media-Processing), `packages/db` (Drizzle-Schema), `docs/` | Ich | Trennung, weil ffmpeg-Prozesse nicht in den Web-Prozess gehören |
| D10 | **Zielclient der API-Parität:** cookie-basierte Web-Clients / generische API-Clients; unser eigener Client ist Referenz-Consumer. Offizielle pr0gramm-Apps (OAuth-Login) sind **nicht** Ziel — OAuth ist Non-Goal | Ich (folgt aus D3 + Non-Goals) | Macht „1:1" testbar: Acceptance = eigener Client + Contract-Tests gegen HAR-Schemas |
| D11 | **Nicht implementierte Endpunkt-Familien** (Casino, Memes, Calendar, Polls, SecretSanta, pr0mium/Payments, OAuth, Push, SSE-Tiles) antworten mit JSON-Error-Umschlag `{error: …}`, nicht 404 — Clients degradieren sauber | Ich | Reviewer-Punkt; günstiger als 404 für Kompatibilität |
| D12 | **v1-Endpoint-Set:** Kern + Social + Moderation vollständig; dazu die günstigen Extras (`contact.*`, `faq.*`, `stats.user`, GDPR-Satz). E-Mail-Versand optional (Warteschlange + Admin-Ansicht als Fallback, SMTP konfigurierbar) | Ich | GDPR ohne SMTP-Pflicht hält Self-Hosting einfach |
| D13 | **Promotion-Regel (eigene Definition, admin-konfigurierbar):** Item wird „promoted", wenn Net-Score (up−down) ≥ Schwelle (Default 3) nach Gnadenfrist; `promoted` speichert diesen Zeitpunkt, `promoted=-1`-Filter liefert beides | Ich | Beim Vorbild nicht observierbar; zentrale Feed-Regel muss definiert sein |
| D14 | **Weiteres RE des Bundles/HARs erlaubt** (Dokumentation von Verhalten, kein Code-Kopieren); exakte `u:`/Datum/Auflösung-Query-Präfixe werden bei Implementierung aus dem Bundle extrahiert und in `docs/api-spec.md` festgehalten | Ich (Clean-Room-Auslegung) | Eliminiert Contract-Raten |

## 6. Was der Builder selbst entschließen darf

- Exakte DB-Indizierung, Query-Pläne, Caching-Strategien (Response-Cache für `items/get`)
- UI-Design im Detail (Dark-Theme default, Layout-System, Icons) — Feature-paritätisch, nicht pixelgleich
- Interne Naming/Code-Struktur; Migration-Tooling (DrizzleKit)
- Test-Strategie (Mindestmaß: API-Contract-Tests gegen die HAR-Schemas)

## 7. Technische Kernkonzepte (aus `findings.md`)

### 7.1 Datenmodell (mindestens)
`users` (id, name, email, pass-hash, mark/rank, benis-abgeleitet, invites), `sessions` (token=id-Quelle, `me`-Cookie, 10 Jahre), `items` (id, user, flags-Bitmaske 1/2/4/8/16, media-ref, w/h, audio, source, promoted-ts, repost-bool, junk-bool), `votes` (user, target item/comment, up/down — toggle-bar), `comments` (id, item, parent, content, up/down, editedAt, editCount, deleted), `tags` (id, name-unique-lowercase), `item_tags` (item, tag, up/down-votes pro Tag) → Confidence-Score, `collections` (+follow, curator-Rolle), `follows` (user-user, user-collection), `messages` (from, to, conversation), `notifications` (mention, comment-answer, follows), `bookmarks`, `blocks` (user, tag), `invites`, `reports` (+reason-Kategorien), `bans`, `sync_log` (pro User, append-only Event-Log für Votes/Read-States), `user_settings` (JSON wie beobachtetes Settings-Modell), `rate_limits` (Upload-Kontingent).

### 7.2 API-Vertrag
- Quelle: `findings.md` §3–§6 + `schemas/*.json` (14 live-erfasste Response-Bodies).
- Dot-Notation → `/api/<a>/<b>`; GETs query-param-basiert; POSTs form-encoded, `_nonce` = Session-Token-Präfix (16 Zeichen) bei logged-in POSTs.
- Response-Umschlag überall: `{…payload, ts, rt, qc, cache, error?}`.
- `items/get`: `flags`, `promoted`, `show_junk`, `tags`, `older` (Cursor), `user`; Liefert `items[]` mit allen Feldern aus §3 der Findings.
- `items/info`: `tags[]`, `comments[]` (threaded via `parent`), `views`.
- `user/sync`: `{inbox{…}, log(base64), logLength, hasMore, nextOffset, score, settings}` — Poll 60 s; `sync_log` append-only, Offset-Cursor.
- Sortierung: Confidence = Wilson-Score aus up/down (Tags, Kommentare „Beste"-Sortierung).
- **Upload (zwei Phasen, aus Bundle dekodiert):**
  1. `POST items/upload` (FormData, Feld `image`, nur die Datei) → Response `{key}`
  2. `POST items.post` mit `key` **oder** `imageUrl` (Direkt-URL-Alternative), `sfwstatus` ∈ {sfw, nsfw, nsfl, nsfp, pol}, `tags` (max. 16), `source`, `targetCollectionId` (optional); `_nonce` dazu. Fehlerfall `error: "similar"` → Repost-Warnung mit Similar-View.
- **Login/Session:** `user.login` antwortet `{success, …}`; der `me`-Cookie ist eine Key-Value-Map (id, name, score, mark, paid, verified, flags, Theme etc.). NSFW/NSFL-Inhalte setzen server-seitig `verified` (Altersverifizierung) voraus.
- **Tag-Query-Sprache** (aus Bundle dekodiert): `!`-Prefix = erweiterte Suche aktiv; `-tag` = ausschließen; `-"sound"`, `-"video"`, `-"repost"` = Media-Typ-Exklusion; `s:<n>` = Score-Filter (Client-Slider mappt Range→Score: (r/100)²·9000, gerundet auf 100); `-m:ftb` = Rang-Filter (unter eigenem Rang); weitere Präfixe (`u:<name>`, Datumsbereich, Auflösung) bei Implementierung aus dem Bundle extrahieren (D14).
- **Dokumentierte Abweichungen:** erlaubt, müssen in `docs/api-spec.md` markiert sein (z. B. Felder, die wir mit eigener Semantik füllen: `mark`-Wertetabelle, Benis-Formel, Vote-Log-Format — beim Vorbild nicht observierbar).

### 7.3 Media-Pipeline (worker)
Upload → Validierung (MIME, Magic Bytes) → Content-Addressed Storage (`<yyyy>/<mm>/<dd>/<hash>.<ext>`) → Thumbs (Bild: sharp; Video: ffmpeg Frame @ ~1 s) → Dimensions + audio-Flag. Serving über App-Route mit Cache-Headern (oder CDN-Reverse-Proxy konfigurierbar).

### 7.4 Sync & Realtime
`user/sync` Long-Poll-artig: liefert Delta des User-Event-Logs seit `offset` (Votes, Read-States, Inbox-Counter, Settings-Änderungen). Client hält lokalen Vote-Cache (localStorage) und reconciled — Verhalten wie beobachtet. Kein WebSocket in v1 (SSE-Live-Tiles sind Non-Goal).

### 7.5 Moderation
Report-Gründe (kategorial), Mod-Queue (Admin-UI), Item-Delete (soft, `items/delete` mit Grund), User-Ban (temporär/permanent), Comment-Delete, NSFP/Junk-Einordnung. Kein dezentrales Mod-System in v1.

### 7.6 Anti-Spam
Rate-Limits (Upload-Kontingent pro Zeiteinheit, Kommentar-Drossel), Invite-Pflicht für Registrierung optional konfigurierbar, simples Captcha beim Registrieren/Login (Self-Host-freundlich, z. B. ALTCHA-Ansatz).

## 8. Risiken & offene Punkte

1. **Vote-Log-Format:** Das Binär-/Base64-Log des Vorbilds ist nicht voll entschlüsselt → eigenes Format (JSON-Zeilen im Log-Feld), API-Shape bleibt kompatibel (`log` als String, `logLength` als Offset).
2. **`mark`-Rang-Tabelle & Benis-Formel:** eigene Definition nötig (Doku ins Repo).
3. **Kommentar-/Tag-Vote-Semantik im Detail** (Wer darf Tags voten, Self-Vote-Sperren): aus HAR nicht vollständig ableitbar → pragmatische Regeln definieren und dokumentieren.
4. **Rechtliches beim Release:** README muss klarstellen: keine Verbindung zu pr0gramm, clean-room, AGPL; API-Kompatibilität als Interop-Zweck.
5. **Media-URLs (gelöst, D10/D14):** Server liefert relative Pfade wie beobachtet; Clients bauen URLs aus ihrer Base-Config (Default: same-origin `/media/…`-Route). Subdomain-Modus (`img./thumb./video./fullsize.`) optional via Env/Reverse-Proxy — Kompatibilität hängt nicht daran.

## 9. Meilensteine (grob, für die Planung)

1. **M1 Fundament:** Monorepo, DB-Schema, Auth (Session/Nonce), API-Umschlag, `user/login|logout|validate`, Admin-Seed
2. **M2 Kern-Loop:** Upload+Worker, `items/get|info|vote`, Feeds + Pagination, Comments (+votes, replies, edit-history), Tags (+votes, confidence)
3. **M3 Social:** Profile, Follow/Subscribe, Inbox, Notifications, Collections, Bookmarks, Blocks
4. **M4 Sync & Client:** `user/sync` mit Log, Settings, vollständiger Web-Client (Feed/Item/Inbox/Profil/Upload/Mod-UI)
5. **M5 Betrieb:** Docker-Compose, Rate-Limits, Reports/Mod-Tools, Admin-UI, Doku (Self-Hosting-Guide, API-Spec, CONTRIBUTING)
