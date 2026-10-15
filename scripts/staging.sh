#!/usr/bin/env bash
# Staging di server untuk uji sebelum deploy produksi:
#   - image dibangun dari commit HEAD (sama seperti deploy.sh)
#   - database terpisah "eticket_staging" + Redis db 1 (data produksi tidak tersentuh)
#   - tanpa worker → tidak ada email yang terkirim
#   - hanya di localhost server: http://127.0.0.1:${STG_PORT} (akses lewat ssh -L ${STG_PORT}:127.0.0.1:${STG_PORT})
#
#   bash scripts/staging.sh          # bangun & jalankan (seed data demo)
#   bash scripts/staging.sh down     # hapus container + database staging
set -euo pipefail
STG_PORT="${STG_PORT:-3125}"

HOST="${DEPLOY_HOST:-usersentul01@172.20.240.61}"
DIR="${DEPLOY_DIR:-eticket}"
SHA="$(git rev-parse --short HEAD)"

if [ "${1:-}" = "down" ]; then
  ssh "$HOST" 'podman rm -f eticket_staging >/dev/null 2>&1 || true
    podman exec eticket_postgres dropdb -U eticket --if-exists eticket_staging
    podman exec eticket_redis redis-cli -n 1 FLUSHDB >/dev/null; echo "staging dihapus"'
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive --format=tar.gz -o "$TMP/release.tar.gz" HEAD
ssh "$HOST" "mkdir -p ~/$DIR/releases"
scp -q "$TMP/release.tar.gz" "$HOST:$DIR/releases/$SHA.tar.gz"

ssh "$HOST" "DIR=$DIR SHA=$SHA STG_PORT=$STG_PORT bash -s" <<'REMOTE'
set -euo pipefail
STG_PORT="${STG_PORT:-3125}"
cd ~/"$DIR"
rm -rf "src-$SHA" && mkdir "src-$SHA" && tar -xzf "releases/$SHA.tar.gz" -C "src-$SHA"
echo "→ build image eticket-app:$SHA"
podman build -q -t "eticket-app:$SHA" "src-$SHA" >/dev/null

PG_PW="$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)"
podman exec eticket_postgres dropdb -U eticket --if-exists eticket_staging
podman exec eticket_postgres createdb -U eticket eticket_staging
podman exec eticket_redis redis-cli -n 1 FLUSHDB >/dev/null
podman rm -f eticket_staging >/dev/null 2>&1 || true

podman run -d --name eticket_staging --network eticket_network --env-file .env \
  -e DATABASE_URL="postgres://eticket:${PG_PW}@eticket_postgres:5432/eticket_staging" \
  -e REDIS_URL="redis://eticket_redis:6379/1" \
  -e APP_URL="http://localhost:${STG_PORT}" -e COOKIE_SECURE=false -e TUNNEL_TOKEN= \
  -e GOOGLE_CLIENT_ID= -e GOOGLE_CLIENT_SECRET= \
  -p 127.0.0.1:${STG_PORT}:3000 --memory 768m "eticket-app:$SHA" >/dev/null

for i in $(seq 1 40); do curl -fs -o /dev/null http://127.0.0.1:${STG_PORT}/api/time && break; sleep 2; done
podman exec -e SEED_ADMIN_PASSWORD=Admin12345! -e SEED_STAFF_PASSWORD=Staf12345! -e SEED_ATTENDEE_PASSWORD=Peserta123! \
  eticket_staging node --import tsx scripts/seed.ts | tail -3
echo "✓ staging $SHA di http://127.0.0.1:${STG_PORT} (server). Tunnel: ssh -L ${STG_PORT}:127.0.0.1:${STG_PORT} $USER@$(hostname -I | cut -d' ' -f1)"
REMOTE
