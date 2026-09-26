import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TLS_SNIPPET = ROOT / "deploy/nginx/hamidian-silver-tls-snippet.conf"


class NginxSecurityHeadersTests(unittest.TestCase):
    def test_tls_snippet_contains_required_security_headers(self):
        config = TLS_SNIPPET.read_text(encoding="utf-8")

        required = [
            'Strict-Transport-Security "max-age=300" always;',
            'X-Content-Type-Options "nosniff" always;',
            'Referrer-Policy "strict-origin-when-cross-origin" always;',
            'X-Frame-Options "SAMEORIGIN" always;',
            'Content-Security-Policy "frame-ancestors \'self\';" always;',
            'Permissions-Policy "camera=(), microphone=(), geolocation=()" always;',
        ]

        for directive in required:
            with self.subTest(directive=directive):
                self.assertIn(directive, config)


if __name__ == "__main__":
    unittest.main()
