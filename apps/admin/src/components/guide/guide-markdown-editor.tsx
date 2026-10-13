'use client';

import { parseGuideMarkdown, type GuideMarkdownInline } from '@hamidian/guide-markdown';
import { useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-control';

function PreviewInline({ nodes }: Readonly<{ nodes: readonly GuideMarkdownInline[] }>) {
  return nodes.map((node, index): ReactNode => {
    const key = `${node.type}-${index}`;
    if (node.type === 'text') return <span key={key}>{node.value}</span>;
    if (node.type === 'code')
      return (
        <code key={key} dir="ltr" className="rounded bg-slate-100 px-1">
          {node.value}
        </code>
      );
    if (node.type === 'strong')
      return (
        <strong key={key}>
          <PreviewInline nodes={node.children} />
        </strong>
      );
    if (node.type === 'emphasis')
      return (
        <em key={key}>
          <PreviewInline nodes={node.children} />
        </em>
      );
    if (node.type === 'link')
      return (
        <a key={key} href={node.href} className="underline">
          <PreviewInline nodes={node.children} />
        </a>
      );
    return null;
  });
}

function MarkdownPreview({ value }: Readonly<{ value: string }>) {
  return (
    <div
      dir="rtl"
      className="min-h-36 space-y-4 rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] bg-white p-4 text-sm leading-8"
    >
      {parseGuideMarkdown(value).map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === 'heading') {
          const content = <PreviewInline nodes={block.children} />;
          return block.level === 3 ? (
            <h3 key={key} className="text-xl font-bold">
              {content}
            </h3>
          ) : (
            <h4 key={key} className="text-lg font-bold">
              {content}
            </h4>
          );
        }
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={key} className={`${block.ordered ? 'list-decimal' : 'list-disc'} pr-6`}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <PreviewInline nodes={item} />
                </li>
              ))}
            </List>
          );
        }
        if (block.type === 'blockquote')
          return (
            <blockquote key={key} className="border-r-2 pr-3">
              <PreviewInline nodes={block.children} />
            </blockquote>
          );
        return (
          <p key={key}>
            <PreviewInline nodes={block.children} />
          </p>
        );
      })}
      {!value.trim() ? (
        <p className="text-[var(--admin-color-muted)]">پیش‌نمایش محتوا اینجا نمایش داده می‌شود.</p>
      ) : null}
    </div>
  );
}

export function GuideMarkdownEditor({
  id,
  value,
  disabled,
  onChange,
}: Readonly<{
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}>) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function replaceSelection(before: string, after = before, placeholder = '') {
    const control = textarea.current;
    if (!control) return;
    const start = control.selectionStart;
    const end = control.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      control.focus();
      control.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function prefixLines(prefix: string, ordered = false) {
    const control = textarea.current;
    if (!control) return;
    const start = value.lastIndexOf('\n', Math.max(0, control.selectionStart - 1)) + 1;
    const nextBreak = value.indexOf('\n', control.selectionEnd);
    const end = nextBreak === -1 ? value.length : nextBreak;
    const selected = value.slice(start, end) || 'متن';
    const transformed = selected
      .split('\n')
      .map((line, index) => `${ordered ? `${index + 1}. ` : prefix}${line}`)
      .join('\n');
    onChange(`${value.slice(0, start)}${transformed}${value.slice(end)}`);
    requestAnimationFrame(() => control.focus());
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1" aria-label="ابزار قالب‌بندی Markdown">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => replaceSelection('**', '**', 'متن مهم')}
        >
          Bold
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => replaceSelection('*', '*', 'متن')}
        >
          Italic
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => replaceSelection('[', '](https://)', 'عنوان لینک')}
        >
          Link
        </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => prefixLines('- ')}>
          فهرست
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => prefixLines('', true)}
        >
          شماره‌دار
        </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => prefixLines('### ')}>
          زیرعنوان
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => replaceSelection('`', '`', 'code')}
        >
          Code
        </Button>
        <Button
          size="sm"
          variant={preview ? 'primary' : 'ghost'}
          disabled={disabled}
          onClick={() => setPreview((current) => !current)}
        >
          {preview ? 'ویرایش' : 'پیش‌نمایش'}
        </Button>
      </div>
      {preview ? (
        <MarkdownPreview value={value} />
      ) : (
        <Textarea
          ref={textarea}
          id={id}
          dir="rtl"
          value={value}
          maxLength={20000}
          disabled={disabled}
          className="min-h-44 font-[inherit]"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <p className="mt-2 text-xs text-[var(--admin-color-muted)]">
        HTML خام پذیرفته نمی‌شود. زیرعنوان‌ها در خروجی به H3 و H4 محدود می‌شوند.
      </p>
    </div>
  );
}
