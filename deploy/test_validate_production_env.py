import importlib.util
import unittest
from pathlib import Path
from urllib.parse import quote


SCRIPT_PATH = Path(__file__).with_name("validate-production-env.py")
SPEC = importlib.util.spec_from_file_location("validate_production_env", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


class ProductionEnvValidationTests(unittest.TestCase):
    def fixture(self):
        password = "pass/word#" + "a" * 32
        return {
            "POSTGRES_DB": "hamidian_silver",
            "POSTGRES_USER": "hamidian",
            "POSTGRES_PASSWORD": password,
            "DATABASE_URL": "postgresql://hamidian:" + quote(password, safe="") + "@postgres:5432/hamidian_silver?schema=public",
            "OTP_PEPPER": "b" * 64,
            "MEDIA_PUBLIC_BASE_URL": "https://media.hamidian.shop/media",
            "CORS_ORIGINS": "https://hamidian.shop,https://admin.hamidian.shop",
            "PAYMENT_CALLBACK_URL": "https://hamidian.shop/api/payment/callback",
            "ADMIN_APP_ORIGIN": "https://admin.hamidian.shop",
            "TELEGRAM_BOT_TOKEN": "",
            "TELEGRAM_RELAY_URL": "",
            "TELEGRAM_RELAY_SECRET": "",
            "BALE_BOT_TOKEN": "",
            "ADMIN_MESSAGING_REQUEST_TIMEOUT_MS": "8000",
            "SHIPPING_PROVIDER": "disabled",
            "MANUAL_SHIPPING_COST_TOMAN": "0",
            "SMS_PROVIDER": "disabled",
            "PAYMENT_PROVIDER": "disabled",
            "IRANDARGAH_API_TOKEN": "idg_live_" + "a" * 32,
            "IRANDARGAH_SANDBOX": "false",
            "IRANDARGAH_REQUEST_TIMEOUT_MS": "8000",
        }

    def test_valid_encoded_password_is_not_reported(self):
        self.assertEqual(checker.validate(self.fixture()), [])

    def test_mismatched_password_and_public_urls_fail_without_value_leak(self):
        env = self.fixture()
        env["DATABASE_URL"] = env["DATABASE_URL"].replace("postgres:5432", "localhost:5432")
        env["PAYMENT_CALLBACK_URL"] = "http://localhost/api/payment/callback"
        result = " ".join(checker.validate(env))
        self.assertIn("DATABASE_URL", result)
        self.assertIn("PAYMENT_CALLBACK_URL", result)
        self.assertNotIn(env["POSTGRES_PASSWORD"], result)

    def test_rejects_console_and_partially_configured_sms(self):
        env = self.fixture()
        env["SMS_PROVIDER"] = "console"
        self.assertTrue(any("SMS_PROVIDER" in error for error in checker.validate(env)))
        env["SMS_PROVIDER"] = "kavenegar"
        self.assertTrue(any("KAVENEGAR_API_KEY" in error for error in checker.validate(env)))

    def test_accepts_kavenegar_with_all_order_templates(self):
        env = self.fixture()
        env.update({
            "SMS_PROVIDER": "kavenegar",
            "KAVENEGAR_API_KEY": "kavenegar-test-api-key",
            "KAVENEGAR_OTP_TEMPLATE": "hamidianotp",
        })
        env.update({key: "approved-template" for key in checker.KAVENEGAR_ORDER_TEMPLATE_KEYS})
        self.assertEqual(checker.validate(env), [])

    def test_rejects_missing_or_malformed_order_template(self):
        env = self.fixture()
        env.update({
            "SMS_PROVIDER": "kavenegar",
            "KAVENEGAR_API_KEY": "kavenegar-test-api-key",
            "KAVENEGAR_OTP_TEMPLATE": "hamidianotp",
        })
        env.update({key: "approved-template" for key in checker.KAVENEGAR_ORDER_TEMPLATE_KEYS})
        env["KAVENEGAR_ORDER_SHIPPED_TEMPLATE"] = "invalid_template"
        result = " ".join(checker.validate(env))
        self.assertIn("KAVENEGAR_ORDER_SHIPPED_TEMPLATE", result)

    def test_validates_optional_search_console_and_ga4_values(self):
        env = self.fixture()
        env["NEXT_PUBLIC_GA_MEASUREMENT_ID"] = "G-ABC123XYZ"
        env["GOOGLE_SITE_VERIFICATION"] = "abc_DEF-123.example="
        self.assertEqual(checker.validate(env), [])

        env["NEXT_PUBLIC_GA_MEASUREMENT_ID"] = "UA-12345-1"
        env["GOOGLE_SITE_VERIFICATION"] = "<script>"
        result = " ".join(checker.validate(env))
        self.assertIn("NEXT_PUBLIC_GA_MEASUREMENT_ID", result)
        self.assertIn("GOOGLE_SITE_VERIFICATION", result)

    def test_rejects_multiple_gateway_credentials_and_postex(self):
        env = self.fixture()
        env["MELLAT_TERMINAL_ID"] = "123"
        env["MELLAT_USERNAME"] = "username"
        env["MELLAT_PASSWORD"] = "credential"
        env["SHIPPING_PROVIDER"] = "postex"
        result = " ".join(checker.validate(env))
        self.assertIn("one payment gateway", result)
        self.assertIn("SHIPPING_PROVIDER", result)

    def test_accepts_complete_telegram_relay_and_rejects_unsafe_or_partial_configuration(self):
        env = self.fixture()
        env["TELEGRAM_RELAY_URL"] = "https://hamidian-telegram-relay.vercel.app/api/telegram/send"
        env["TELEGRAM_RELAY_SECRET"] = "r" * 64
        self.assertEqual(checker.validate(env), [])

        env["TELEGRAM_RELAY_URL"] = "http://127.0.0.1:8081/api/telegram/send"
        self.assertIn("TELEGRAM_RELAY_URL", " ".join(checker.validate(env)))

        env["TELEGRAM_RELAY_URL"] = "https://hamidian-telegram-relay.vercel.app/api/telegram/send"
        env["TELEGRAM_RELAY_SECRET"] = ""
        result = " ".join(checker.validate(env))
        self.assertIn("TELEGRAM_RELAY_URL", result)
        self.assertIn("TELEGRAM_RELAY_SECRET", result)

    def test_refuses_compose_interpolation_duplicate_and_unknown_keys(self):
        values, errors = checker.parse_env(
            "POSTGRES_PASSWORD=first\nPOSTGRES_PASSWORD=second\n"
            "OTP_PEPPER=${DONT_EXPAND}\nUNKNOWN_SECRETS=value\n"
        )
        self.assertEqual(values["POSTGRES_PASSWORD"], "first")
        self.assertNotIn("OTP_PEPPER", values)
        self.assertEqual(len(errors), 3)
        self.assertNotIn("second", " ".join(errors))


if __name__ == "__main__":
    unittest.main()
