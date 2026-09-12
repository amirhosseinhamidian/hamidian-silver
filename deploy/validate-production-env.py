#!/usr/bin/env python3
"""Validate the root-owned Compose env file without ever printing secret values.

Run on the VPS: sudo python3 deploy/validate-production-env.py
This deliberately accepts only the simple KEY=VALUE subset used by our template.
"""

import hmac
import os
import re
import stat
import sys
from urllib.parse import parse_qs, unquote, urlsplit


ENV_PATH = "/etc/hamidian-silver/production.env"
ALLOWED_KEYS = frozenset(
    {
        "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD", "DATABASE_URL", "OTP_PEPPER",
        "MEDIA_PUBLIC_BASE_URL", "CORS_ORIGINS", "PAYMENT_CALLBACK_URL",
        "SMS_PROVIDER", "KAVENEGAR_API_KEY", "KAVENEGAR_OTP_TEMPLATE", "KAVENEGAR_SENDER",
        "PAYMENT_PROVIDER", "ZARINPAL_SANDBOX", "ZARINPAL_MERCHANT_ID",
        "ZIBAL_MERCHANT_ID", "MELLAT_TERMINAL_ID", "MELLAT_USERNAME", "MELLAT_PASSWORD",
        "SHIPPING_PROVIDER", "MANUAL_SHIPPING_COST_TOMAN",
        "NEXT_PUBLIC_GA_MEASUREMENT_ID", "GOOGLE_SITE_VERIFICATION",
    }
)
NAME_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")
DB_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
GUID_RE = re.compile(r"^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$")


