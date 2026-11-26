import { setTimeout as delay } from 'node:timers/promises';
import { parse, type DefaultTreeAdapterMap } from 'parse5';

const PAGE_PATH =
  /^\/(?:products|categories|brands|guide|campaigns)(?:\/[\p{L}\p{N}\p{M}_.~-]+)?\/?$/u;
export const AUDIT_LEGACY_REDIRECTS = [
  [
    '/products/products/athena-gold-silver-chain-45cm-model-2',
    '/products/athena-gold-silver-chain-45cm-model-2',
  ],
  [`/guide:${encodeURIComponent('دانستنی‌ها')}`, '/guide'],
] as const;
const STATIC_PATH = /^\/(?:about|contact|faq|privacy|services|size-guide|terms)\/?$/;
const PAGINATED_PATH = /^(?:\/products|\/(?:categories|brands|campaigns)\/[^/]+)$/;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

export function auditOrigin(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function auditPath(
  origin: string,
  href: string,
  base = origin,
  sitemap = false,
): string | null {
  if (href.length > 1500 || /[\\\u0000-\u001f]|%(?:2f|5c)/i.test(href)) return null;
  try {
    const url = new URL(href, base);
    if (url.origin !== origin || url.username || url.password) return null;
    if (sitemap && url.pathname === '/sitemap.xml' && !url.search) return url.pathname;
    const path = decodeURIComponent(url.pathname);
    const legacy = AUDIT_LEGACY_REDIRECTS.find(
      ([original]) => decodeURIComponent(original) === path,
    );
    if (legacy && !url.search) return legacy[0];
    if (path !== '/' && !PAGE_PATH.test(path) && !STATIC_PATH.test(path)) return null;
    if (
      url.search &&
      (!PAGINATED_PATH.test(path) || !/^\?(?:page=[1-9]\d{0,2}|sort=price-asc)$/.test(url.search))
    ) {
      return null;
    }
    return path.split('/').map(encodeURIComponent).join('/') + url.search;
  } catch {
    return null;
  }
}

export type AuditObservation = {
  status: number | null;
  finalPath: string;
  redirects: { status: number; to: string | null }[];
  failure: string | null;
  title: string | null;
  description: string | null;
  canonicals: string[];
  robots: string[];
  schema: string[];
  malformedSchema: boolean;
  links: string[];
  html: boolean;
};

export function emptyObservation(path: string): AuditObservation {
  return {
    status: null,
    finalPath: path,
    redirects: [],
    failure: null,
    title: null,
    description: null,
    canonicals: [],
    robots: [],
    schema: [],
    malformedSchema: false,
    links: [],
    html: false,
  };
}

type TreeNode = DefaultTreeAdapterMap['node'];
type TextNode = DefaultTreeAdapterMap['textNode'];

function nodeText(children: TreeNode[]): string {
  return children
    .filter((node): node is TextNode => 'value' in node)
    .map(({ value }) => value)
    .join('');
}

function schemaTypes(value: unknown, types: Set<string>, depth = 0): void {
  if (depth > 20 || !value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const entry of value) schemaTypes(entry, types, depth + 1);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === '@type') {
      for (const type of Array.isArray(entry) ? entry : [entry]) {
        if (typeof type === 'string' && types.size < 25) types.add(type.slice(0, 120));
      }
    } else {
      schemaTypes(entry, types, depth + 1);
    }
  }
}

