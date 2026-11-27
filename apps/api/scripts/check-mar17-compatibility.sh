#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$repo_root"
baseline=4a2e24698dafaa7b73ec45d1c767c872abea9bf8
prisma="$repo_root/node_modules/.bin/prisma"
tsx="$repo_root/node_modules/.bin/tsx"
[[ -x "$prisma" && -x "$tsx" && -d "$repo_root/apps/api/node_modules" ]] || {
  printf 'Install the workspace dependencies before running the compatibility check.\n' >&2
  exit 1
}

snapshot="$(mktemp -d "${TMPDIR:-/tmp}/hamidian-mar17.XXXXXX")"
container_id=
cleanup() {
  if [[ -n "$container_id" ]]; then
    docker stop "$container_id" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$snapshot"
}
trap cleanup EXIT

git archive "$baseline" prisma.config.ts apps/api/package.json apps/api/tsconfig.json \
  apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src \
  | tar -xf - -C "$snapshot"
ln -s "$repo_root/node_modules" "$snapshot/node_modules"
ln -s "$repo_root/apps/api/node_modules" "$snapshot/apps/api/node_modules"
mkdir -p "$snapshot/apps/api/scripts"
smoke=apps/api/scripts/campaign-compatibility-smoke.ts
cp "$smoke" "$snapshot/$smoke"

container_id="$(docker run -d --rm \
  -e POSTGRES_USER=hamidian \
  -e POSTGRES_PASSWORD=mar17_local \
  -e POSTGRES_DB=hamidian_mar17_compat \
  -p 127.0.0.1::5432 postgres:18.6-alpine)"
for attempt in {1..30}; do
  docker exec "$container_id" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_mar17_compat && break
  sleep 1
done
docker exec "$container_id" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_mar17_compat
address="$(docker port "$container_id" 5432/tcp)"
[[ "$address" =~ ^127\.0\.0\.1:[0-9]+$ ]] || exit 1
export DATABASE_URL="postgresql://hamidian:mar17_local@${address}/hamidian_mar17_compat?schema=public"
evidence_file="$snapshot/legacy.sha256"

printf '\nBaseline %s\n' "$baseline"
(
  cd "$snapshot"
  "$prisma" migrate deploy
  "$prisma" generate
  "$tsx" --tsconfig apps/api/tsconfig.json "$smoke" seed "$evidence_file"
)

printf '\nApplying candidate migrations to the populated baseline\n'
"$prisma" migrate deploy
"$prisma" migrate status
(
  cd "$snapshot"
  "$tsx" --tsconfig apps/api/tsconfig.json "$smoke" expanded-legacy "$evidence_file"
)

printf '\nReading legacy data and creating representative records with the candidate\n'
"$prisma" generate
"$tsx" --tsconfig apps/api/tsconfig.json "$smoke" candidate "$evidence_file"

printf '\nChecking the baseline reader on the expanded schema after candidate writes\n'
(
  cd "$snapshot"
  "$tsx" --tsconfig apps/api/tsconfig.json "$smoke" rollback "$evidence_file"
)
