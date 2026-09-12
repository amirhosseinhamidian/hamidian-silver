#!/usr/bin/env python3
"""Validate the separate, one-shot operational seed values without printing PII."""

from __future__ import annotations

import importlib.util
import os
import re
import sys
from pathlib import Path

BOOTSTRAP = '/etc/hamidian-silver/production-bootstrap.env'
REQUIRED = frozenset({'OPERATIONAL_ADMIN_PHONE', 'OPERATIONAL_CONTACT_ADDRESS', 'OPERATIONAL_CONTACT_PHONES'})

spec = importlib.util.spec_from_file_location(
    'validate_production_env', Path(__file__).with_name('validate-production-env.py')
)
assert spec and spec.loader
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


def validate(contents: str) -> list[str]:
    values: dict[str, str] = {}
    errors: list[str] = []
    for line in contents.splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        if '=' not in line:
            errors.append('Malformed bootstrap line')
            continue
        name, value = line.split('=', 1)
        if name not in REQUIRED or name in values or value != value.strip() or any(
            character in value for character in ('$', '\\', '"', "'", '#', '\r', '\t')
        ):
            errors.append('Unknown, duplicate or unsafe bootstrap field')
        else:
            values[name] = value

    if not re.fullmatch(r'09[0-9]{9}', values.get('OPERATIONAL_ADMIN_PHONE', '')):
        errors.append('OPERATIONAL_ADMIN_PHONE must be an Iranian mobile under operator control')
    address = values.get('OPERATIONAL_CONTACT_ADDRESS', '')
    if not 8 <= len(address) <= 300 or any(c in address for c in ('<', '>')):
        errors.append('OPERATIONAL_CONTACT_ADDRESS must be a reviewed public address')
    phones = values.get('OPERATIONAL_CONTACT_PHONES', '')
    if not re.fullmatch(r'0[0-9]{9,10}(,0[0-9]{9,10})*', phones):
        errors.append('OPERATIONAL_CONTACT_PHONES must list reviewed Iranian contact numbers')
    return errors


def main() -> int:
    if os.geteuid() != 0 or len(sys.argv) != 1:
        print('Production bootstrap validation requires root and no arguments', file=sys.stderr)
        return 1
    try:
        contents = shared.read_private_env(BOOTSTRAP)
        errors = validate(contents)
    except (OSError, ValueError, UnicodeError) as error:
        print(f'Production bootstrap env is unreadable or unsafe: {type(error).__name__}', file=sys.stderr)
        return 1
    for error in errors:
        print(f'Production bootstrap env: {error}', file=sys.stderr)
    if errors:
        return 1
    print('Production operational seed fields: OK (content must still be reviewed by the owner)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
