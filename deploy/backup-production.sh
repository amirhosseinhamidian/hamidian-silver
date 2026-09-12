#!/usr/bin/env bash
# VPS-007: run on the VPS as root, from the daily systemd timer or by hand.
set -euo pipefail
umask 027

fail() { printf 'Production backup failed: %s\n' "$*" >&2; exit 1; }
[[ ${EUID} -eq 0 ]] || fail 'root is required'
[[ $# -eq 1 && $1 = /* && -f $1/compose.production.yaml ]] || fail 'pass the absolute project directory'
project=$(realpath -e -- "$1")
media=/var/lib/hamidian-silver/media
root=/var/backups/hamidian-silver
env_file=/etc/hamidian-silver/production.env
[[ -f $env_file && ! -L $env_file ]] || fail 'private production env is missing or symlinked'
[[ -d $media && ! -L $media ]] || fail 'persistent media is missing or symlinked'
[[ -d $root && ! -L $root && $(realpath -e -- "$root") = "$root" ]] || fail 'create the fixed backup directory first'
[[ $(stat -c '%u:%a' -- "$root") = '0:750' ]] || fail 'backup directory must be root-owned, mode 0750'
group=$(stat -c '%G' -- "$root")
[[ $group = hamidian-backup ]] || fail 'backup directory must belong to hamidian-backup group'
script_dir=$(dirname -- "$(realpath -e -- "$0")")
"$script_dir/check-production-media.sh" >/dev/null || fail 'persistent media preflight failed'
[[ -z $(find "$media" -type l -print -quit) ]] || fail 'media contains symlinks; investigate before archiving'

exec 9>/run/lock/hamidian-silver-backup.lock
flock -n 9 || fail 'another backup is running'
compose=(docker compose --project-directory "$project" --env-file "$env_file" -f "$project/compose.production.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" exec -T postgres sh -c 'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' || fail 'production postgres is not ready'

db_bytes=$("${compose[@]}" exec -T postgres sh -c 'psql -X -A -t -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_database_size(current_database())"' | tr -d '\r\n')
[[ $db_bytes =~ ^[0-9]+$ ]] || fail 'could not measure database size'
media_bytes=$(du -sb -- "$media" | awk '{print $1}')
free_bytes=$(df -PB1 -- "$root" | awk 'NR==2 {print $4}')
[[ $free_bytes =~ ^[0-9]+$ && $media_bytes =~ ^[0-9]+$ ]] || fail 'could not measure free disk space'
# Leave room for the new backup, extracted media, restored DB/WAL and 6 GiB margin.
(( free_bytes >= 3 * db_bytes + 2 * media_bytes + 6 * 1024 * 1024 * 1024 )) || fail 'not enough free space for backup and restore; do not prune data blindly'

stage=$(mktemp -d "$root/.incomplete-XXXXXXXX")
chgrp -- "$group" "$stage"
chmod 0750 -- "$stage"
cleanup() { if [[ -n ${stage:-} && -d $stage ]]; then rm -r -- "$stage"; fi; }
trap cleanup EXIT

"${compose[@]}" exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' >"$stage/db.dump"
tar -C "$media" -czf "$stage/media.tar.gz" .
[[ -s $stage/db.dump && -s $stage/media.tar.gz ]] || fail 'backup archive is empty'
printf '%s %s\n' "$db_bytes" "$media_bytes" >"$stage/sizes"
(cd "$stage" && sha256sum db.dump media.tar.gz sizes >SHA256SUMS)
chgrp -- "$group" "$stage"/*
chmod 0640 -- "$stage"/*

# A failed restore leaves every older completed backup untouched.
"$script_dir/restore-test.sh" "$stage"
date -u '+%Y-%m-%dT%H:%M:%SZ' >"$stage/verified-at-utc"
chgrp -- "$group" "$stage/verified-at-utc"
chmod 0640 -- "$stage/verified-at-utc"
touch "$stage/.complete"
chgrp -- "$group" "$stage/.complete"
chmod 0640 -- "$stage/.complete"
stamp=$(date -u '+%Y%m%dT%H%M%SZ')
destination="$root/backup-$stamp"
[[ ! -e $destination ]] || fail 'backup name already exists; try again in a second'
mv -- "$stage" "$destination"
stage=
printf 'Verified backup: %s\n' "$destination"

# Keep two verified sets. Ignore unverified/unrecognized names when counting.
kept=0
while IFS= read -r name; do
    [[ $name =~ ^backup-[0-9]{8}T[0-9]{6}Z$ ]] || continue
    target="$root/$name"
    [[ -d $target && ! -L $target && -f $target/.complete && $(stat -c '%u' -- "$target") = 0 ]] || continue
    ((kept+=1))
    (( kept > 2 )) || continue
    rm -r -- "$target"
    printf 'Removed expired verified backup: %s\n' "$target"
done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -name 'backup-*' -printf '%f\n' | LC_ALL=C sort -r)
