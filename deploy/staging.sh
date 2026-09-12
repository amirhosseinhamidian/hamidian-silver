#!/usr/bin/env bash
# Deliberately fixed Compose identity: a staging failure cannot call production Compose.
set -euo pipefail
umask 027
fail() { printf 'Staging failed: %s\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 && $# -eq 2 ]] || fail 'run as root: staging.sh up|seed|smoke|status|stop /absolute/checkout'
action=$1
[[ $action = up || $action = seed || $action = smoke || $action = status || $action = stop ]] || fail 'unknown operation'
[[ $2 = /* && -d $2 && ! -L $2 ]] || fail 'checkout must be an absolute real directory'
project=$(realpath -e -- "$2")
[[ -f $project/compose.staging.yaml && ! -L $project/compose.staging.yaml ]] || fail 'staging Compose is missing or symlinked'
env_file=/etc/hamidian-silver/staging.env
media=/var/lib/hamidian-silver/staging-media
[[ -d $media && ! -L $media && $(stat -c '%u:%g:%a' "$media") = '1000:1000:750' ]] || fail 'staging media must exist and be uid:gid 1000:1000 mode 0750'
validator=/usr/local/libexec/hamidian-silver/check-staging-env.py
[[ -x $validator && ! -L $validator && $(stat -c %u "$validator") = 0 ]] || fail 'root-owned staging env validator is missing'
if [[ $action = seed ]]; then
    "$validator" --bootstrap
else
    "$validator"
fi

exec 9>/run/lock/hamidian-silver-staging.lock
flock -n 9 || fail 'another staging action is running'
compose() {
    local env_args=(--env-file "$env_file")
    if [[ $action = seed ]]; then
        env_args+=(--env-file /etc/hamidian-silver/staging-bootstrap.env)
    fi
    env -i HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
        docker compose --project-directory "$project" "${env_args[@]}" -f "$project/compose.staging.yaml" "$@"
}
compose config --quiet

smoke() {
    curl -fsS --noproxy '*' --max-time 12 -o /dev/null http://127.0.0.1:3200/api/v1/health/ready
    curl -fsS --noproxy '*' --max-time 12 -o /dev/null http://127.0.0.1:3201/api/health
    curl -fsS --noproxy '*' --max-time 12 -o /dev/null http://127.0.0.1:3202/api/health
    printf 'Isolated staging API, storefront, admin: healthy on host loopback\n'
}

free_space() {
    local location amount
    for location in "$project" "$media" /var/lib/docker; do
        amount=$(df -PB1 -- "$location" | awk 'NR==2 {print $4}')
        [[ $amount =~ ^[0-9]+$ && $amount -ge $1 ]] || fail "insufficient free disk on filesystem containing $location"
    done
}

prune_cache() {
    # No --all, no volume prune, no application image or backup deletion.
    docker builder prune --force --filter until=72h --keep-storage=2GB
    docker image prune --force --filter until=72h
}

case "$action" in
    up)
        prune_cache
        free_space $((14 * 1024 * 1024 * 1024))
        compose up -d --wait --wait-timeout 240 postgres redis
        compose build migrate api storefront admin
        free_space $((10 * 1024 * 1024 * 1024))
        # migrate target runs ONLY prisma migrate deploy, never migrate dev.
        compose run --rm migrate
        compose up -d --no-build --wait --wait-timeout 240 api storefront admin
        smoke
        prune_cache
        free_space $((10 * 1024 * 1024 * 1024))
        ;;
    seed)
        prune_cache
        free_space $((10 * 1024 * 1024 * 1024))
        compose build seed
        free_space $((10 * 1024 * 1024 * 1024))
        compose run --rm seed
        smoke
        prune_cache
        free_space $((10 * 1024 * 1024 * 1024))
        ;;
    smoke) smoke ;;
    status) compose ps ;;
    stop)
        compose stop admin storefront api redis postgres
        printf 'Staging containers stopped. Its named volumes and media were retained.\n'
        ;;
esac
