# Operational data bootstrap

After bootstrap, use the Persian [Admin operations runbook](./admin-operations-runbook.fa.md) for
order, manual shipping, exceptional return, refund, settlement, and incident workflows.

`ADMIN-039A` prepares the minimum production data without adding demo products or committing
credentials. The operation is explicit, transactional, and safe to run again.

## Before running

1. Store production environment values outside Git.
2. Apply migrations with `prisma migrate deploy`.
3. Set `OPERATIONAL_ADMIN_PHONE`, `OPERATIONAL_CONTACT_ADDRESS`, and
   `OPERATIONAL_CONTACT_PHONES` to real values.
4. Keep `SHIPPING_PROVIDER=disabled`. Set `MANUAL_SHIPPING_COST_TOMAN=0` for free shipping or
   a non-negative integer for a fixed charge.
5. Keep `OPERATIONAL_PAYMENT_GATEWAY=disabled` until one provider's runtime credentials are
   ready. To activate one provider, set it to `zarinpal`, `zibal`, or `mellat`; the bootstrap
   refuses to enable a provider whose required credentials are missing.

Never put OTP pepper, SMS keys, gateway credentials, database credentials, or production contact
data in a committed env file.

## Run

```bash
pnpm exec prisma migrate deploy
pnpm db:seed:operations
```

The command performs these operations:

- synchronizes system roles, permissions, and the immutable Manager/User permission matrices;
- creates or reactivates the primary operator and grants the full-access `MANAGER` role;
- creates the configured default warehouse and removes the default flag from other warehouses;
- creates all known gateway-setting rows and enables at most the single selected gateway;
- writes real contact and site identity values to the singleton site settings;
- creates missing storefront content-page rows from the reviewed Persian fallbacks, without
  overwriting pages already edited in Admin;
- leaves demo catalog seeding disabled unless `SEED_DEMO_CATALOG=true` is separately supplied.

The fixed manual shipping charge is read by the API when an order is created. After payment and
preparation, the operator completes dispatch through the existing manual-shipment action and adds
the actual carrier/service and tracking information.

## Verify

Sign in with the configured admin mobile through the normal OTP flow, then verify in Admin that:

1. the primary operator has the Manager role and all intended permissions;
2. exactly zero or one payment gateway is enabled;
3. the main warehouse is active and is the only default warehouse;
4. contact details and content pages contain real reviewed values;
5. a test order shows the configured fixed shipping charge;
6. no `DEMO-*` products or demo warehouse were created.
