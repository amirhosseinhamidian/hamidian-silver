export type GuideMarkdownInline =
  | Readonly<{ type: 'text'; value: string }>
  | Readonly<{ type: 'strong' | 'emphasis'; children: readonly GuideMarkdownInline[] }>
  | Readonly<{ type: 'code'; value: string }>
  | Readonly<{
      type: 'link';
      href: string;
      external: boolean;
      children: readonly GuideMarkdownInline[];
    }>;

export type GuideMarkdownBlock =
  | Readonly<{ type: 'paragraph' | 'blockquote'; children: readonly GuideMarkdownInline[] }>
  | Readonly<{ type: 'heading'; level: 3 | 4; children: readonly GuideMarkdownInline[] }>
  | Readonly<{
      type: 'list';
      ordered: boolean;
      items: readonly (readonly GuideMarkdownInline[])[];
    }>;

const INLINE_TOKEN =
  /(`[^`\n]+`|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_)/;

export function safeGuideMarkdownHref(
  value: string,
): Readonly<{ href: string; external: boolean }> | null {
  const href = value.trim();
  if (/^\/(?!\/)(?!.*[\\\s])/.test(href)) return { href, external: false };
  if (/^#[a-z0-9][a-z0-9-]{0,79}$/i.test(href)) return { href, external: false };
  if (/^(?:mailto|tel):[^\s]+$/i.test(href)) return { href, external: true };
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? { href: url.toString(), external: true }
      : null;
  } catch {
    return null;
  }
}

export function parseGuideMarkdownInline(value: string): readonly GuideMarkdownInline[] {
  const nodes: GuideMarkdownInline[] = [];
  let remaining = value;
  while (remaining) {
    const match = INLINE_TOKEN.exec(remaining);
    if (!match || match.index === undefined) {
      nodes.push({ type: 'text', value: remaining });
      break;
    }
    if (match.index > 0) nodes.push({ type: 'text', value: remaining.slice(0, match.index) });
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push({ type: 'code', value: token.slice(1, -1) });
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const link = safeGuideMarkdownHref(match[3]);
      if (link)
        nodes.push({
          type: 'link',
          ...link,
          children: parseGuideMarkdownInline(match[2]),
        });
      else nodes.push({ type: 'text', value: match[2] });
    } else if (match[4] !== undefined || match[5] !== undefined) {
      nodes.push({
        type: 'strong',
        children: parseGuideMarkdownInline(match[4] ?? match[5] ?? ''),
      });
    } else {
      nodes.push({
        type: 'emphasis',
        children: parseGuideMarkdownInline(match[6] ?? match[7] ?? ''),
      });
    }
    remaining = remaining.slice(match.index + token.length);
  }
  return nodes;
}

export function parseGuideMarkdown(value: string): readonly GuideMarkdownBlock[] {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const blocks: GuideMarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]!.length <= 3 ? 3 : 4,
        children: parseGuideMarkdownInline(heading[2]!.trim()),
      });
      index += 1;
      continue;
    }
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    const unordered = /^\s*[-+*]\s+(.+)$/.exec(line);
    if (ordered || unordered) {
      const isOrdered = Boolean(ordered);
      const items: GuideMarkdownInline[][] = [];
      while (index < lines.length) {
        const item = (isOrdered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/).exec(
          lines[index] ?? '',
        );
        if (!item) break;
        items.push([...parseGuideMarkdownInline(item[1]!.trim())]);
        index += 1;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      const parts: string[] = [];
      while (index < lines.length) {
        const part = /^>\s?(.*)$/.exec(lines[index] ?? '');
        if (!part) break;
        parts.push(part[1] ?? '');
        index += 1;
      }
      blocks.push({
        type: 'blockquote',
        children: parseGuideMarkdownInline(parts.join(' ').trim()),
      });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length) {
      const part = lines[index] ?? '';
      if (
        !part.trim() ||
        /^(#{1,6})\s+/.test(part) ||
        /^\s*(?:\d+[.)]|[-+*])\s+/.test(part) ||
        /^>/.test(part)
      )
        break;
      paragraph.push(part.trim());
      index += 1;
    }
    blocks.push({
      type: 'paragraph',
      children: parseGuideMarkdownInline(paragraph.join(' ')),
    });
  }
  return blocks;
}
