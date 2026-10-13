import { parseGuideMarkdown, type GuideMarkdownInline } from '@hamidian/guide-markdown';
import type { ReactNode } from 'react';

function InlineNodes({ nodes }: Readonly<{ nodes: readonly GuideMarkdownInline[] }>) {
  return nodes.map((node, index): ReactNode => {
    const key = `${node.type}-${index}`;
    if (node.type === 'text') return <span key={key}>{node.value}</span>;
    if (node.type === 'code')
      return (
        <code
          key={key}
          dir="ltr"
          className="rounded bg-[var(--sf-color-surface)] px-1.5 py-0.5 font-mono text-[0.88em]"
        >
          {node.value}
        </code>
      );
    if (node.type === 'strong')
      return (
        <strong key={key} className="font-semibold text-[var(--sf-color-ink)]">
          <InlineNodes nodes={node.children} />
        </strong>
      );
    if (node.type === 'emphasis')
      return (
        <em key={key}>
          <InlineNodes nodes={node.children} />
        </em>
      );
    if (node.type === 'link')
      return (
        <a
          key={key}
          href={node.href}
          {...(node.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="font-medium text-[var(--sf-color-ink)] underline decoration-[var(--sf-color-border-strong)] underline-offset-4"
        >
          <InlineNodes nodes={node.children} />
        </a>
      );
    return null;
  });
}

export function GuideMarkdown({ markdown }: Readonly<{ markdown: string }>) {
  const blocks = parseGuideMarkdown(markdown);
  return (
    <div
      dir="rtl"
      className="space-y-5 text-base leading-9 text-[var(--sf-color-muted)] sm:text-lg sm:leading-10"
    >
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === 'heading') {
          const className =
            'pt-3 font-normal leading-[1.6] text-[var(--sf-color-ink)] ' +
            (block.level === 3 ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl');
          return block.level === 3 ? (
            <h3 key={key} className={className}>
              <InlineNodes nodes={block.children} />
            </h3>
          ) : (
            <h4 key={key} className={className}>
              <InlineNodes nodes={block.children} />
            </h4>
          );
        }
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List
              key={key}
              className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-2 pr-6 marker:text-[var(--sf-color-subtle)]`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineNodes nodes={item} />
                </li>
              ))}
            </List>
          );
        }
        if (block.type === 'blockquote')
          return (
            <blockquote
              key={key}
              className="border-r-2 border-[var(--sf-color-ink)] pr-5 text-[var(--sf-color-ink)]"
            >
              <InlineNodes nodes={block.children} />
            </blockquote>
          );
        return (
          <p key={key}>
            <InlineNodes nodes={block.children} />
          </p>
        );
      })}
    </div>
  );
}
