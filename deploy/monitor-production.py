#!/usr/bin/env python3
"""VPS-008: host-side, read-only checks; alerts contain only service names and counts."""

from __future__ import annotations

import datetime as dt
import fcntl
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT = Path("/opt/hamidian-silver/current")
ENV = Path("/etc/hamidian-silver/production.env")
CONFIG = Path("/etc/hamidian-silver/monitor.env")
STATE = Path("/var/lib/hamidian-silver/monitor-state.json")
BACKUPS = Path("/var/backups/hamidian-silver")
ACCESS_LOG = Path("/var/log/nginx/hamidian-silver-access.log")
SERVICES = ("postgres", "redis", "api", "storefront", "admin")
URLS = (
    ("api", "https://api.hamidian.shop/api/v1/health/ready"),
    ("storefront", "https://hamidian.shop/api/health"),
    ("admin", "https://admin.hamidian.shop/api/health"),
)
GIB = 1024**3
_ACCESS_LINE = re.compile(rb"\s([1-5]\d\d)\s\d+\s(\d{10}\.\d+)\s*$")
_BACKUP_NAME = re.compile(r"backup-\d{8}T\d{6}Z")


def command(*args: str, timeout: int = 8) -> str | None:
    """Never forward stdout/stderr from commands which may mention credentials."""
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def check_http(problems: dict[str, str]) -> None:
    for name, url in URLS:
        host = urllib.parse.urlsplit(url).hostname
        assert host is not None
        result = command(
            "curl", "--fail", "--silent", "--show-error", "--max-time", "7", "--noproxy", "*",
            "--resolve", f"{host}:443:127.0.0.1", "--output", "/dev/null", url,
            timeout=10,
        )
        if result is None:
            problems[f"http:{name}"] = f"HTTPS {name} health failed"


def check_containers(problems: dict[str, str]) -> None:
    if (not PROJECT.joinpath("compose.production.yaml").is_file()
            or not ENV.is_file() or ENV.is_symlink()):
        problems["compose:config"] = "Production release or private env missing"
        return
    compose = (
        "docker", "compose", "--project-directory", str(PROJECT),
        "--env-file", str(ENV), "-f", str(PROJECT / "compose.production.yaml"),
    )
    for name in SERVICES:
        container = command(*compose, "ps", "-q", name)
        if container is None or not re.fullmatch(r"[a-f0-9]{12,64}", container):
            problems[f"container:{name}"] = f"Docker {name} not running"
            continue
        status = command("docker", "inspect", "--format", "{{.State.Health.Status}}", container)
        if status != "healthy":
            problems[f"container:{name}"] = f"Docker {name} not healthy"


def check_disks(problems: dict[str, str]) -> None:
    checked_devices: set[int] = set()
    docker_root = command("docker", "info", "--format", "{{.DockerRootDir}}")
    docker_path = Path(docker_root) if docker_root and docker_root.startswith("/") else Path("/var/lib/docker")
    for name, path in (
        ("root", Path("/")), ("media", Path("/var/lib/hamidian-silver/media")),
        ("backups", BACKUPS), ("docker", docker_path),
    ):
        try:
            device = path.stat().st_dev
            if device in checked_devices:
                continue
            checked_devices.add(device)
            usage = shutil.disk_usage(path)
            fs = os.statvfs(path)
        except OSError:
            problems[f"disk:{name}"] = f"{name} filesystem unavailable"
            continue
        if usage.free < 12 * GIB or usage.free / usage.total < 0.20:
            problems[f"disk:{name}"] = f"{name} disk low ({usage.free // GIB} GiB free)"
        if fs.f_files and fs.f_favail / fs.f_files < 0.05:
            problems[f"inodes:{name}"] = f"{name} inodes low"


def check_backup(problems: dict[str, str], now: dt.datetime) -> None:
    result = command("systemctl", "show", "hamidian-silver-backup.service", "-p", "Result", "--value")
    if result != "success":
        problems["backup:job"] = "Daily backup job failed or unavailable"
    try:
        names = sorted(
            (p for p in BACKUPS.iterdir() if _BACKUP_NAME.fullmatch(p.name) and p.is_dir()
             and not p.is_symlink() and (p / ".complete").is_file()),
            reverse=True,
        )
        if not names:
            raise ValueError("no completed backups")
        verified_at = dt.datetime.fromisoformat((names[0] / "verified-at-utc").read_text().strip())
        age = now - verified_at.astimezone(dt.timezone.utc)
        if age < dt.timedelta(minutes=-5) or age > dt.timedelta(hours=30):
            problems["backup:stale"] = "Last verified backup older than 30 hours"
    except (OSError, ValueError, OverflowError):
        problems["backup:stale"] = "Verified backup missing or unreadable"