export function readAuditHtml(origin: string, observation: AuditObservation, html: string) {
  const links = new Set<string>();
  const schema = new Set<string>();
  const base = new URL(observation.finalPath, origin).href;
  let linkBase = base;
  let hasBase = false;
  const contentLinks = new Set<string>();
  const surroundingLinks = new Set<string>();
  const stack = [{ node: parse(html) as TreeNode, inMain: false }];
  while (stack.length) {
    const entry = stack.pop();
    if (!entry) break;
    const { node } = entry;
    const inMain = entry.inMain || ('tagName' in node && node.tagName === 'main');
    if ('childNodes' in node) {
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        stack.push({ node: node.childNodes[i], inMain });
      }
    }
    if (!('tagName' in node) || node.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
    const attr = (name: string) => node.attrs.find((entry) => entry.name === name)?.value ?? '';
    const rel = attr('rel').toLowerCase().split(/\s+/);
    const href = attr('href').trim();
    if (node.tagName === 'base' && href && !hasBase) {
      hasBase = true;
      try {
        linkBase = new URL(href, base).href;
      } catch {
        /* Invalid base falls back to the document. */
      }
    }
    if (
      node.tagName === 'link' &&
      rel.includes('canonical') &&
      href &&
      observation.canonicals.length < 8
    ) {
      observation.canonicals.push(href.slice(0, 1500));
    }
    if (node.tagName === 'title' && !observation.title) {
      observation.title = nodeText(node.childNodes).trim().slice(0, 500) || null;
    }
    if (node.tagName === 'meta') {
      const name = attr('name').toLowerCase().trim();
      const content = attr('content').trim();
      if (name === 'description' && !observation.description)
        observation.description = content.slice(0, 1000) || null;
      if (['robots', 'googlebot'].includes(name) && content && observation.robots.length < 10) {
        observation.robots.push(
          name === 'robots' ? content.slice(0, 300) : `googlebot: ${content.slice(0, 280)}`,
        );
      }
    }
    const pending = inMain ? contentLinks : surroundingLinks;
    if (
      node.tagName === 'a' &&
      href &&
      !href.startsWith('#') &&
      !rel.includes('nofollow') &&
      pending.size < 200
    ) {
      pending.add(href);
    }
    if (
      node.tagName === 'script' &&
      attr('type').split(';')[0].trim().toLowerCase() === 'application/ld+json'
    ) {
      try {
        schemaTypes(JSON.parse(nodeText(node.childNodes)), schema);
      } catch {
        observation.malformedSchema = true;
      }
    }
  }
  for (const href of [...contentLinks, ...surroundingLinks]) {
    const path = auditPath(origin, href, linkBase);
    if (path && path !== observation.finalPath) links.add(path);
  }
  observation.links = [...links].slice(0, 120);
  observation.schema = [...schema].sort();
  observation.canonicals = observation.canonicals.map((href) => {
    try {
      const url = new URL(href, linkBase);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
        ? url.href.slice(0, 1500)
        : '[invalid]';
    } catch {
      return '[invalid]';
    }
  });
  observation.html = true;
}

async function readBody(response: Response, maxBytes: number): Promise<string | null> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return body + decoder.decode();
      total += value.byteLength;
      if (total > maxBytes) return null;
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export function createAuditCrawler(
  origin: string,
  request: typeof fetch = fetch,
  wait: (milliseconds: number) => Promise<unknown> = delay,
) {
  let lastRequestAt = 0;
  return async (path: string, sitemap = false) => {
    const observation = emptyObservation(path);
    let current = path;
    const visited = new Set<string>();
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (auditPath(origin, current, origin, sitemap) !== current) {
        observation.failure = 'SCOPE';
        break;
      }
      observation.finalPath = current;
      observation.status = null;
      visited.add(current);
      await wait(Math.max(0, 500 - (Date.now() - lastRequestAt)));
      lastRequestAt = Date.now();
      try {
        const response = await request(new URL(current, origin), {
          redirect: 'manual',
          signal: AbortSignal.timeout(4000),
          headers: {
            Accept: sitemap ? 'application/xml,text/xml' : 'text/html',
            'User-Agent': 'HamidianTechnicalAudit/1.0',
          },
        });
        observation.status = response.status;
        const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
        if (REDIRECT_STATUS.has(response.status)) {
          const location = response.headers.get('location');
          const to = location
            ? auditPath(origin, location, new URL(current, origin).href, sitemap)
            : null;
          observation.redirects.push({ status: response.status, to });
          await response.body?.cancel();
          if (!to || (sitemap && to !== '/sitemap.xml')) observation.failure = 'REDIRECT_SCOPE';
          else if (visited.has(to)) observation.failure = 'REDIRECT_LOOP';
          else if (hop === MAX_REDIRECTS) observation.failure = 'REDIRECT_LIMIT';
          else {
            current = to;
            continue;
          }
          break;
        }
        const robots = response.headers.get('x-robots-tag');
        if (robots) observation.robots.push(robots.slice(0, 300));
        if (response.status === 429 || response.status >= 500) observation.failure = 'UPSTREAM';
        if (
          !response.ok ||
          !(sitemap ? ['application/xml', 'text/xml'].includes(mime ?? '') : mime === 'text/html')
        ) {
          await response.body?.cancel();
          if (response.ok) observation.failure = 'CONTENT_TYPE';
          break;
        }
        const body = await readBody(response, sitemap ? 3_000_000 : 2_000_000);
        if (body === null) observation.failure = 'BODY_LIMIT';
        else if (sitemap) return { observation, sitemapPaths: parseSitemapPaths(origin, body) };
        else readAuditHtml(origin, observation, body);
      } catch {
        observation.failure = 'NETWORK';
      }
      break;
    }
    return { observation, sitemapPaths: null };
  };
}

export function parseSitemapPaths(origin: string, xml: string): string[] | null {
  if (!/<urlset(?:\s|>)/.test(xml) || !/<\/urlset>\s*$/.test(xml)) return null;
  const paths = new Set<string>();
  for (const [, loc] of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    if (!/^https?:\/\//i.test(loc)) continue;
    const path = auditPath(origin, loc.replaceAll('&amp;', '&'));
    if (path) paths.add(path);
  }
  return [...paths];
}
