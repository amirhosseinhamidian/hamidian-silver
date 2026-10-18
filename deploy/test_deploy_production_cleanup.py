"""Static safety and ordering checks for production Docker cleanup."""

import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name('deploy-production.sh').read_text()


class ProductionDeployCleanupTests(unittest.TestCase):
    def test_cleanup_is_before_build_and_after_successful_retirement(self):
        pre = SCRIPT.index('cleanup_docker_space pre-build')
        build = SCRIPT.index('compose "$release" "$sha" build migrate api storefront admin')
        retired_images = SCRIPT.index("done < <(docker image ls --format '{{.Repository}}:{{.Tag}}')")
        post = SCRIPT.index('cleanup_docker_space post-deploy')

        self.assertLess(pre, build)
        self.assertLess(build, retired_images)
        self.assertLess(retired_images, post)

    def test_cleanup_reclaims_reproducible_cache_and_only_anonymous_volumes(self):
        start = SCRIPT.index('cleanup_docker_space() {')
        end = SCRIPT.index('\n}\n', start)
        cleanup = SCRIPT[start:end]

        self.assertIn('docker builder prune --all --force --keep-storage=1GB', cleanup)
        self.assertIn('docker image prune --force', cleanup)
        self.assertIn('docker volume prune --force', cleanup)
        self.assertNotIn('docker system prune', cleanup)
        self.assertNotIn('docker image prune --all', cleanup)
        self.assertNotIn('docker image prune -a', cleanup)
        self.assertNotIn('docker volume prune --all', cleanup)
        self.assertNotIn('docker volume prune -a', cleanup)


if __name__ == '__main__':
    unittest.main()
