# Satu image untuk web (next start) dan worker (scripts/worker.ts).
FROM docker.io/library/node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder saat build saja: koneksi DB/Redis lazy, tidak pernah dibuka saat `next build`.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:1/build REDIS_URL=redis://127.0.0.1:1
# Nilai publik dibakar saat build (site key Turnstile).
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
RUN npm run build && npm prune --omit=dev && npm install --no-save --no-audit --no-fund tsx

FROM docker.io/library/node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r app && useradd -r -g app -d /app app
COPY --from=build --chown=app:app /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/src ./src
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/db ./db
RUN mkdir -p storage/uploads && chown -R app:app storage
USER app
EXPOSE 3000
CMD ["sh", "-c", "node --import tsx scripts/migrate.ts && exec node_modules/.bin/next start -p ${PORT}"]
