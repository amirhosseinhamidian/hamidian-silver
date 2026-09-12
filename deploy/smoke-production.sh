#!/usr/bin/env bash
# VPS-011: public, read-only checks via local Nginx with real hostname TLS.
set -euo pipefail

fail() { printf 'Production smoke failed: %s\n' "$*" >&2; exit 1; }
[[ $# -eq 0 ]] || fail 'no arguments or credentials are accepted'

expect_status() {
    local host=$1 path=$2 expected=$3 code
    code=$(curl --silent --show-error --noproxy '*' --resolve "$host:443:127.0.0.1" \
        --max-time 15 --output /dev/null --write-out '%{http_code}' "https://$host$path") || fail "$host$path is unreachable or TLS verification failed"
    [[ $code = "$expected" ]] || fail "$host$path returned HTTP $code (expected $expected)"
    printf 'HTTP %s: %s%s\n' "$code" "$host" "$path"
}

expect_status api.hamidian.shop /api/v1/health/ready 200
expect_status hamidian.shop /api/health 200
expect_status admin.hamidian.shop /api/health 200
expect_status hamidian.shop / 200
expect_status hamidian.shop /__vps011_missing_route__ 404
expect_status media.hamidian.shop /media/__vps011_missing_image__.png 404

printf 'Read-only HTTPS smoke passed. OTP, live payment, backups and admin authorization still require manual checks.\n'
