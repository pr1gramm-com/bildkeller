FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /srv
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
ENV NODE_ENV=production MEDIA_DIR=/data/media
EXPOSE 3000
# Apply committed SQL migrations, then serve.
CMD ["sh", "-c", "pnpm --filter @bildkeller/db db:migrate && pnpm --filter @bildkeller/app start -p 3000"]
