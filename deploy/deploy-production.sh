#!/usr/bin/env bash
# VPS-009: root-owned release orchestrator, invoked by a narrowly scoped SSH sudo rule.
set -euo pipefail
umask 027

fail() { printf 'Production deploy failed: %s\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 && $# -eq 1 && $1 =~ ^[0-9a-f]{40}$ ]] || fail 'root and exactly one 40-character git SHA are required'
sha=$1
root=/opt/hamidian-silver
releases=$root/releases
release=$releases/$sha
env_file=/etc/hamidian-silver/production.env
libexec=/usr/local/libexec/hamidian-silver
backup_root=/var/backups/hamidian-silver
min_free=$((10 * 1024 * 1024 * 1024))

exec 9>/run/lock/hamidian-silver-deploy.lock
flock -n 9 || fail 'another production deploy is running'
[[ -d $root && ! -L $root && -d $releases && ! -L $releases && $(stat -c %u "$root") = 0 && $(stat -c %u "$releases") = 0 ]] || fail 'release paths must be real root-owned directories'
[[ -d $release && ! -L $release && $(stat -c %u "$release") = 0 && -f $release/.hamidian-release-sha && ! -L $release/.hamidian-release-sha ]] || fail 'release is missing or untrusted'
[[ $(<"$release/.hamidian-release-sha") = "$sha" && -f $release/compose.production.yaml ]] || fail 'release marker and SHA mismatch'
[[ -f $env_file && ! -L $env_file && $(stat -c '%u:%a' "$env_file") = '0:600' ]] || fail 'production env must be root-owned mode 0600'
[[ -x $libexec/check-production-media.sh && -x $libexec/backup-production.sh ]] || fail 'VPS-006/007 host scripts are missing'
[[ -d $backup_root && ! -L $backup_root ]] || fail 'backup directory is missing'

compose() {
    local directory=$1 tag=$2
    shift 2
    DEPLOY_SHA="$tag" docker compose --project-directory "$directory" --env-file "$env_file" -f "$directory/compose.production.yaml" "$@"
}

free_space() {
    local location available
    for location in "$root" /var/lib/hamidian-silver/media "$backup_root" /var/lib/docker; do
        available=$(df -PB1 -- "$location" | awk 'NR==2 {print $4}')
        [[ $available =~ ^[0-9]+$ && $available -ge $min_free ]] || fail "less than 10 GiB free on filesystem containing $location; investigate manually"
    done
}

# Only old build cache and unused dangling images: never -a, system prune, or volumes.
prune_safe_cache() {
    docker builder prune --force --filter until=72h --keep-storage=2GB
    docker image prune --force --filter until=72h
}

"$libexec/check-production-media.sh" >/dev/null
[[ -L $root/current && -d $root/current ]] || fail 'bootstrap current must exist as a symlink'
old=$(realpath -e -- "$root/current")
[[ -f $old/compose.production.yaml && ! -L $old/compose.production.yaml ]] || fail 'current release has no trusted Compose file'
[[ $old = "$release" ]] && { printf 'Release %s is already current; nothing to deploy.\n' "$sha"; exit 0; }
old_tag=manual
if [[ $old = "$releases/"* ]]; then
    [[ $old =~ ^$releases/([a-f0-9]{40})$ ]] || fail 'current managed release name is invalid'
    old_tag=${BASH_REMATCH[1]}
    [[ -f $old/.hamidian-release-sha && $(<"$old/.hamidian-release-sha") = "$old_tag" ]] || fail 'current managed release marker is invalid'
fi
[[ $(stat -c %u -- "$old") = 0 ]] || fail 'current directory must be root-owned'
if [[ -e $root/previous ]]; then
    fail 'previous must be absent or a symlink; do not overwrite an existing path'
fi
if [[ -L $root/previous ]]; then
    prior=$(realpath -e -- "$root/previous") || fail 'previous release link is broken'
    [[ -f $prior/compose.production.yaml && $(stat -c %u -- "$prior") = 0 ]] || fail 'previous release is invalid'
fi
compose "$old" "$old_tag" config --quiet
compose "$release" "$sha" config --quiet
for service in api storefront admin; do
    id=$(compose "$old" "$old_tag" ps -q "$service")
    [[ -n $id && $(docker inspect -f '{{.State.Health.Status}}' "$id") = healthy ]] || fail "existing $service is not healthy; repair before deployment"
    # The legacy checkout has unversioned Compose images; pin running IDs too.
    docker image tag "$(docker inspect -f '{{.Image}}' "$id")" "hamidian-silver-$service:$old_tag"
done

cutover=0
recover() {
    local result=$? rollback_ok=1
    trap - EXIT
    if (( result != 0 )); then
        if (( cutover == 1 )); then
            printf 'New release unhealthy. Attempting application rollback to %s; database migrations are NOT reverted.\n' "$old" >&2
            if ! compose "$old" "$old_tag" up -d --no-build --wait --wait-timeout 240 api storefront admin; then
                printf 'Automatic application rollback FAILED. Keeping all images for manual recovery.\n' >&2
                rollback_ok=0
            fi
        fi
        if (( rollback_ok == 1 )) && [[ -L $root/current && $(realpath -e -- "$root/current") = "$old" ]]; then
            for service in migrate api storefront admin; do
                docker image rm -- "hamidian-silver-$service:$sha" >/dev/null 2>&1 || true
            done
            prune_safe_cache || printf 'Cache cleanup after failure did not complete; inspect Docker disk use.\n' >&2
            printf 'Failed release was not promoted. Its archive is retained for diagnosis; unused new images were cleaned when safe.\n' >&2
        fi
    fi
    exit "$result"
}
trap recover EXIT

prune_safe_cache
free_space

# Fail closed if verification or backup restore test fails; preserve the previous app.
# The VPS-007 script keeps the two newest verified backups, never prunes media.
"$libexec/backup-production.sh" "$old"
latest=$(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name 'backup-*' -printf '%f\n' | LC_ALL=C sort -r | head -n 1)
[[ $latest =~ ^backup-[0-9]{8}T[0-9]{6}Z$ && -f $backup_root/$latest/.complete && -f $backup_root/$latest/verified-at-utc ]] || fail 'no fresh, verified backup; migration refused'
verified=$(date -u -d "$(<"$backup_root/$latest/verified-at-utc")" +%s) || fail 'verified backup timestamp is invalid'
age=$(( $(date -u +%s) - verified ))
(( age >= 0 && age <= 1800 )) || fail 'last verified backup is older than 30 minutes; migration refused'
free_space

compose "$release" "$sha" build migrate api storefront admin
free_space
compose "$release" "$sha" run --rm migrate

cutover=1
compose "$release" "$sha" up -d --no-build --wait --wait-timeout 240 api storefront admin

# Host-installed Nginx must route each real hostname to the healthy loopback service.
curl -fsS --noproxy '*' --resolve api.hamidian.shop:443:127.0.0.1 --max-time 12 -o /dev/null https://api.hamidian.shop/api/v1/health/ready
curl -fsS --noproxy '*' --resolve hamidian.shop:443:127.0.0.1 --max-time 12 -o /dev/null https://hamidian.shop/api/health
curl -fsS --noproxy '*' --resolve admin.hamidian.shop:443:127.0.0.1 --max-time 12 -o /dev/null https://admin.hamidian.shop/api/health

# Keep the former current as previous. Atomic replacement prevents a broken link.
ln -s -- "$old" "$root/.previous-next-$$"
mv -Tf -- "$root/.previous-next-$$" "$root/previous"
ln -s -- "$release" "$root/.current-next-$$"
mv -Tf -- "$root/.current-next-$$" "$root/current"
cutover=0
trap - EXIT

# Remove only explicitly validated, retired managed releases, never an arbitrary
# checkout, backup, image volume, active release or rollback image.
for candidate in "$releases"/*; do
    [[ -d $candidate && ! -L $candidate && $candidate != "$release" && $candidate != "$old" ]] || continue
    basename=${candidate##*/}
    [[ $basename =~ ^[a-f0-9]{40}$ && -f $candidate/.hamidian-release-sha && ! -L $candidate/.hamidian-release-sha && $(<"$candidate/.hamidian-release-sha") = "$basename" && $(stat -c %u "$candidate") = 0 ]] || continue
    rm -r -- "$candidate"
    printf 'Removed retired git-backed release: %s\n' "$basename"
done

while IFS= read -r tag; do
    [[ $tag =~ ^hamidian-silver-(api|storefront|admin|migrate):([0-9a-f]{40})$ ]] || continue
    [[ ${BASH_REMATCH[2]} != "$sha" && ${BASH_REMATCH[2]} != "$old_tag" ]] || continue
    docker image rm -- "$tag" || printf 'Retired image still in use; kept %s\n' "$tag" >&2
done < <(docker image ls --format '{{.Repository}}:{{.Tag}}')
# Once both retained releases have versioned tags, legacy manual images are
# no longer part of rollback. docker refuses to remove any still-used image.
if [[ $old_tag != manual ]]; then
    for service in api storefront admin migrate; do
        docker image rm -- "hamidian-silver-$service:manual" >/dev/null 2>&1 || true
    done
fi
prune_safe_cache
free_space
printf 'Production release %s deployed; prior release retained at %s.\n' "$sha" "$old"