def check_http_errors(problems: dict[str, str], now: dt.datetime) -> None:
    cutoff = now.timestamp() - 300
    hits = 0
    parsed_current = 0
    try:
        for path in (ACCESS_LOG, Path(str(ACCESS_LOG) + ".1")):
            if not path.is_file():
                continue
            # Inspect only the tail; never put IPs, URIs or raw log lines in alerts.
            with path.open("rb") as stream:
                stream.seek(0, os.SEEK_END)
                stream.seek(max(0, stream.tell() - 512 * 1024))
                if stream.tell():
                    stream.readline()
                for line in stream:
                    match = _ACCESS_LINE.search(line)
                    if match:
                        if path == ACCESS_LOG:
                            parsed_current += 1
                        if match.group(1).startswith(b"5") and float(match.group(2)) >= cutoff:
                            hits += 1
        if not ACCESS_LOG.is_file():
            problems["nginx:logs"] = "Nginx access log missing"
        elif parsed_current == 0 and ACCESS_LOG.stat().st_size > 0:
            problems["nginx:logs"] = "Nginx log format missing timestamp; cannot count 5xx"
        elif hits >= 3:
            problems["nginx:5xx"] = f"Nginx reported {hits} HTTP 5xx responses in 5 minutes"
    except OSError:
        problems["nginx:logs"] = "Nginx access log unreadable"


def webhook_url() -> str | None:
    try:
        info = CONFIG.lstat()
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o077:
        raise ValueError("monitor.env must be root-owned, regular and mode 0600")
    lines = [line for line in CONFIG.read_text().splitlines() if line and not line.startswith("#")]
    if len(lines) != 1 or not lines[0].startswith("MONITOR_WEBHOOK_URL="):
        raise ValueError("monitor.env must contain one MONITOR_WEBHOOK_URL")
    url = lines[0].split("=", 1)[1]
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError("monitor webhook must be an HTTPS URL without embedded userinfo or fragment")
    return url


def send_alert(url: str, message: str) -> bool:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, msg, headers, newurl):
            return None

    payload = json.dumps({"text": message}, ensure_ascii=False).encode()
    request = urllib.request.Request(
        url, data=payload, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=8) as response:
            return 200 <= response.status < 300
    except (OSError, ValueError):
        # Do not log the exception: its string may contain a secret webhook URL.
        return False


def main() -> int:
    if os.geteuid() != 0:
        print("Monitor requires root", file=sys.stderr)
        return 1
    if sys.argv[1:] == ["--self-test-alert"]:
        try:
            url = webhook_url()
        except (OSError, ValueError):
            url = None
        if not url:
            print("Valid private alert webhook required for self-test", file=sys.stderr)
            return 1
        if not send_alert(url, "Hamidian VPS monitoring test (no production state changed)"):
            print("Alert webhook delivery failed (URL hidden)", file=sys.stderr)
            return 1
        print("Test alert delivered")
        return 0
    if len(sys.argv) != 1:
        print("Unknown monitor option", file=sys.stderr)
        return 1
    with open("/run/lock/hamidian-silver-monitor.lock", "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        now = dt.datetime.now(dt.timezone.utc)
        problems: dict[str, str] = {}
        check_http(problems)
        check_containers(problems)
        check_disks(problems)
        check_backup(problems, now)
        check_http_errors(problems, now)
        try:
            url = webhook_url()
        except (OSError, ValueError):
            url = None
            problems["alerts:config"] = "Alert webhook config invalid"

        try:
            if STATE.is_symlink():
                raise ValueError("state symlink")
            previous = json.loads(STATE.read_text())
        except (OSError, ValueError):
            previous = {"problems": [], "sent_at": 0}
        if not isinstance(previous, dict) or not isinstance(previous.get("problems"), list):
            previous = {"problems": [], "sent_at": 0}
        if STATE.is_symlink() or not STATE.parent.is_dir():
            print("Monitor state storage unsafe or unavailable", file=sys.stderr)
            return 1
        keys = sorted(problems)
        old = previous.get("problems", [])
        change = keys != old
        sent_at = previous.get("sent_at", 0)
        repeated = bool(keys) and (
            not isinstance(sent_at, (int, float)) or now.timestamp() - sent_at > 1800
        )
        if change or repeated:
            message = (
                "Hamidian VPS alert: " + "; ".join(problems[k] for k in keys)
                if keys else "Hamidian VPS recovery: all checks healthy"
            )
            print(message)
            if url and not send_alert(url, message):
                print("Alert webhook delivery failed (URL hidden)", file=sys.stderr)
                return 1
            if url is None and keys:
                print("External alerts disabled: configure private monitor.env", file=sys.stderr)
            tmp_name = None
            try:
                with tempfile.NamedTemporaryFile(mode="w", dir=STATE.parent, prefix=".monitor-", delete=False) as stream:
                    tmp_name = stream.name
                    os.fchmod(stream.fileno(), 0o600)
                    json.dump({"problems": keys, "sent_at": now.timestamp()}, stream)
                os.replace(tmp_name, STATE)
            finally:
                if tmp_name and os.path.exists(tmp_name):
                    os.unlink(tmp_name)
        return 1 if keys else 0


if __name__ == "__main__":
    raise SystemExit(main())
