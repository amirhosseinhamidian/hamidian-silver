#!/bin/sh
# VPS-006: read-only host preflight. Safe to call before each future deploy.
set -eu

media=/var/lib/hamidian-silver/media
parent=/var/lib/hamidian-silver

fail() {
    printf 'Media preflight failed: %s\n' "$1" >&2
    exit 1
}

[ "$(id -u)" -eq 0 ] || fail 'run as root to inspect the host path'
[ -d "$parent" ] || fail 'persistent parent directory is missing'
[ -d "$media" ] || fail 'persistent media directory is missing; do not create it inside a release'
[ ! -L "$parent" ] && [ ! -L "$media" ] || fail 'symlinked storage is not allowed'
[ "$(realpath -e -- "$media")" = "$media" ] || fail 'storage resolves outside its fixed path'
[ "$(stat -c '%u:%g:%a' -- "$parent")" = '0:0:755' ] || fail 'parent must be root:root with mode 0755'
[ "$(stat -c '%u:%g:%a' -- "$media")" = '1000:1000:750' ] || fail 'media must be owned by the API container uid/gid 1000:1000, mode 0750'

available_kib=$(df -Pk -- "$media" | awk 'NR == 2 {print $4}')
case "$available_kib" in
    '' | *[!0-9]*) fail 'could not read available disk space' ;;
esac
[ "$available_kib" -ge 1048576 ] || fail 'less than 1 GiB free on the media filesystem'

printf 'Media host path, ownership and disk preflight: OK\n'
