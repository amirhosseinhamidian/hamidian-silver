import { auditPublicGuide } from '../src/lib/seo/guide-production-audit';

function requiredOrigin(): URL {
  const value = process.env.SEO_AUDIT_ORIGIN?.trim();
  if (!value) throw new Error('SEO_AUDIT_ORIGIN is required.');
  const origin = new URL(value);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/') {
    throw new Error('SEO_AUDIT_ORIGIN must be an HTTP(S) origin without a path.');
  }
  return new URL(origin.origin);
}

function requiredGuideFlag(): boolean {
  const value = process.env.SEO_AUDIT_REQUIRE_GUIDE?.trim().toLowerCase();
  if (!value) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('SEO_AUDIT_REQUIRE_GUIDE must be true or false.');
}

void auditPublicGuide({
  origin: requiredOrigin(),
  guidePath: process.env.SEO_AUDIT_GUIDE_PATH,
  requireGuide: requiredGuideFlag(),
})
  .then((result) => {
    result.checks.forEach((check) => console.log(`PASS ${check}`));
    result.notes.forEach((note) => console.warn(`NOTE ${note}`));
    console.log(`Guide SEO production audit passed for ${result.origin}.`);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
