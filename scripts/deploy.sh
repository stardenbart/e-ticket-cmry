#!/usr/bin/env bash
# Deploy ke server internal (podman rootless + docker-compose).
#   scripts/deploy.sh                 # deploy commit HEAD
#   DEPLOY_HOST=user@host scripts/deploy.sh
#
# Prasyarat di server: ~/eticket/.env sudah ada (lihat .env.example + bagian "Deploy" di README).
# Server dipakai bersama aplikasi lain: skrip ini hanya menyentuh ~/eticket dan container eticket_*.
set -euo pipefail

HOST="${DEPLOY_HOST:-usersentul01@172.20.240.61}"
DIR="${DEPLOY_DIR:-eticket}"
SHA="$(git rev-parse --short HEAD)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree belum bersih — commit dulu, deploy selalu dari commit." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive --format=tar.gz -o "$TMP/release.tar.gz" HEAD
echo "→ upload release $SHA"
ssh "$HOST" "mkdir -p ~/$DIR/releases"
scp -q "$TMP/release.tar.gz" "$HOST:$DIR/releases/$SHA.tar.gz"

ssh "$HOST" "DIR=$DIR SHA=$SHA bash -s" <<'REMOTE'
set -euo pipefail
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
cd ~/"$DIR"
test -f .env || { echo ".env belum ada di ~/$DIR" >&2; exit 1; }

rm -rf "src-$SHA" && mkdir "src-$SHA"
tar -xzf "releases/$SHA.tar.gz" -C "src-$SHA"
cp "src-$SHA/docker-compose.prod.yml" docker-compose.prod.yml

SITE_KEY="$(grep -E '^NEXT_PUBLIC_TURNSTILE_SITE_KEY=' .env | cut -d= -f2- || true)"
echo "→ build image eticket-app:$SHA"
podman build -q --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY="${SITE_KEY:-1x00000000000000000000AA}" \
  -t "eticket-app:$SHA" -t eticket-app:latest "src-$SHA" >/dev/null

PREV="$(cat CURRENT 2>/dev/null || true)"
echo "→ up (sebelumnya: ${PREV:-none})"
APP_IMAGE_TAG="$SHA" docker-compose -p eticket -f docker-compose.prod.yml up -d --remove-orphans
echo "$SHA" > CURRENT

for i in $(seq 1 30); do
  if curl -fs -o /dev/null "http://127.0.0.1:$(grep -E '^APP_PORT=' .env | cut -d= -f2- || echo 3110)/api/time"; then
    echo "✓ eticket $SHA sehat"
    ls -dt src-* | tail -n +4 | xargs -r rm -rf
    ls -t releases/*.tar.gz | tail -n +6 | xargs -r rm -f
    [ -n "$PREV" ] && echo "Rollback: cd ~/$DIR && APP_IMAGE_TAG=$PREV docker-compose -p eticket -f docker-compose.prod.yml up -d web worker"
    exit 0
  fi
  sleep 3
done
echo "✗ health check gagal; log:" >&2
docker logs --tail 50 eticket_web >&2 || true
exit 1
REMOTE
