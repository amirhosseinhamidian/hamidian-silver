"""No connection to Docker, VPS, databases, or real secrets."""

import importlib.util
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    'check_staging_env', Path(__file__).with_name('check-staging-env.py')
)
assert spec and spec.loader
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


def fixture():
    secret = 'c' * 40
    return {
        'POSTGRES_DB': 'hamidian_staging',
        'POSTGRES_USER': 'hamidian_staging',
        'POSTGRES_PASSWORD': secret,
        'DATABASE_URL': f'postgresql://hamidian_staging:{secret}@postgres:5432/hamidian_staging?schema=public',
        'OTP_PEPPER': 'd' * 40,
        'MEDIA_PUBLIC_BASE_URL': 'https://media.staging.hamidian.shop/media',
        'CORS_ORIGINS': 'https://staging.hamidian.shop,https://admin.staging.hamidian.shop',
        'PAYMENT_CALLBACK_URL': 'https://staging.hamidian.shop/api/payment/callback',
        'SMS_PROVIDER': 'disabled',
        'PAYMENT_PROVIDER': 'disabled',
        'ZARINPAL_SANDBOX': 'true',
        'SHIPPING_PROVIDER': 'disabled',
        'MANUAL_SHIPPING_COST_TOMAN': '0',
        'NEXT_PUBLIC_GA_MEASUREMENT_ID': '',
        'GOOGLE_SITE_VERIFICATION': '',
    }


class StagingEnvTests(unittest.TestCase):
    def test_safe_staging_is_accepted(self):
        self.assertEqual(checker.validate(fixture()), [])

    def test_production_credentials_and_database_url_are_rejected_without_leaks(self):
        values = fixture()
        values['DATABASE_URL'] = values['DATABASE_URL'].replace('@postgres:', '@127.0.0.1:')
        result = ' '.join(checker.validate(values, {'POSTGRES_PASSWORD': values['POSTGRES_PASSWORD']}))
        self.assertIn('DATABASE_URL', result)
        self.assertIn('POSTGRES_PASSWORD', result)
        self.assertNotIn(values['POSTGRES_PASSWORD'], result)

    def test_live_payment_and_production_urls_are_rejected(self):
        values = fixture()
        values.update({
            'ZARINPAL_SANDBOX': 'false',
            'PAYMENT_CALLBACK_URL': 'https://hamidian.shop/api/payment/callback',
            'ZIBAL_MERCHANT_ID': 'live',
        })
        result = ' '.join(checker.validate(values))
        for name in ('ZARINPAL_SANDBOX', 'PAYMENT_CALLBACK_URL', 'ZIBAL_MERCHANT_ID'):
            self.assertIn(name, result)

    def test_console_sms_is_rejected(self):
        values = fixture()
        values['SMS_PROVIDER'] = 'console'
        self.assertIn('SMS_PROVIDER', ' '.join(checker.validate(values)))

    def test_bootstrap_rejects_unknown_or_injected_fields(self):
        result = checker.validate_bootstrap(
            'OPERATIONAL_ADMIN_PHONE=09123456789\n'
            'OPERATIONAL_CONTACT_ADDRESS=محیط آزمایشی\n'
            'OPERATIONAL_CONTACT_PHONES=09123456789\n'
            'OTHER_FIELD=$LIVE_SECRET\n'
        )
        self.assertTrue(result)
        self.assertNotIn('LIVE_SECRET', ' '.join(result))


if __name__ == '__main__':
    unittest.main()
