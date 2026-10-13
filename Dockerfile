FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* && corepack enable \
    && mkdir -p /srv /data/media && chown -R node:node /srv /data
USER node
WORKDIR /srv
COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile && pnpm build
ENV NODE_ENV=production MEDIA_DIR=/data/media
EXPOSE 3000
# Apply committed SQL migrations, then serve. The /data volume inherits node ownership.
CMD ["sh", "-c", "pnpm --filter @bildkeller/db db:migrate && pnpm --filter @bildkeller/app start -p 3000"]
