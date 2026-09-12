#!/usr/bin/env python3
"""Accept one git-archive tar on stdin into a new, root-owned release directory."""

import os
import re
import shutil
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath

ROOT = Path('/opt/hamidian-silver')
RELEASES = ROOT / 'releases'
MAX_FILE_BYTES = 60 * 1024 * 1024
MAX_TOTAL_BYTES = 300 * 1024 * 1024
MAX_ENTRIES = 25000


def fail(message: str) -> None:
    raise SystemExit(f'Release receive failed: {message}')


def extract_archive(stream, staging: Path) -> None:
    written = 0
    entries = 0
    # Never call tar -x on an unvalidated stream as root. git archive in this
    # repo contains only files and directories; links and devices are rejected.
    with tarfile.open(fileobj=stream, mode='r|') as archive:
        for entry in archive:
            entries += 1
            if entries > MAX_ENTRIES:
                fail('release archive contains too many files')
            path = PurePosixPath(entry.name)
            if (not entry.name or entry.name.startswith('/') or '\\' in entry.name
                    or any(part in ('', '.', '..') for part in path.parts)):
                fail('unsafe path in release archive')
            target = staging.joinpath(*path.parts)
            if entry.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if not entry.isfile() or entry.size < 0 or entry.size > MAX_FILE_BYTES:
                fail('unsupported or oversized archive entry')
            written += entry.size
            if written > MAX_TOTAL_BYTES:
                fail('archive exceeds 300 MiB safety limit')
            target.parent.mkdir(parents=True, exist_ok=True)
            source = archive.extractfile(entry)
            if source is None:
                fail('archive entry could not be read')
            with target.open('xb') as output:
                shutil.copyfileobj(source, output)
            target.chmod(0o755 if entry.mode & 0o111 else 0o644)
    if not (staging / 'compose.production.yaml').is_file() or not (staging / 'deploy/check-production-media.sh').is_file():
        fail('required production files are missing')


def main() -> None:
    if os.geteuid() != 0 or len(sys.argv) != 2 or not re.fullmatch(r'[0-9a-f]{40}', sys.argv[1]):
        fail('root and one 40-character git SHA are required')
    sha = sys.argv[1]
    if not ROOT.is_dir() or ROOT.is_symlink() or ROOT.stat().st_uid != 0:
        fail('production parent must exist and be root-owned')
    RELEASES.mkdir(mode=0o755, exist_ok=True)
    if RELEASES.is_symlink() or RELEASES.stat().st_uid != 0:
        fail('releases directory must be root-owned and not a symlink')
    destination = RELEASES / sha
    if destination.exists() or destination.is_symlink():
        marker = destination / '.hamidian-release-sha'
        if destination.is_dir() and not destination.is_symlink() and marker.is_file() and not marker.is_symlink() and marker.read_text().strip() == sha:
            # Drain stdin so `git archive | ssh` completes even on a workflow retry.
            read_bytes = 0
            while chunk := sys.stdin.buffer.read(1024 * 1024):
                read_bytes += len(chunk)
                if read_bytes > MAX_TOTAL_BYTES + 100 * 1024 * 1024:
                    fail('duplicate release archive exceeds safety limit')
            print(f'Release already present: {sha}')
            return
        fail('release target already exists but is not a validated release')

    os.umask(0o022)
    staging = Path(tempfile.mkdtemp(prefix='.incoming-', dir=RELEASES))
    try:
        extract_archive(sys.stdin.buffer, staging)
        (staging / '.hamidian-release-sha').write_text(sha + '\n')
        os.replace(staging, destination)
        print(f'Received root-owned release: {sha}')
    finally:
        if staging.exists():
            shutil.rmtree(staging)


if __name__ == '__main__':
    main()
