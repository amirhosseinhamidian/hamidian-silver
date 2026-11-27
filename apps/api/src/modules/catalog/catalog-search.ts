export function normalizeCatalogSearch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) % 16))
    .replace(/[\u0640\u064b-\u065f\u0670\u061c\u200e\u200f]/g, '')
    .replace(/[\u200c\u200d_\u2010-\u2015-]/g, ' ')
    .replaceAll('\0', '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
    .trimEnd();
}

const synonyms = [
  ['انگشتر', 'ring', 'rings'],
  ['گردنبند', 'necklace', 'necklaces'],
  ['دستبند', 'bracelet', 'bracelets'],
  ['گوشواره', 'earrings', 'earring'],
  ['زنجیر', 'chain', 'chains'],
  ['نیم ست', 'half set', 'نیمست'],
  ['نقره', 'silver'],
  ['ساعت', 'watch', 'watches'],
] as const;

const synonymsByTerm = new Map<string, (typeof synonyms)[number]>();
for (const group of synonyms) {
  for (const term of group) synonymsByTerm.set(term, group);
}
const aliasPattern = new RegExp(
  `(^| )(${[...synonymsByTerm.keys()].sort((left, right) => right.length - left.length).join('|')})(?= |$)`,
  'g',
);

function synonymForm(search: string, form: 0 | 1 | 2) {
  return search.replace(aliasPattern, (_match: string, prefix: string, term: string) => {
    const group = synonymsByTerm.get(term);
    return `${prefix}${group?.[form] ?? group?.[0] ?? term}`;
  });
}

export function catalogSearchTerms(search: string) {
  return [
    ...new Set([search, synonymForm(search, 0), synonymForm(search, 1), synonymForm(search, 2)]),
  ].filter((term) => term.length <= 120 && /[\p{L}\p{N}]/u.test(term));
}

const anonymousTerms = new Set([
  ...synonyms.flatMap(([canonical]) => canonical.split(' ')),
  '925',
  '950',
  '999',
]);

export function catalogSearchMetricTerm(search: string): string {
  const words = synonymForm(search, 0).split(' ');
  if (words.length > 3 || words.some((word) => !anonymousTerms.has(word))) return 'other';
  return [...new Set(words)].sort().join(' ');
}
