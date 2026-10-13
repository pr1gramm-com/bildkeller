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
  A missing/wrong nonce answers `{"error": "csrf"}`.
- **Flags** (bitmask): sfw 1, nsfw 2, nsfl 4, nsfp 8, pol 16. Requested flags are intersected with what the account
  may see (guests: 1, unverified: 1|8, verified: all).
- **Pagination:** `items.get` returns up to 50 items, newest first; continue with `older=<last id>`.
  `id=<n>` starts the list at item `n` (direct links). `atStart` / `atEnd` report the edges.

## Upload (two phases)
1. `POST /api/items/upload` — multipart field `image` → `{key}`. Magic bytes are validated; errors: `invalid`, `ratelimited`.
2. `POST items.post` — `key`, `sfwstatus` (sfw|nsfw|nsfl|nsfp|pol), `tags` (comma separated, max 16), optional `source`,
   `targetCollectionId` → `{itemId}`. Errors: `similar` (exact duplicate), `taglimit`, `verification required`, `invalid key`.

## Feed query language (`items.get?tags=`)
`! tag -tag -"video" -"sound" -"repost" s:<netScore> u:<user>`
A leading `!` marks the advanced form; tokens are space separated; tags are AND-combined; unknown `x:y` tokens are ignored.

## Endpoints
- **admin**: `ban`, `reports`, `resolveReport`, `unban`
- **bookmarks**: `add`, `delete`, `get`
- **collections**: `add`, `addCurator`, `create`, `delete`, `edit`, `follow`, `get`, `remove`, `removeCurator`, `unfollow`
- **comments**: `edit`, `fav`, `getEditHistory`, `post`, `unfav`, `vote`
- **contact**: `report`
- **inbox**: `comments`, `conversations`, `digests`, `follows`, `mentions`, `messages`, `notifications`, `post`
- **items**: `delete`, `get`, `info`, `post`, `ratelimited`, `upload`, `vote`
- **profile**: `block`, `blockTag`, `commentlikes`, `comments`, `follow`, `info`, `subscribe`, `unblock`, `unblockTag`, `unfollow`, `unsubscribe`
- **tags**: `add`, `delete`, `top`, `vote`
- **user**: `ageVerified`, `blockedTags`, `blocklist`, `cancelAccountDeletion`, `changepassword`, `collectionfollowlist`, `confirmAccountDeletion`, `dataExport`, `dataExportStatus`, `deletionStatus`, `followlist`, `info`, `invite`, `joinwithinvite`, `loadinvite`, `login`, `logout`, `requestAccountDeletion`, `sitesettings`, `sync`, `validate`

(Generated from the registered handlers; `user.sync` is the event-log endpoint: `offset`, `limit` → `inbox` counters,
`log` (base64 JSON events), `logLength`, `nextOffset`, `hasMore`, `score`, `settings`.)

## Deliberate deviations from the reference API
These could not be observed from the outside, or are simplified. Clients should treat them as Bildkeller semantics.
- `error` is always present (reference responses omit it on some endpoints).
- **Promotion**: an item becomes "popular" when `up − down ≥ promotion.threshold` (default 3); `promoted` holds that timestamp.
- **Benis** (`score`): `2 × net votes on own items + net votes on own comments`. `mark` is a plain rank integer (default 2).
- **Sync log** events are JSON (`{id, type: "vote", target: "item"|"comment", id, up}`), base64 encoded; vote semantics are toggles.
- New tags receive the adder's upvote, so they pass the client display threshold (confidence ≥ 0.2).
- `subscribe`/`unsubscribe` are aliases of `follow`/`unfollow`.
- `bookmarks.*` store item bookmarks (`itemId`), not saved searches.
- `inbox.messages` shape: `{with, messages: [{id, created, sent, message}]}`; `inbox.deleteConversation` is not implemented.
- Collection curators are added directly (`addCurator`) without an accept step; no `curatorAccept/Allow/Ignore`.
- Tag deletion is moderator/admin only; `tags.details`, `tags.chronicle`, `items.preview`, `comments.preview`,
  `profile.preview`, `faq.*`, `stats.user` are not implemented.
- Search prefixes for date range, resolution and `-m:<mark>` are parsed-and-ignored (`s:` and `u:` work).
- Not implemented families: casino, slots, polls, calendar, secretsanta, memes, pr0mium/payments, oauth, push, SSE tiles.
- Reposts: exact SHA-256 match of the uploaded file (no perceptual hashing yet).
