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
        'ADMIN_APP_ORIGIN': 'https://admin.staging.hamidian.shop',
        'TELEGRAM_BOT_TOKEN': '',
        'TELEGRAM_RELAY_URL': '',
        'TELEGRAM_RELAY_SECRET': '',
        'BALE_BOT_TOKEN': '',
        'ADMIN_MESSAGING_REQUEST_TIMEOUT_MS': '8000',
        'SMS_PROVIDER': 'disabled',
        'PAYMENT_PROVIDER': 'disabled',
        'IRANDARGAH_SANDBOX': 'true',
        'IRANDARGAH_REQUEST_TIMEOUT_MS': '8000',
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
            'IRANDARGAH_SANDBOX': 'false',
            'PAYMENT_CALLBACK_URL': 'https://hamidian.shop/api/payment/callback',
            'IRANDARGAH_API_TOKEN': 'idg_live_' + 'a' * 32,
        })
        result = ' '.join(checker.validate(values))
        for name in ('IRANDARGAH_SANDBOX', 'PAYMENT_CALLBACK_URL', 'IRANDARGAH_API_TOKEN'):
            self.assertIn(name, result)

    def test_console_sms_is_rejected(self):
        values = fixture()
        values['SMS_PROVIDER'] = 'console'
        self.assertIn('SMS_PROVIDER', ' '.join(checker.validate(values)))

    def test_telegram_relay_requires_a_safe_url_and_matching_secret(self):
        values = fixture()
        values['TELEGRAM_RELAY_URL'] = 'https://hamidian-telegram-relay.vercel.app/api/telegram/send'
        self.assertIn('TELEGRAM_RELAY_SECRET', ' '.join(checker.validate(values)))

        values['TELEGRAM_RELAY_SECRET'] = 'r' * 64
        self.assertEqual(checker.validate(values), [])

    def test_kavenegar_requires_all_order_templates(self):
        values = fixture()
        values.update({
            'SMS_PROVIDER': 'kavenegar',
            'KAVENEGAR_API_KEY': 'kavenegar-test-api-key',
            'KAVENEGAR_OTP_TEMPLATE': 'hamidianotp',
        })
        result = ' '.join(checker.validate(values))
        self.assertIn('KAVENEGAR_PAYMENT_VERIFIED_TEMPLATE', result)

        values.update({key: 'approved-template' for key in checker.shared.KAVENEGAR_ORDER_TEMPLATE_KEYS})
        self.assertEqual(checker.validate(values), [])

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
