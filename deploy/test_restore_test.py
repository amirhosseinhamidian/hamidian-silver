"""Static regression checks for the isolated production restore rehearsal."""

import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("restore-test.sh").read_text()


class RestoreTestReadinessTests(unittest.TestCase):
    def test_waits_for_the_restore_database_instead_of_only_the_server(self):
        readiness_start = SCRIPT.index("ready=0")
        readiness_end = SCRIPT.index("(( ready ))", readiness_start)
        readiness = SCRIPT[readiness_start:readiness_end]

        self.assertIn("psql -X -q -U postgres -d restorecheck -c 'SELECT 1'", readiness)
        self.assertNotIn("pg_isready", readiness)

    def test_database_readiness_precedes_restore(self):
        self.assertLess(
            SCRIPT.index("psql -X -q -U postgres -d restorecheck -c 'SELECT 1'"),
            SCRIPT.index("pg_restore"),
        )


if __name__ == "__main__":
    unittest.main()
