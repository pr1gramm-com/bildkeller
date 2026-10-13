# Self-hosting

## Requirements
Docker with Compose, ~1 GB RAM, disk for media (`media-data` volume).

## Configuration
| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | `change-me` | database password — **change it**; use letters/digits only (it is embedded in a URL). Postgres ignores later changes once the volume exists |
| `PORT` | `3000` | published port |
| `DATABASE_URL` | set by compose | PostgreSQL connection string |
| `MEDIA_DIR` | `/data/media` | where uploads are stored (content-addressed) |

Runtime tunables live in the `site_config` table (key → JSON value):

| Key | Default | Meaning |
|---|---|---|
| `promotion.threshold` | `3` | net votes (up − down) at which an item is promoted to "popular" |
| `upload.ratelimit.count` | `60` | uploads per window per user |
| `upload.ratelimit.hours` | `24` | window length |
| `invites.required` | `true` | set `false` for open registration |

```sql
INSERT INTO site_config (key, value) VALUES ('invites.required', 'false')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

## First start
1. `docker compose up -d --build` — migrations are applied automatically.
2. Register the first account: it becomes admin and moderator.
3. Create invites under *Einstellungen → Einladungscode erzeugen*.

## Reverse proxy / TLS
Rate limits (login, registration, comments, messages) are per process and keyed by the first `X-Forwarded-For` entry, so run behind a proxy that sets it. Cookies get `Secure` automatically when `X-Forwarded-Proto: https`.

Put any reverse proxy (Caddy, nginx, Traefik) in front of port 3000. Media is served at `/media/*` with
long-lived immutable caching headers; a CDN can sit in front of that path.

## Backups
Back up the `db-data` (PostgreSQL) **and** `media-data` volumes together.
`pg_dump` is the recommended database backup.

## Updating
`git pull && docker compose up -d --build` — new migrations run on start.

## Notes
- Age verification is a self-declaration checkbox. If your jurisdiction requires proof, replace `user.ageVerified`.
- E-mail is not required or sent in v1.
