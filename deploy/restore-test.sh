#!/usr/bin/env bash
# VPS-007: isolated restore rehearsal; NEVER touches the live Postgres or media.
set -euo pipefail
umask 077
fail() { printf 'Restore verification failed: %s\n' "$*" >&2; exit 1; }
[[ ${EUID} -eq 0 ]] || fail 'root is required'
[[ $# -eq 1 && $1 = /* ]] || fail 'pass one absolute backup directory'
exec 8>/run/lock/hamidian-silver-restore.lock
flock -n 8 || fail 'another restore verification is running'
root=/var/backups/hamidian-silver
[[ -d $root && ! -L $root ]] || fail 'backup root missing or symlinked'
backup=$(realpath -e -- "$1")
[[ $(dirname -- "$backup") = "$root" && -d $backup && ! -L $1 && $(stat -c '%u' -- "$backup") = 0 ]] || fail 'backup must be a root-owned direct child of backup root'
for file in db.dump media.tar.gz sizes SHA256SUMS; do
    [[ -f $backup/$file && ! -L $backup/$file && $(stat -c '%u' -- "$backup/$file") = 0 ]] || fail "missing or unsafe $file"
done
(cd "$backup" && sha256sum --check --status SHA256SUMS) || fail 'checksum mismatch'
docker run --help >/dev/null || fail 'docker is unavailable'

read -r db_bytes media_bytes <"$backup/sizes"
free_bytes=$(df -PB1 -- "$root" | awk 'NR==2 {print $4}')
[[ $media_bytes =~ ^[0-9]+$ && $db_bytes =~ ^[0-9]+$ && $free_bytes =~ ^[0-9]+$ ]] || fail 'disk check failed'
# Use pre-compression source sizes, allowing for PostgreSQL WAL and a 6 GiB margin.
(( free_bytes >= 2 * db_bytes + media_bytes + 6 * 1024 * 1024 * 1024 )) || fail 'not enough free disk space to test restore'

temp=$(mktemp -d "$root/.restore-test-XXXXXXXX")
container="hamidian-restore-$$"
cleanup() {
    docker rm -f -- "$container" >/dev/null 2>&1 || true
    if [[ -n ${temp:-} && -d $temp ]]; then rm -r -- "$temp"; fi
}
trap cleanup EXIT

docker run --rm -d --network none --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=restorecheck postgres:18.6-alpine >/dev/null
ready=0
for ((i=0; i<40; i++)); do
    if docker exec "$container" pg_isready -q -U postgres -d restorecheck; then ready=1; break; fi
    sleep 2
done
(( ready )) || fail 'isolated postgres did not become ready'
docker exec -i "$container" pg_restore -U postgres -d restorecheck --no-owner --no-acl --exit-on-error --single-transaction <"$backup/db.dump" || fail 'database restore failed'
mkdir -m 0700 "$temp/media"
tar -C "$temp/media" --no-same-owner --no-same-permissions -xzf "$backup/media.tar.gz" || fail 'media extraction failed'

docker exec "$container" psql -X -q -A -t -U postgres -d restorecheck -c 'COPY (SELECT "storageKey" FROM public.media WHERE "deletedAt" IS NULL) TO STDOUT' >"$temp/keys" || fail 'restored media query failed'
count=0
while IFS= read -r key; do
    [[ $key =~ ^[a-zA-Z0-9._/-]+$ && $key != /* && $key != *..* && $key != *//* ]] || fail 'unsafe media storage key in restored database'
    [[ -f $temp/media/$key && ! -L $temp/media/$key ]] || fail 'a referenced media file is absent from this backup'
    ((count+=1))
done <"$temp/keys"
printf 'Isolated restore passed: database, media archive, %s active media references. Production unchanged.\n' "$count"