def parse_env(contents: str) -> tuple[dict[str, str], list[str]]:
    values: dict[str, str] = {}
    errors: list[str] = []
    for number, line in enumerate(contents.splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        if "=" not in line:
            errors.append(f"Line {number}: expected KEY=VALUE")
            continue
        name, value = line.split("=", 1)
        if not NAME_RE.fullmatch(name) or name not in ALLOWED_KEYS:
            errors.append(f"Line {number}: unknown or malformed key")
        elif name in values:
            errors.append(f"Line {number}: duplicate key {name}")
        elif (
            value != value.strip()
            or value.startswith(("'", '"'))
            or not value.isascii()
            or any(character in value for character in ("$", "\\", "\r", "\t"))
        ):
            errors.append(f"Line {number}: {name} must be an unquoted literal without interpolation")
        else:
            values[name] = value
    return values, errors


def validate(values: dict[str, str]) -> list[str]:
    errors: list[str] = []
    for key in ("POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD", "DATABASE_URL", "OTP_PEPPER"):
        if not values.get(key):
            errors.append(f"{key} is required")

    for key in ("POSTGRES_DB", "POSTGRES_USER"):
        if values.get(key) and not DB_NAME_RE.fullmatch(values[key]):
            errors.append(f"{key} must be a simple database identifier")

    for key in ("POSTGRES_PASSWORD", "OTP_PEPPER"):
        if key in values and len(values[key]) < 32:
            errors.append(f"{key} must have at least 32 characters")
    if values.get("POSTGRES_PASSWORD") and values.get("OTP_PEPPER") and hmac.compare_digest(
        values["POSTGRES_PASSWORD"], values["OTP_PEPPER"]
    ):
        errors.append("OTP_PEPPER must be independent from POSTGRES_PASSWORD")

    if values.get("DATABASE_URL"):
        try:
            url = urlsplit(values["DATABASE_URL"])
            valid = (
                url.scheme == "postgresql"
                and url.hostname == "postgres"
                and url.port == 5432
                and unquote(url.username or "") == values.get("POSTGRES_USER")
                and unquote(url.password or "") == values.get("POSTGRES_PASSWORD")
                and url.path == "/" + values.get("POSTGRES_DB", "")
                and parse_qs(url.query) == {"schema": ["public"]}
                and not url.fragment
            )
        except ValueError:
            valid = False
        if not valid:
            errors.append("DATABASE_URL must use matching credentials and postgres:5432/... ?schema=public")

    fixed = {
        "MEDIA_PUBLIC_BASE_URL": "https://media.hamidian.shop/media",
        "CORS_ORIGINS": "https://hamidian.shop,https://admin.hamidian.shop",
        "PAYMENT_CALLBACK_URL": "https://hamidian.shop/api/payment/callback",
    }
    for key, expected in fixed.items():
        if values.get(key) != expected:
            errors.append(f"{key} must match the production domain configuration")

    if values.get("SHIPPING_PROVIDER") != "disabled":
        errors.append("SHIPPING_PROVIDER must be disabled while Postex is off")
    shipping_cost = values.get("MANUAL_SHIPPING_COST_TOMAN", "")
    if not shipping_cost.isascii() or not shipping_cost.isdigit() or int(shipping_cost or "0") > 2_147_483_647:
        errors.append("MANUAL_SHIPPING_COST_TOMAN must be an unsigned amount in toman")

    sms = values.get("SMS_PROVIDER")
    if sms not in ("disabled", "kavenegar"):
        errors.append("SMS_PROVIDER must be disabled or kavenegar (never console in production)")
    if sms == "kavenegar" and (
        len(values.get("KAVENEGAR_API_KEY", "")) < 10
        or not values.get("KAVENEGAR_OTP_TEMPLATE")
    ):
        errors.append("KAVENEGAR_API_KEY and KAVENEGAR_OTP_TEMPLATE are required for kavenegar")

    # PAYMENT_PROVIDER is a legacy flag; availability is set in Admin/DB.
    if values.get("PAYMENT_PROVIDER") != "disabled":
        errors.append("PAYMENT_PROVIDER must remain disabled; enable one gateway through Admin/DB")
    if values.get("ZARINPAL_SANDBOX") not in ("true", "false"):
        errors.append("ZARINPAL_SANDBOX must be true or false")
    if values.get("ZARINPAL_MERCHANT_ID") and not GUID_RE.fullmatch(values["ZARINPAL_MERCHANT_ID"]):
        errors.append("ZARINPAL_MERCHANT_ID must be a UUID")
    mellat = tuple(values.get(key, "") for key in ("MELLAT_TERMINAL_ID", "MELLAT_USERNAME", "MELLAT_PASSWORD"))
    if any(mellat) and (not all(mellat) or not mellat[0].isdigit()):
        errors.append("MELLAT_TERMINAL_ID, MELLAT_USERNAME, MELLAT_PASSWORD must be complete")
    configured = sum(bool(part) for part in (values.get("ZARINPAL_MERCHANT_ID"), values.get("ZIBAL_MERCHANT_ID"), mellat[0]))
    if configured > 1:
        errors.append("Configure credentials for only one payment gateway initially")
    return errors


def read_private_env(path: str) -> str:
    directory = os.stat(os.path.dirname(os.path.abspath(path)), follow_symlinks=False)
    if not stat.S_ISDIR(directory.st_mode) or directory.st_uid != 0 or stat.S_IMODE(directory.st_mode) != 0o700:
        raise ValueError("Env directory must be root-owned with mode 0700")
    # O_NOFOLLOW rejects symlinks; fstat verifies the opened inode, avoiding a TOCTOU check.
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0 or stat.S_IMODE(metadata.st_mode) != 0o600:
            raise ValueError("Env file must be a regular, root-owned file with mode 0600")
        if metadata.st_size > 64 * 1024:
            raise ValueError("Env file is unexpectedly large")
        return os.read(descriptor, 64 * 1024 + 1).decode("utf-8")
    finally:
        os.close(descriptor)


if __name__ == "__main__":
    try:
        raw = read_private_env(sys.argv[1] if len(sys.argv) == 2 else ENV_PATH)
        env, parse_errors = parse_env(raw)
        problems = parse_errors + validate(env)
    except (OSError, ValueError, UnicodeError) as error:
        # Never include file contents, exception repr or a connection URL in stderr.
        print(f"Production env check failed: {type(error).__name__}", file=sys.stderr)
        sys.exit(1)
    for problem in problems:
        print(f"Production env check failed: {problem}", file=sys.stderr)
    if problems:
        sys.exit(1)
    print("Production env structure and permissions: OK (service health not checked)")
