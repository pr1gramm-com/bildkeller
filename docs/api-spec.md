# API specification

Base path `/api/`. A client-side name like `items.get` is served at `GET /api/items/get`.
Read endpoints use `GET` with query parameters; write endpoints use `POST` with a form-encoded (or multipart) body.

## Conventions
- **Envelope:** every response is HTTP 200 JSON with `ts`, `rt`, `qc`, `cache` (always `null`) and `error`
  (`null` on success, a message string on failure) next to the payload. Unknown or unimplemented endpoints
  answer `{"error": "unknown endpoint"}` (not 404) so clients degrade cleanly.
  Exception: none — even upload errors use the envelope.
- **Auth:** `user.login` / `user.joinwithinvite` set a long-lived `me` cookie. It is a base64url JSON map
  (`id` = session token, `n` name, `m` mark, `v` verified, `a` mod/admin). Guests are limited to SFW content.
- **CSRF:** every POST of a logged-in user must send `_nonce` = first 16 characters of the session token (`me.id`).
  A missing/wrong nonce answers `{"error": "csrf"}`. GET requests do not need a nonce.
- **Flags** (bitmask): sfw 1, nsfw 2, nsfl 4, nsfp 8, pol 16. Requested flags are intersected with what the account
  may see (guests: 1, unverified: 1|8, verified: all).
- **Pagination:** `items.get` returns up to 50 items, newest first; continue with `older=<last id>`.
  `id=<n>` starts the list at item `n` (direct links). `atStart` / `atEnd` report the edges.

## Upload (two phases)
1. `POST /api/items/upload` — multipart field `image` → `{key}`. Magic bytes are validated; errors: `invalid`, `ratelimited`.
   Alternatively send a `url` field instead of a file: the server downloads it (http/https only, no redirects to
   private networks, size limited like a file upload); error: `invalid url`.
2. `POST items.post` — `key`, `sfwstatus` (sfw|nsfw|nsfl|nsfp|pol), `tags` (comma separated, max 16), optional `source`,
   optional `comment` (becomes the first comment of the post), optional `targetCollectionId` → `{itemId}`.
   Errors: `similar` (exact duplicate), `taglimit`, `verification required`, `invalid key`.

## Feed query language (`items.get?tags=`)
Terms are separated by spaces and ANDed; groups separated by `|` are ORed. A leading `!` marks the advanced form.

| Token | Meaning |
|---|---|
| `tag` | post carries this tag |
| `~tag` | post carries a tag containing `tag` |
| `-tag` | post does **not** carry this tag |
| `-"video"` / `-"sound"` / `-"repost"` | post is not a video / has no audio / is not a repost |
| `u:name` | post was uploaded by `name` (comma separated for several users) |
| `-u:name` | post was **not** uploaded by `name` |
| `s:n` | net score (`up − down`) is at least `n` |
| `-s:n` | net score is below `n` |
| `m:n` | the uploader's rank is at least `n` |
| `-m:n` | the uploader's rank is not `n` |
| `r:WxH` | the post is at least `W×H` pixels |
| `-r:WxH` | the post is smaller than `W×H` |
| `d:YYYY-MM-DD` | uploaded on or after that day |
| `d:YYYY-MM-DD..YYYY-MM-DD` | uploaded inside that range |
| `-d:…` | uploaded **outside** that range |

Examples: `! katze -hund`, `katze | hund`, `u:wonka s:100`, `~süßvieh -"video"`, `d:2024-01-01..2024-12-31 r:1920x1080`.

## Endpoints
- **admin**: `ban`, `reports`, `resolveReport`, `unban`
- **bookmarks**: `add`, `delete`, `get`
- **collections**: `add`, `addCurator`, `create`, `delete`, `edit`, `follow`, `get`, `remove`, `removeCurator`, `unfollow`
- **comments**: `edit`, `fav`, `getEditHistory`, `post`, `unfav`, `vote`
- **contact**: `report`
- **inbox**: `all`, `comments`, `conversations`, `digests`, `follows`, `mentions`, `messages`, `notifications`, `post`, `stalk`
- **items**: `calendar`, `delete`, `get`, `info`, `post`, `ratelimited`, `reverse`, `setjunk`, `upload`, `vote`
- **profile**: `block`, `blockTag`, `commentlikes`, `comments`, `follow`, `info`, `subscribe`, `unblock`, `unblockTag`, `unfollow`, `unsubscribe`
- **tags**: `add`, `delete`, `top`, `vote`
- **user**: `ageVerified`, `blockedTags`, `blocklist`, `cancelAccountDeletion`, `changeemail`, `changename`, `changepassword`,
  `collectionfollowlist`, `confirmAccountDeletion`, `dataExport`, `dataExportStatus`, `deletionStatus`, `followlist`, `info`,
  `invite`, `invitelist`, `joinwithinvite`, `loadinvite`, `login`, `logout`, `requestAccountDeletion`, `selfban`,
  `setbackground`, `sitesettings`, `sync`, `validate`

