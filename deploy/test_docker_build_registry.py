"""Regression checks for production package-registry propagation."""

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCKERFILES = (
    ROOT / "apps/admin/Dockerfile",
    ROOT / "apps/api/Dockerfile",
    ROOT / "apps/storefront/Dockerfile",
)


class DockerBuildRegistryTests(unittest.TestCase):
    def test_registry_reaches_both_npm_and_pnpm(self):
        for dockerfile in DOCKERFILES:
            contents = dockerfile.read_text()
            with self.subTest(dockerfile=dockerfile):
                self.assertIn("ARG NPM_REGISTRY=https://registry.npmjs.org", contents)
                self.assertIn("npm_config_registry=$NPM_REGISTRY", contents)
                self.assertIn("PNPM_CONFIG_REGISTRY=$NPM_REGISTRY", contents)

    def test_every_production_node_build_receives_the_registry_argument(self):
        compose = (ROOT / "compose.production.yaml").read_text()
        self.assertEqual(
            compose.count(
                "NPM_REGISTRY: ${NPM_REGISTRY:-https://registry.npmjs.org}"
            ),
            5,
        )


if __name__ == "__main__":
    unittest.main()
