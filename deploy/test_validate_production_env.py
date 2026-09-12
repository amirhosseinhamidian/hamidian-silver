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
            "SHIPPING_PROVIDER": "disabled",
            "MANUAL_SHIPPING_COST_TOMAN": "0",
            "SMS_PROVIDER": "disabled",
            "PAYMENT_PROVIDER": "disabled",
            "ZARINPAL_SANDBOX": "true",
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

    def test_rejects_multiple_gateway_credentials_and_postex(self):
        env = self.fixture()
        env["ZIBAL_MERCHANT_ID"] = "merchant"
        env["MELLAT_TERMINAL_ID"] = "123"
        env["MELLAT_USERNAME"] = "username"
        env["MELLAT_PASSWORD"] = "credential"
        env["SHIPPING_PROVIDER"] = "postex"
        result = " ".join(checker.validate(env))
        self.assertIn("one payment gateway", result)
        self.assertIn("SHIPPING_PROVIDER", result)

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
