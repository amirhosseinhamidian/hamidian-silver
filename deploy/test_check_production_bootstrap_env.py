import importlib.util
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    'check_production_bootstrap_env', Path(__file__).with_name('check-production-bootstrap-env.py')
)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProductionBootstrapValidationTests(unittest.TestCase):
    good = (
        'OPERATIONAL_ADMIN_PHONE=09123456789\n'
        'OPERATIONAL_CONTACT_ADDRESS=تهران، خیابان نمونه ۱۲\n'
        'OPERATIONAL_CONTACT_PHONES=02112345678,09123456789\n'
    )

    def test_accepts_only_required_reviewed_fields(self):
        self.assertEqual(module.validate(self.good), [])

    def test_disallows_demo_and_gateway_flags(self):
        self.assertTrue(module.validate(self.good + 'SEED_DEMO_CATALOG=true\n'))
        self.assertTrue(module.validate(self.good + 'OPERATIONAL_PAYMENT_GATEWAY=zarinpal\n'))

    def test_rejects_duplicate_and_interpolated_fields(self):
        self.assertTrue(module.validate(self.good + 'OPERATIONAL_ADMIN_PHONE=09123456789\n'))
        self.assertTrue(module.validate(self.good.replace('نمونه', '${SECRET}')))

    def test_requires_contact_and_controlled_admin_number(self):
        self.assertTrue(module.validate('OPERATIONAL_ADMIN_PHONE=not-a-phone\n'))


if __name__ == '__main__':
    unittest.main()
