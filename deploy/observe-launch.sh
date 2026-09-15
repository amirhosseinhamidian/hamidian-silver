#!/usr/bin/env bash
# VPS-012: read-only 72-hour launch snapshot; no request paths, customer data or secrets.
set -euo pipefail

fail() { printf 'Launch observation failed: %s\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 && $# -eq 0 ]] || fail 'run as root with no arguments'
current=/opt/hamidian-silver/current
backups=/var/backups/hamidian-silver
[[ -L $current && -f $current/compose.production.yaml ]] || fail 'production current release is missing'
[[ -d $backups && ! -L $backups ]] || fail 'verified backup directory is missing'

/usr/local/libexec/hamidian-silver/smoke-production.sh

for timer in hamidian-silver-backup.timer hamidian-silver-monitor.timer; do
    systemctl is-active --quiet "$timer" || fail "$timer is not active"
done
for service in hamidian-silver-backup.service hamidian-silver-monitor.service; do
    [[ $(systemctl show "$service" -p Result --value) = success ]] || fail "$service did not last complete successfully"
done

latest=$(find "$backups" -mindepth 1 -maxdepth 1 -type d -name 'backup-*' -printf '%f\n' | LC_ALL=C sort -r | head -n 1)
[[ $latest =~ ^backup-[0-9]{8}T[0-9]{6}Z$ ]] || fail 'no recognized backup directory'
backup="$backups/$latest"
[[ ! -L $backup && -f $backup/.complete && -f $backup/verified-at-utc ]] || fail 'latest backup is incomplete'
verified=$(date -u -d "$(<"$backup/verified-at-utc")" +%s) || fail 'invalid backup verification time'
age=$(( $(date -u +%s) - verified ))
(( age >= 0 && age <= 30 * 3600 )) || fail 'latest verified backup is older than 30 hours'

for path in / /var/lib/docker /var/lib/hamidian-silver/media "$backups"; do
    free=$(df -PB1 -- "$path" | awk 'NR==2 {print $4}')
    [[ $free =~ ^[0-9]+$ && $free -ge $((12 * 1024 * 1024 * 1024)) ]] || fail "insufficient free space on filesystem containing $path"
done

printf 'Launch snapshot OK at %s UTC; backup %s (%s hours old); free disk >=12 GiB.\n' \
    "$(date -u '+%Y-%m-%d %H:%M:%S')" "$latest" "$((age / 3600))"
printf 'External uptime, GA4 events, Search Console, orders and payments still need owner review.\n'
