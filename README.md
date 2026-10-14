# Bildkeller

Self-hosted, open-source image board: one stream of images and videos with voting, tagged content ratings,
threaded comments, profiles, follows, messages and collections.

The HTTP API follows the structure of an existing, popular German image board (endpoint names, parameters and
response shapes), so API clients written for that style of board can be pointed at a Bildkeller instance.
The web client's code, logo and icons are original; its look and feel is **inspired by [pr0gramm.com](https://pr0gramm.com)**.

> **Not affiliated with, endorsed by, or derived from the source code of any other site.** The API contract was
> documented from observed behaviour for interoperability; no code, templates, assets or branding were copied.
> See [docs/api-spec.md](docs/api-spec.md) for the contract and where it deliberately deviates.

## Features

- Upload (PNG, JPEG, GIF, WebM, MP4, MOV), thumbnails, exact-duplicate (repost) detection, per-user upload quota
- Feeds: new / popular / junk, tag feeds, cursor pagination, content-rating flags (sfw, nsfw, nsfl, nsfp, pol)
- Voting with toggle, Wilson-score confidence for tags and comments, configurable promotion threshold
- Tags with per-tag votes and a search language: `! cats -dogs -"video" s:100 u:name`
- Threaded comments with edit history, mentions, favourites
- Profiles, benis score, follow, block (users and tags), private messages, notifications, collections
- Invite-only registration (first account becomes admin), reports, bans, admin UI, GDPR basics (export, deletion)
- Event-log based `user/sync` (vote cache across devices) as in the reference API

Not in v1: casino/events, payments, OAuth provider, mobile apps, multi-board.

## Quick start (Docker)

```bash
cp .env.example .env        # set POSTGRES_PASSWORD
docker compose up -d --build
# open http://localhost:3000 and register: the first account becomes admin (no invite needed)
```

Details: [docs/self-hosting.md](docs/self-hosting.md).

## Development

Requirements: Node 24, pnpm 12, PostgreSQL, ffmpeg.

```bash
pnpm install
createdb bildkeller
(cd packages/db && npx drizzle-kit push)     # dev: sync schema; production uses committed migrations
pnpm dev                                      # http://localhost:3000
pnpm test                                     # needs PostgreSQL (creates bildkeller_test)
pnpm --filter @bildkeller/app seed            # end-to-end seed + smoke test against a running EMPTY instance
```

Layout: `app/` Next.js app (API in `src/lib/api/endpoints`, client in `src/components`), `packages/db` Drizzle schema + migrations.

## License

AGPL-3.0-or-later. If you run a modified version as a network service you must offer its source to your users.