(Generated from the registered handlers; `user.sync` is the event-log endpoint: `offset`, `limit` → `inbox` counters,
`log` (base64 JSON events), `logLength`, `nextOffset`, `hasMore`, `score`, `settings`.)

## New in this revision
- `items.get` understands the full query grammar above (partial tags, user lists, dates, resolution, rank, OR groups).
- `items.calendar?year=&month=` → `{days: [{day, count}]}` for the calendar view.
- `items.reverse` (POST, `url`) → posts with the same file, for the reverse image search.
- `items.setjunk` (POST, `id`, `junk`) → marks a post as junk; `items.get?junk=1` lists the caller's junk posts.
- `inbox.all`, `inbox.stalk` (comments of followed users), `inbox.digests` (top uploads of the last day) are implemented.
- `user.changename`, `user.changeemail`, `user.selfban`, `user.invitelist`, `user.setbackground` implement the account page.
- `user.info` returns `digests`, `enableEmailNotifications`, `inviteEligible`, `authorizedApps` (always empty) and more.

## Deliberate deviations from the reference API
These could not be observed from the outside, or are simplified. Clients should treat them as Bildkeller semantics.
- `error` is always present (reference responses omit it on some endpoints).
- **Promotion**: an item becomes "popular" when `up − down ≥ promotion.threshold` (default 3); `promoted` holds that timestamp.
- **Benis** (`score`): `2 × net votes on own items + net votes on own comments`. `mark` is a plain rank integer (default 2).
- **Sync log** events are JSON (`{id, type: "vote", target: "item"|"comment", id, up}`), base64 encoded; vote semantics are toggles.
- New tags receive the adder's upvote, so they pass the client display threshold (confidence ≥ 0.2).
- `subscribe`/`unsubscribe` are aliases of `follow`/`unfollow`.
- `bookmarks.add/delete` retain item bookmarks (`itemId`). `bookmarks.get` additionally returns `searches`; `bookmarks.saveSearch` and `bookmarks.deleteSearch` manage account-owned named searches (`name`, `tags`, `feed`: `new`/`top`/`junk`). These named-search operations are Bildkeller extensions, not a claim of upstream API compatibility.
- `inbox.messages` shape: `{with, messages: [{id, created, sent, message}]}`; `inbox.deleteConversation` is not implemented.
- Collection curators are added directly (`addCurator`) without an accept step; no `curatorAccept/Allow/Ignore`.
- Tag deletion is moderator/admin only; `tags.details`, `tags.chronicle`, `items.preview`, `comments.preview`,
  `profile.preview`, `faq.*`, `stats.user` are not implemented.
- `items.get` accepts `limit` (1–50). The popular feed (`promoted=1`) pages by `(promoted, id)`; `older` is the last item's id.
- Rate limits answer `{"error": "rate limited"}`; uploads are capped (`MAX_UPLOAD_BYTES`, default 50 MB, answer `too large`).
- Reposts: exact SHA-256 match of the uploaded file (no perceptual hashing yet).
- `items.reverse` matches by the same SHA-256 hash, so it finds identical files, not visually similar ones.

### Profilavatar (eigene Erweiterung)

`POST /api/user/avatar` nimmt Multipart-FormData mit `_nonce` und `image` (PNG/JPG,
64–8192 px, maximal 20 MB) entgegen. `x`/`y` positionieren den quadratischen Ausschnitt
von 0 bis 100 (Standard 50), `zoom` von 1 bis 4 (Standard 1). Die Ausgabe ist 512×512 PNG.
`remove=1` entfernt das eigene Profilbild. Antwort: Envelope mit `settings`.
Ein Avatarpfad kann nicht über `user/sitesettings` gesetzt werden.
