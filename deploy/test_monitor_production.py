"""Unit checks for VPS-008; no Docker, network or VPS paths are modified."""

import datetime as dt
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


source = Path(__file__).with_name("monitor-production.py")
spec = importlib.util.spec_from_file_location("monitor_production", source)
assert spec and spec.loader
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class ProductionMonitorTests(unittest.TestCase):
    def test_recent_5xx_are_counted_without_exposing_request_uri(self):
        now = dt.datetime.now(dt.timezone.utc)
        stamp = now.timestamp()
        with tempfile.TemporaryDirectory() as directory:
            access = Path(directory) / "hamidian-silver-access.log"
            access.write_text(
                "".join(
                    f'127.0.0.1 [12/Sep/2026:12:00:00 +0000] "GET /sensitive/path HTTP/1.1" 502 0 {stamp:.3f}\n'
                    for _ in range(3)
                )
            )
            with patch.object(monitor, "ACCESS_LOG", access):
                problems = {}
                monitor.check_http_errors(problems, now)
            self.assertIn("nginx:5xx", problems)
            self.assertNotIn("/sensitive/path", str(problems))

    def test_no_valid_5xx_format_raises_monitoring_alert(self):
        with tempfile.TemporaryDirectory() as directory:
            access = Path(directory) / "hamidian-silver-access.log"
            access.write_text('127.0.0.1 "GET / HTTP/1.1" 500 0\n')
            with patch.object(monitor, "ACCESS_LOG", access):
                problems = {}
                monitor.check_http_errors(problems, dt.datetime.now(dt.timezone.utc))
            self.assertIn("nginx:logs", problems)

    def test_successful_requests_confirm_format_without_error_alert(self):
        now = dt.datetime.now(dt.timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            access = Path(directory) / "hamidian-silver-access.log"
            access.write_text(
                f'127.0.0.1 [12/Sep/2026:12:00:00 +0000] "GET /api/health HTTP/1.1" 200 2 {now.timestamp():.3f}\n'
            )
            with patch.object(monitor, "ACCESS_LOG", access):
                problems = {}
                monitor.check_http_errors(problems, now)
            self.assertEqual(problems, {})

    def test_backup_result_and_age_are_independently_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            backup = Path(directory) / "backup-20260912T030000Z"
            backup.mkdir()
            (backup / ".complete").touch()
            now = dt.datetime.now(dt.timezone.utc)
            (backup / "verified-at-utc").write_text(now.isoformat())
            with patch.object(monitor, "BACKUPS", Path(directory)), patch.object(
                monitor, "command", return_value="exit-code"
            ):
                problems = {}
                monitor.check_backup(problems, now)
            self.assertIn("backup:job", problems)
            self.assertNotIn("backup:stale", problems)


if __name__ == "__main__":
    unittest.main()
