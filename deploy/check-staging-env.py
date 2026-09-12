#!/usr/bin/env python3
"""Fail closed before touching Docker; diagnostics never contain credential values."""

from __future__ import annotations

import hmac
import importlib.util
import os
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

STAGING = '/etc/hamidian-silver/staging.env'
PRODUCTION = '/etc/hamidian-silver/production.env'
BOOTSTRAP = '/etc/hamidian-silver/staging-bootstrap.env'

spec = importlib.util.spec_from_file_location(
    'validate_production_env', Path(__file__).with_name('validate-production-env.py')
)
assert spec and spec.loader
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


def validate(values: dict[str, str], production: dict[str, str] | None = None) -> list[str]:
    errors: list[str] = []
    for name in ('POSTGRES_PASSWORD', 'OTP_PEPPER'):
        if len(values.get(name, '')) < 32:
            errors.append(f'{name} must be at least 32 characters')
        if production and values.get(name) and production.get(name) and hmac.compare_digest(
            values[name], production[name]
        ):
            errors.append(f'{name} must differ from production')
    if values.get('POSTGRES_PASSWORD') and values.get('OTP_PEPPER') and hmac.compare_digest(
        values['POSTGRES_PASSWORD'], values['OTP_PEPPER']
    ):
        errors.append('Staging database password and OTP pepper must be independent')

    for name in ('POSTGRES_DB', 'POSTGRES_USER'):
        if values.get(name) != 'hamidian_staging':
            errors.append(f'{name} must be hamidian_staging')
    try:
        db = urlsplit(values.get('DATABASE_URL', ''))
        valid_db = (
            db.scheme == 'postgresql'
            and db.hostname == 'postgres'
            and db.port == 5432
            and unquote(db.username or '') == 'hamidian_staging'
            and unquote(db.password or '') == values.get('POSTGRES_PASSWORD')
            and db.path == '/hamidian_staging'
            and parse_qs(db.query) == {'schema': ['public']}
            and not db.fragment
        )
    except ValueError:
        valid_db = False
    if not valid_db:
        errors.append('DATABASE_URL must target only staging postgres:5432/hamidian_staging')

    fixed = {
        'MEDIA_PUBLIC_BASE_URL': 'https://media.staging.hamidian.shop/media',
        'CORS_ORIGINS': 'https://staging.hamidian.shop,https://admin.staging.hamidian.shop',
        'PAYMENT_CALLBACK_URL': 'https://staging.hamidian.shop/api/payment/callback',
        'PAYMENT_PROVIDER': 'disabled',
        'ZARINPAL_SANDBOX': 'true',
        'SHIPPING_PROVIDER': 'disabled',
        'NEXT_PUBLIC_GA_MEASUREMENT_ID': '',
        'GOOGLE_SITE_VERIFICATION': '',
    }
    for name, expected in fixed.items():
        if values.get(name) != expected:
            errors.append(f'{name} must match staging-only configuration')
    sms = values.get('SMS_PROVIDER')
    if sms not in ('disabled', 'kavenegar'):
        errors.append('SMS_PROVIDER must be disabled or kavenegar (never console)')
    if sms == 'kavenegar' and (
        len(values.get('KAVENEGAR_API_KEY', '')) < 10
        or not values.get('KAVENEGAR_OTP_TEMPLATE')
    ):
        errors.append('Kavenegar test SMS requires API key and OTP template')
    shipping = values.get('MANUAL_SHIPPING_COST_TOMAN', '')
    if not shipping.isascii() or not shipping.isdigit() or int(shipping or '0') > 2_147_483_647:
        errors.append('MANUAL_SHIPPING_COST_TOMAN must be unsigned and within range')
    merchant = values.get('ZARINPAL_MERCHANT_ID', '')
    if merchant and not shared.GUID_RE.fullmatch(merchant):
        errors.append('ZARINPAL_MERCHANT_ID must be a UUID')
    for name in ('ZIBAL_MERCHANT_ID', 'MELLAT_TERMINAL_ID', 'MELLAT_USERNAME', 'MELLAT_PASSWORD'):
        if values.get(name):
            errors.append(f'{name} is forbidden in staging; use only Zarinpal sandbox')
    return errors


def validate_bootstrap(contents: str) -> list[str]:
    required = {'OPERATIONAL_ADMIN_PHONE', 'OPERATIONAL_CONTACT_ADDRESS', 'OPERATIONAL_CONTACT_PHONES'}
    values: dict[str, str] = {}
    errors: list[str] = []
    for line in contents.splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        if '=' not in line:
            errors.append('Bootstrap file has a malformed line')
            continue
        name, value = line.split('=', 1)
        if name not in required or name in values or value != value.strip() or any(
            c in value for c in ('$', '\\', '"', "'", '#', '\r', '\t')
        ):
            errors.append('Bootstrap file has an unknown, repeated or unsafe field')
        else:
            values[name] = value
    if not re.fullmatch(r'09[0-9]{9}', values.get('OPERATIONAL_ADMIN_PHONE', '')):
        errors.append('OPERATIONAL_ADMIN_PHONE must be a controlled Iranian test mobile')
    if len(values.get('OPERATIONAL_CONTACT_ADDRESS', '')) < 5:
        errors.append('OPERATIONAL_CONTACT_ADDRESS must be staging-only placeholder text')
    if not re.fullmatch(r'09[0-9]{9}(,09[0-9]{9})*', values.get('OPERATIONAL_CONTACT_PHONES', '')):
        errors.append('OPERATIONAL_CONTACT_PHONES must contain test phone numbers')
    return errors


def main() -> int:
    if os.geteuid() != 0 or sys.argv[1:] not in ([], ['--bootstrap']):
        print('Staging validation requires root; only --bootstrap is accepted', file=sys.stderr)
        return 1
    try:
        values, errors = shared.parse_env(shared.read_private_env(STAGING))
        if Path(PRODUCTION).exists() or Path(PRODUCTION).is_symlink():
            production, production_errors = shared.parse_env(shared.read_private_env(PRODUCTION))
            if production_errors:
                raise ValueError('Production env could not be safely compared')
        else:
            production = None
        errors.extend(validate(values, production))
        if sys.argv[1:] == ['--bootstrap']:
            errors.extend(validate_bootstrap(shared.read_private_env(BOOTSTRAP)))
    except (OSError, UnicodeError, ValueError) as error:
        print(f'Staging env is missing, unreadable or unsafe: {type(error).__name__}', file=sys.stderr)
        return 1
    if errors:
        for error in errors:
            print(f'Staging env: {error}', file=sys.stderr)
        return 1
    print('Staging env and production separation: OK')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
