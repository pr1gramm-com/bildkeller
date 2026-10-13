# Bildkeller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-hostbares, API-zu-pr0gramm-kompatibles Open-Source-Imageboard (Kern-Loop + Social + Moderation) mit eigenem Web-Client.

**Architecture:** Eine Next.js-App (App Router) als Monolith: ein Catch-All-Route-Handler `/api/[...path]` dispatcht Dot-Notation-Endpunkte (`items.get` → `items/get`) auf eine Handler-Tabelle; Media wird content-addressed auf die Platte gelegt und über `/media/[...path]` geservt. `packages/db` hält das Drizzle-Schema. **Abweichung vom Design D9 (dokumentiert):** Media-Processing läuft inline im Upload-Handler (sharp/ffmpeg sind schnell genug; kein separater Worker-Prozess in v1 — Extraktion später bei Bedarf).

**Tech Stack:** Node 24, pnpm 12, Next.js 16.4, TypeScript strict, drizzle-orm 0.45 + Postgres (lokal :5432 läuft), sharp 0.35, ffmpeg 9 (System), vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-bildkeller-design.md` + `~/pr0gramm-re/findings.md` + `~/pr0gramm-re/schemas/*.json` (Contract-Quelle).

## Global Constraints

- TypeScript strict, kein `any` (Ausnahme dokumentiert inline).
- Response-Umschlag jedes API-Endpunkts: `{...payload, ts: unix, rt: int, qc: int, cache: null}`; Fehler: `{error: "message", ts, rt, qc}` mit HTTP 200 (wie Vorbild) außer Upload (200/4xx).
- POST mit eingeloggtem User: `_nonce` Pflichtfeld = sessionToken.substr(0,16), sonst Error `{error: "csrf"}`.
- Flags-Bitmaske: SFW=1, NSFW=2, NSFL=4, NSFP=8, POL=16. Gäste (kein Login): `flags=1` erzwingen.
- Kein pr0gramm-Branding/Assets/Code; UI-Texte eigenständig. Lizenz AGPL-3.0.
- pnpm als Package Manager. Commits: conventional (`feat(db): …`).
- Die HAR-Datei mit Session-Cookies (`~/pr0gramm-re/pr0gramm.har`) bleibt **nie** im Repo.

## Review Focus

1. **Gast greift auf NSFW/NSFL-Item zu** → Server filtert Flags auf 1 (SFW), liefert leere Liste; 404-artiges Error-Envelope bei Direktaufruf von items.info. Test: Task 6.
2. **CSRF-fremder POST** (fehlt/fehlerhaftes `_nonce`) → `{error:"csrf"}`, keine Zustandsänderung. Test: Task 4.
3. **Upload mit gefälschtem MIME** (exe als .png) → Magic-Byte-Check lehnt ab, Error-Envelope. Test: Task 8.
4. **Sync-Offset-Rücksetzung** (alter/gültiger Offset) → `hasMore=false`, `nextOffset` = aktueller Log-Ende, kein Crash, keine Duplikate. Test: Task 11.
5. **Repost** (identischer Datei-Inhalt nochmal hochgeladen) → items/upload-Antwort enthält `repost:true` + Item-Referenz; items.post schlägt mit `error:"similar"` fehl. Test: Task 8.

---

### Task 1: Monorepo-Skelett

**Files:**
- Create: `package.json` (root, private, workspaces), `pnpm-workspace.yaml`, `.gitignore`, `LICENSE` (AGPL-3.0), `.env.example`
- Create: `packages/db/package.json`, `packages/db/src/index.ts`, `packages/db/src/schema.ts`, `packages/db/drizzle.config.ts`
- Create: `app/package.json`, `app/next.config.ts`, `app/tsconfig.json`, `app/src/app/layout.tsx`, `app/src/app/page.tsx`

**Interfaces:**
- Produces: `packages/db` exportiert `db` (Drizzle-Instanz, aus `DATABASE_URL`) und `schema` (alle Tabellen). App importiert `{ db, schema } from "bildkeller/db"` (workspace alias `bildkeller/db: workspace:*`).
- `.env`: `DATABASE_URL=postgres://localhost:5432/bildkeller`, `SESSION_SECRET=<64 hex>`, `MEDIA_DIR=./data/media`.

- [ ] **Step 1:** Skelett anlegen; `pnpm install` läuft durch; `pnpm -r type-check` (root script) besteht mit leerem Schema.
- [ ] **Step 2:** `git init`, erster Commit `chore: monorepo skeleton`.

### Task 2: DB-Schema (vollständig, einmalig)

**Files:**
- Create/Modify: `packages/db/src/schema.ts`

**Interfaces:**
- Produces (Tabellen, alle mit drizzle pgTable; Unix-Zeiten als `integer`):
  `users(id serial, name text unique-lower-idx, email text, passwordHash text, mark int default 2, verified bool default false, admin bool, mod bool, inviteId int, bannedUntil int, deleted bool, created int)`
  `sessions(token varchar(32) pk, userId int, created int)`
  `items(id bigserial pk, userId, flags int, image text, thumb text, fullsize text, preview text, width int, height int, originalWidth int, originalHeight int, audio bool, source text default '', created int, promoted int default 0, junk bool default false, repost bool default false, deleted bool default false, key text unique, dhash text, up int default 0, down int default 0)`
  `comments(id bigserial pk, itemId bigint, parentId bigint default 0, userId int, content text, created int, editedAt int, editCount int default 0, up int default 0, down int default 0, deleted bool)`
  `votes(id bigserial, userId int, itemId bigint null, commentId bigint null, up bool, created int, unique(userId,itemId), unique(userId,commentId))`
  `tags(id serial pk, tag text unique)`
  `itemTags(itemId, tagId, up int default 0, down int default 0, unique(itemId,tagId))`
  `itemTagVotes(userId, itemId, tagId, up bool, unique(userId,itemId,tagId))`
  `collections(id serial, userId, name text, description text, isDefault bool, public bool default true, created int)`
  `collectionItems(collectionId, itemId, added int, unique(collectionId,itemId))`
  `collectionCurators(collectionId, userId, unique(collectionId,userId))`
  `follows(followerId, followeeId, unique)`
  `subscriptions(userId, collectionId, unique)`
  `messages(id bigserial, fromId, toId, content text, created int, read bool default false)`
  `notifications(id bigserial, userId, type text('mention'|'comment'|'follow'), refId bigint, created int, read bool default false)`
  `bookmarks(userId, itemId, created int, unique(userId,itemId))`
  `blocks(userId, blockedUserId, unique)`, `blockedTags(userId, tagId, unique)`
  `invites(id serial, code varchar(16) unique, createdBy int, usedBy int null, created int)`
  `reports(id serial, userId, itemId bigint null, commentId bigint null, reason text, message text, status text default 'open', created int)`
  `bans(id serial, userId, reason text, until int null, createdBy int, created int)`
  `syncLog(id bigserial pk, userId int, type text, payload jsonb, created int)`
  `userSettings(userId pk, settings jsonb)`
  `siteConfig(key text pk, value jsonb)` (z. B. `promotion.threshold: 3`, `upload.ratelimit.hours: 24`, `upload.ratelimit.count: 60`)

- [ ] **Step 1:** Schema schreiben; `pnpm drizzle-kit push` (dev-DB `bildkeller`) läuft fehlerfrei.
- [ ] **Step 2:** smoke: `select count(*) from users` via psql. Commit `feat(db): full schema`.

### Task 3: API-Dispatcher + Envelope

**Files:**
- Create: `app/src/app/api/[...path]/route.ts`, `app/src/lib/api/router.ts`, `app/src/lib/api/envelope.ts`, `app/src/lib/env.ts`
- Test: `app/test/dispatcher.test.ts` (vitest)

**Interfaces:**
- Produces: `handle(request: NextRequest, path: string[]): Promise<Response>`; Handler-Registrierung `register("items.get", async (ctx: ApiCtx) => Payload)` mit `ApiCtx = { user: SessionUser|null, query: URLSearchParams, form: Record<string,string>, req: NextRequest }`; `SessionUser = { id: string (token), userId: number, name: string, mark: number, verified: boolean, admin: boolean, mod: boolean, paid: false, flags: number }`.
- Produces: `ok(payload)`, `fail(error: string)` → Envelope-Umschlag (Constraints). `GET` → `ctx.query`, `POST` → `ctx.form` (form-urlencoded, FormData→Records).
- Unregistrierter Endpunkt → `fail("unknown endpoint")` (D11-Verhalten auch für Non-Goals).

- [ ] **Step 1 (Test):** `GET /api/user/sync` ohne Handler → Envelope mit `error:"unknown endpoint"`; Felder `ts,rt,qc` numerisch vorhanden.
- [ ] **Step 2:** Test rot. **Step 3:** Dispatcher + Envelope implementieren. **Step 4:** Test grün. **Step 5:** Commit `feat(api): dispatcher + envelope`.

### Task 4: Auth (Session, `me`-Cookie, Nonce)

**Files:**
- Create: `app/src/lib/auth.ts`
- Create: `app/src/lib/api/endpoints/user.ts` (nur: `user.login`, `user.logout`, `user.validate`, `user.info`, `user.sitesettings`)
- Test: `app/test/auth.test.ts`

**Interfaces:**
- Produces: `createSession(userId): Promise<string token>`; `getSessionUser(req): Promise<SessionUser|null>` (liest `me`-Cookie-Map, validiert Token gegen `sessions`); `setMeCookie(res, user)` (Cookie-Map: `id`=token, `n`=name, `s`=score, `m`=mark, `v`=verified, `f`=flags, 10 Jahre, httpOnly=false — der Client liest sie bewusst wie das Vorbild); `assertNonce(ctx, user)` → wirft `fail("csrf")`.
- Produces: `hashPassword(pw)`/`verifyPassword` (argon2id via `@node-rs/argon2`).
- Endpunkte: `user.login {name, password}` → `{success:true}` + Set-Cookie; falsch → `{success:false, error:"..."}`. `user.logout` löscht Session. `user.validate` → Nutzer-Objekt oder `{error:"not logged in"}`.
- **Banned-User:** Session-Resolve prüft `bans` (until>now) → verhält sich wie ausgeloggt + `error:"banned"` bei POST.

- [ ] **Step 1 (Test):** Login mit seed-User → `success:true`, Cookie `me` enthält `id` (32 hex) und `n`; `user.validate` mit Cookie → Name; POST `items.vote` ohne `_nonce` → `error:"csrf"`; mit `_nonce` = token.substr(0,16) und unbekanntem Endpunkt → `error:"unknown endpoint"` (nicht csrf).
- [ ] **Step 2:** rot. **Step 3:** implementieren. **Step 4:** grün. **Step 5:** Commit `feat(auth): sessions, me-cookie, nonce`.

### Task 5: Kern-Helfer (Wilson, Flags, Promotion, RateLimit)

**Files:**
- Create: `app/src/lib/wilson.ts`, `app/src/lib/flags.ts`, `app/src/lib/promote.ts`, `app/src/lib/ratelimit.ts`, `app/src/lib/config.ts` (liest `siteConfig` mit Defaults)
- Test: `app/test/core.test.ts`

**Interfaces:**
- `wilson(up: number, down: number): number` — Standard-Wilson-Score-Untergrenze (95 %), 0.0–1.0. Erwartung: `wilson(5,0) > wilson(6,1) > wilson(1,0) > wilson(10,8)`.
- `effectiveFlags(user: SessionUser|null, requested: number): number` — Gast → `1`; User → `requested & userFlags` wobei userFlags aus User-Verifizierung kommt (nicht verified → `1|8`; verified → alle).
- `maybePromote(itemId): Promise<void>` — liest `siteConfig.promotion.threshold` (Default 3); wenn `promoted==0` und `up-down>=threshold` → `promoted=now`.
- `uploadQuota(userId): Promise<number left>` — `count(items where userId & created > now-h)` vs. `siteConfig.upload.ratelimit.count`.

- [ ] **Step 1 (Test):** Wilson-Ordnung wie oben; Gast-flags=1; verified-User flags=31; maybePromote setzt promoted bei 4 up; Quota: 61 Uploads in 24h → left 0.
- [ ] **Step 2–4:** rot→implementieren→grün. **Step 5:** Commit `feat(core): wilson, flags, promotion, ratelimit`.

### Task 6: Feed — `items.get`

**Files:**
- Create: `app/src/lib/api/endpoints/items.ts` (nur `items.get`), `app/src/lib/itemshape.ts` (DB-Row → API-Item-Shape exakt wie `schemas/items_get.json`)
- Test: `app/test/items-get.test.ts` (DB-Integrationstest gegen dev-DB)

**Interfaces:**
- Produces: `itemsGet(ctx): Promise<{items: ApiItem[], atStart: boolean, atEnd: boolean}>`; Query-Params: `flags`, `promoted` (0=neu, 1=beliebt, -1=alles), `show_junk`, `older` (Cursor: items mit `id < older`), `tags` (Task 9), `user`. Order: promoted=0 → `id desc`; promoted=1 → `promoted desc, id desc`. `atStart = kein older`-Param, `atEnd` = weniger als Limit (50).
- `ApiItem`-Felder exakt: `id, promoted, userId, up, down, created, image, thumb, fullsize, preview, width, height, originalWidth, originalHeight, audio, source, flags, user(name), mark, repost, variants:[]`.
- Nutzer-Sicht: Items der Blöcke/blockedTags ausfiltern; gelöschte nie.

- [ ] **Step 1 (Test):** Seed (10 Items, gemischte Flags, 1 gelöscht, 1 repost): Gast `flags=1` sieht nur SFW; `promoted=1` nur promoted sortiert; `older=<id5>` → nur id<5; `show_junk=0` filtert junk; Response-Keys == HAR-Schema-Keys.
- [ ] **Step 2–4:** rot→grün. **Step 5:** Commit `feat(items): feed with flags, promoted, cursor`.

### Task 7: Item-Detail + Voting — `items.info`, `items.vote`

**Files:**
- Modify: `app/src/lib/api/endpoints/items.ts` (+ `items.info`, `items.vote`, `items.delete`, `items.selfDelete`, `items.ratelimited`)
- Test: `app/test/items-info.test.ts`

**Interfaces:**
- `itemsInfo(ctx)` → `{tags:[{id,tag,confidence}], comments:[Comment], views}` — Comment-Shape exakt wie `schemas/items_info.json` (`id, parent, content, created, editedAt, editCount, up, down, confidence, name, mark, blocked`). `views` = counter (siteConfig-los, items-Tabelle erweitert um `views int` in Task 2? — nein: eigene `itemViews(itemId, day)`-Tabelle, Aggregation on read).
- `items.vote {id, up}` (Toggle: nochmal gleiche Richtung = zurücknehmen; Gegenrichtung = wechseln) → updated `items.up/down` denormalisiert + `syncLog`-Eintrag + `maybePromote`.
- Kommentar-Vote analog über `comments.vote`.

- [ ] **Step 1 (Test):** info liefert tags+comments mit Exact-Keys; vote up→down→up erzeugt genau 1 vote-Row mit Endzustand up und korrekten Zählern; promote feuert bei Schwelle; Gast bei NSFW-Item → `error:"not found"`.
- [ ] **Step 2–4:** rot→grün. **Step 5:** Commit `feat(items): info, votes, promote`.

### Task 8: Upload-Pipeline (zwei Phasen)

**Files:**
- Create: `app/src/app/api/upload/route.ts` (direkter `POST /api/items/upload`, FormData — **vor** dem Dispatcher gemountet), `app/src/lib/media.ts`
- Modify: `endpoints/items.ts` (+ `items.post`, `items.upload`-Alias)
- Test: `app/test/upload.test.ts`

**Interfaces:**
- `storeUpload(file: File): Promise<{key, rel, width, height, originalWidth, originalHeight, audio, dhash, repostOf: number|null}>` — Magic-Bytes prüfen (PNG/JPEG/GIF/WEBM/MP4/MOV), `sha256`→`data/media/<y>/<m>/<d>/<hash>.<ext>`, sharp→thumb.jpg (200px) + dims, ffmpeg→video-frame + audio-Flag; dHash (8×8) für Repost-Erkennung (identischer sha256 → repostOf).
- `POST items/upload` (nur Datei-Feld `image`) → `{key}`; Quota überschritten → `{error:"ratelimited", left:0}`; MIME gefälscht → `{error:"invalid"}`.
- `items.post {key|imageUrl, sfwstatus, tags, source?, targetCollectionId?}` → Item anlegen, `promoted=0`, Tags anlegen/verknüpfen (max 16, sonst `error:"taglimit"`), Repost-Key schon vorhanden → `error:"similar"`; Antwort: `{itemId, promoted:0, ...}`.
- NSFW/NSFL ohne `verified` → `error:"verification required"`.

- [ ] **Step 1 (Test):** PNG-Fixture hochladen → `{key}`; items.post mit key+tags → Item existiert mit thumb-Pfad; gleiche Datei erneut → repost-Marker + items.post → `error:"similar"`; exe-Bytes als .png → `error:"invalid"`; 5. Upload im Test-Window mit count=4 → `ratelimited`.
- [ ] **Step 2–4:** rot→grün. **Step 5:** Commit `feat(upload): two-phase pipeline with repost detection`.

### Task 9: Tags — CRUD + Vote + Query-Sprache

**Files:**
- Modify: `endpoints/items.ts` (Query-Sprache in `itemsGet`), Create: `endpoints/tags.ts` (`tags.add`, `tags.vote`, `tags.delete`, `tags.top`, `tags.details`)
- Create: `app/src/lib/tagquery.ts`
- Test: `app/test/tagquery.test.ts`, `app/test/tags.test.ts`

**Interfaces:**
- `parseTagQuery(q: string): {include: string[], exclude: string[], score?: number, marks?: string[], mediaExclude: ('sound'|'video'|'repost')[]}` — Grammar (aus findings §7.2): `!`-Prefix, `-tag`, `-"video"`, `s:<n>`, `-m:ftb`; Whitespace-getrennt; `!` ohne Extras = nur include. Beispiel: `"! katzen -\"video\" s:100"` → include:[katzen], mediaExclude:[video], score:100.
- `tags.vote {itemId, tag, up}` → `itemTagVotes` + `itemTags.up/down` (Toggle); `confidence = wilson(up,down)` im Shape.
- `tags.top` → Top-Tags (Aggregat über itemTags) `{tags:[{tag, count}]}` (Shape aus `schemas/tags_top.json`).
- `itemsGet`-Integration: include-Liste → Alle Tags müssen matchen (UND); exclude → NICHT matchen; score → `up-down >= s`; mediaExclude video → `audio=false AND ext nicht webm/mp4/mov`; repost → `repost=false`.

- [ ] **Step 1 (Tests):** Parser-Tabelle: 6 Input/Output-Paare aus der Grammar; Feed-Test: 3 Items mit Tags, Query `a -b s:1` → genau das korrekte Item.
- [ ] **Step 2–4:** rot→grün. **Step 5:** Commit `feat(tags): votes, wilson confidence, query language`.

### Task 10: Kommentare — post, reply, edit-history

**Files:**
- Modify: Create: `endpoints/comments.ts` (`comments.post`, `comments.vote`, `comments.fav`, `comments.unfav`, `comments.getEditHistory`)
- Modify: Schema (Task 2 um `commentEdits(commentId, content, edited int)` und `commentFavorites(userId, commentId)` ergänzen — in Task 2 mit anlegen)
- Test: `app/test/comments.test.ts`

**Interfaces:**
- `comments.post {itemId, parent?, content}` → Comment-Shape wie Task 7; Mention-Erkennung `@name` → notification; parent-Kommentar-Autor → notification type=comment.
- `comments.fav/unfav` → bookmark-artig auf Kommentar (`commentFavorites`), `profile.commentlikes` zählt sie (Task 12).
- Edit: `content, editedAt=now, editCount+=1`, alte Version in `commentEdits`; `getEditHistory` → Liste rückwärts.

- [ ] **Step 1 (Test):** post→reply→mention löst 1 notification vom richtigen Typ aus; edit×2 → history enthält 2 Einträge; vote-Toggle zählt.
- [ ] **Step 2–4:** rot→grün. **Step 5:** Commit `feat(comments): post, reply, edits, favs`.

### Task 11: Sync — `user/sync` + Settings

**Files:**
- Create: `app/src/lib/sync.ts`, `endpoints/user.ts` erweitern (`user.sync`)
- Test: `app/test/sync.test.ts`

**Interfaces:**
- `logEvent(userId, type, payload)` → insert `syncLog`.
- `user.sync {offset?, chunked?, limit?}` → `{inbox:{comments,mentions,messages,notifications,follows,digests:0}, log: base64(JSON-Array der Events mit id>offset), logLength: maxId, hasMore, nextOffset, score, settings}` — Shape exakt wie `schemas/user_sync.json`; `score` = Benis (Task 12-Formel: `sum(up-down)` über eigene Items + Comments, Items×2 gewichtet — dokumentierte eigene Semantik).
- `user.sitesettings {key,value?}` GET/POST auf `userSettings` (JSONB, Defaults = Schema aus HAR).

- [ ] **Step 1 (Test):** 3 Events loggen → sync ab offset=0 liefert 3, nextOffset=maxId; nochmal gleicher offset → leer, hasMore=false; unbekannter riesiger offset → leer, kein Crash (Review-Focus 4); Inbox-Counter zählen ungelesene notifications/messages.
- [ ] **Step 2–4:** rot→grün. **Step 5:** Commit `feat(sync): event log + settings`.

### Task 12: Social — Profile, Follow, Inbox, Collections, Bookmarks, Blocks

**Files:**
- Create: `endpoints/profile.ts` (`profile.info/comments/commentlikes/follow/unfollow/subscribe/unsubscribe/block/unblock/blockTag/unblockTag`), `endpoints/inbox.ts` (`inbox.conversations/messages/post/deleteConversation/digests`), `endpoints/collections.ts` (create/edit/delete/add/remove/follow/unfollow/default/get + Kurator-Endpunkte), `endpoints/bookmarks.ts`
- Test: `app/test/social.test.ts`

**Interfaces:**
- `profile.info {name, flags?}` → Shape wie `schemas/profile_info.json` (`user{name,mark,registered,score,...}, uploads[], comments[], collections[], uploadCount, commentCount, commentLikesCount, followCount, following, subscribed, blocked, likesArePublic...`).
- Benis-Formel (dokumentiert): `2*Σ(up-down über Items) + Σ(up-down über Comments)`.
- `inbox.conversations` → Gegenüber-Liste mit letzter Nachricht + unread-Count (Shape wie HAR); `inbox.messages {with:<name>}` → thread, markiert gelesen.
- `collections.get` → `{collections:[], curatorCollections:[]}` (HAR-Shape); follow → subscription; `default`-Collection "Favoriten" auto-provisioniert.

- [ ] **Step 1 (Test):** A folgt B → B.profile `following:true` für A; B postet an A → conversation auftaucht, unread=1, nach `inbox.messages` → 0; Collection anlegen+Item+follow → `collections.get` spiegelt; block → Profil/Kommentare des Blocks gefiltert (Feed-Integration aus Task 6 nutzt gleiche Helper).
- [ ] **Step 2–4:** rot→grün. **Step 5:** Commit `feat(social): profiles, inbox, collections, bookmarks, blocks`.

### Task 13: Web-Client — Shell, Feed, Item-View

**Files:**
- Create: `app/src/app/(client)/...` — `layout.tsx` (Dark-Shell: Header mit Tabs neu/beliebt/müll, Suche, Upload-Button, Inbox/Profil-Icons), `page.tsx` (Feed), `item/[id]/page.tsx`, `components/FeedGrid.tsx`, `components/ItemView.tsx`, `components/VoteBox.tsx`, `components/TagBar.tsx`, `components/CommentThread.tsx`, `components/ImageOrVideo.tsx`
- Test: manuell (Browser, Task 17) — hier nur `pnpm build` grün.

**Interfaces:**
- Client konsumiert ausschließlich die eigene `/api/*`-Schicht (dogfood der Parität). Feed: infinite scroll via `older`-Cursor; Hotkeys: `←/→` Item-Navigation, `k` Suche-Fokus, `c` Kommentar-Fokus.
- Eigenes Branding: Logo Text „Bildkeller", eigene Inline-Icons (kein Fontawesome).

- [ ] **Step 1:** Implementieren. **Step 2:** `pnpm build` besteht; `/` rendert Feed mit Seed-Items (server-side fetch). **Step 3:** Commit `feat(web): shell, feed, item view`.

### Task 14: Web-Client — Upload, Auth-Seiten, Profil/Inbox/Search

**Files:**
- Create: `upload/page.tsx` (Drop-Area → zwei-Phasen-Upload, sfwstatus-Radio, Tags-Input max 16), `login/page.tsx`, `register/page.tsx` (Invite-Code), `profile/[name]/page.tsx`, `inbox/page.tsx`, `search/page.tsx` (erweiterte Suche mit Include/Exclude/Score → tagquery), `settings/page.tsx`, `bookmarks/` + `collections/` Views
- Test: `pnpm build` grün; E2E in Task 17.

- [ ] **Step 1:** Implementieren. **Step 2:** Build. **Step 3:** Commit `feat(web): upload, auth, profile, inbox, search, settings`.

### Task 15: Moderation + Admin + Registrierung/Invites/GDPR-Basis

**Files:**
- Modify: `endpoints/misc.ts` (`contact.report`, `faq.*` (statische Inhalte aus DB), `stats.user`, `user.requestAccountDeletion/confirmAccountDeletion/cancelAccountDeletion` (soft-delete + Anzeige), `user.invite/joinwithinvite`)
- Create: `app/src/app/(client)/admin/page.tsx` (Report-Queue, Delete, Ban — nur admin/mod), `endpoints/admin.ts` (interne Suffixe `admin.*`)
- Test: `app/test/mod.test.ts`

**Interfaces:**
- Report → reports-Row; Mod-Actions: Item soft-delete + Grund, Ban (until nullable) → Session-Check aus Task 4 greift.
- Registrierung: nur mit gültigem Invite-Code (siteConfig `invites.required: true`), Alterscheck-Checkbox → `verified`.

- [ ] **Step 1 (Test):** User reportet Item → mod sieht Report; Mod löscht Item → verschwindet aus Feed (Task 6-Filter); Ban → Login/POST blockiert; Register mit Invite → User+verified; GDPR-Request → Status-Endpunkt meldet pending.
- [ ] **Step 2–4:** rot→grün. **Step 5:** Commit `feat(mod): reports, bans, admin ui, invites, gdpr status`.

### Task 16: Betrieb — Docker, Rate-Limits hart, Seed, Doku

**Files:**
- Create: `Dockerfile` (node:24-alpine, pnpm build, ffmpeg+sharp runtime), `docker-compose.yml` (postgres:17 + app, Volumes für DB + `data/media`), `README.md` (Clean-Room-Hinweis, AGPL, Setup, D13/D-Abweichungen), `docs/self-hosting.md`, `docs/api-spec.md` (generiert aus Endpoint-Tabelle + findings-Contract, Abweichungen markiert), `scripts/seed.ts` (Testdaten: 3 User, 20 Items, Kommentare, Tags)
- Test: Compose-Boot + Smoke.

- [ ] **Step 1:** Dateien. **Step 2:** `docker compose up` → `/api/items/get` liefert Envelope; Smoke-Script (curl-Liste) grün. **Step 3:** Commit `feat(ops): docker, seed, docs`.

### Task 17: Verifikation (GATE vor Release)

- [ ] **Step 1:** `pnpm -r type-check && pnpm -r test` — 0 Fehler, alle Tests grün.
- [ ] **Step 2:** Dev-Server + `agent-browser` (Session `bildkeller`): Register→Upload→Feed sichtbar→Vote→Tag→Kommentar→Profil→Inbox→Search→Mod-Delete; Screenshots; `agent-browser errors` leer.
- [ ] **Step 3:** Contract-Abgleich: Response-Keys von `items/get`, `items/info`, `user/sync`, `profile/info` gegen `~/pr0gramm-re/schemas/*.json` (Script `scripts/contract-check.ts`).
- [ ] **Step 4:** Fixes, Commits.

### Task 18: Release (nur nach User-Go)

- [ ] **Step 1:** `gh repo create pr1gramm-com/bildkeller --public` (oder SSH-Remote falls gh nicht authed), Push `main`, Topics (`imageboard`, `self-hosted`, `nextjs`), Description mit Clean-Room-/AGPL-Hinweis.
- [ ] **Step 2:** Prüfen: keine Secrets/cookies im Tree (`git log -p | grep -i` auf cookie-Strings, HAR-Pfade), LICENSE sichtbar.

## Self-Review

- **Spec-Coverage:** Design §2 (Ziele 1–5) → Tasks 3–13, 15; §7 Konzepte → 5, 6, 7, 8, 9, 11; Non-Goals → D11-Fallback in Task 3; Betrieb §5 → 16; Release → 18. Lücke: `items.preview`/`comments.preview`/`profile.preview` (Hover-Preview-Endpunkte) — bewusst zurückgestellt, dokumentiert in api-spec als Abweichung (Fehler-Envelope). Kein weiterer Gap.
- **Step scan:** Jeder Task = Test(rot)→Impl(Interface)→grün→Commit; Interfaces tragen die Entscheidungen (Shapes aus HAR-Dateien referenziert, nicht abgeschrieben).
- **Type consistency:** `SessionUser`, `ApiItem`, `handle/register/ok/fail`, `storeUpload`, `parseTagQuery`, `wilson`, `maybePromote`, `logEvent` konsistent über Tasks referenziert.
- **Review Focus:** 1→Task 6/7, 2→Task 4, 3+5→Task 8, 4→Task 11 — jeweils in Test-Steps verankert.
- **Proportion:** Plan entspricht Spec-Größe (1 Design-Doc ↔ 18 Tasks), keine Code-Transkripte.
