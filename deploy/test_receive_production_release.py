"""Local, filesystem-isolated checks: never touch the real VPS release tree."""

import importlib.util
import io
import tarfile
import tempfile
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    'receive_production_release', Path(__file__).with_name('receive-production-release.py')
)
assert spec and spec.loader
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)


def archive(entries):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w') as output:
        for name, kind in entries:
            info = tarfile.TarInfo(name)
            if kind == 'file':
                contents = b'example'
                info.size = len(contents)
                output.addfile(info, io.BytesIO(contents))
            else:
                info.type = tarfile.SYMTYPE
                info.linkname = 'elsewhere'
                output.addfile(info)
    buffer.seek(0)
    return buffer


class ProductionReceiveTests(unittest.TestCase):
    def check_archive(self, entries, valid):
        with tempfile.TemporaryDirectory() as directory:
            stage = Path(directory)
            if valid:
                receiver.extract_archive(archive(entries), stage)
                self.assertTrue((stage / 'compose.production.yaml').is_file())
            else:
                with self.assertRaises(SystemExit):
                    receiver.extract_archive(archive(entries), stage)
                self.assertFalse((stage / 'deploy' / 'symlink').is_symlink())

    def test_valid_git_archive_is_accepted(self):
        self.check_archive([('compose.production.yaml', 'file'), ('deploy/check-production-media.sh', 'file')], True)

    def test_path_traversal_is_rejected(self):
        self.check_archive([('../escaped', 'file')], False)

    def test_symlink_is_rejected(self):
        self.check_archive([('compose.production.yaml', 'file'), ('deploy/check-production-media.sh', 'file'), ('deploy/symlink', 'link')], False)


if __name__ == '__main__':
    unittest.main()
