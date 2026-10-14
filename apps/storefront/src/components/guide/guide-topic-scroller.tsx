'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

export type GuideTopicScrollerItem = Readonly<{
  id: string;
  label: string;
  href: string;
  current: boolean;
}>;

export function GuideTopicScroller({
  items,
}: Readonly<{ items: readonly GuideTopicScrollerItem[] }>) {
  const initialIndex = Math.max(
    0,
    items.findIndex((item) => item.current),
  );
  const [visibleIndex, setVisibleIndex] = useState(initialIndex);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const moveTo = (nextIndex: number) => {
    const boundedIndex = Math.min(Math.max(nextIndex, 0), items.length - 1);
    const item = scrollerRef.current?.querySelector<HTMLElement>(
      `[data-guide-topic-index="${boundedIndex}"]`,
    );
    if (!item) return;

    setVisibleIndex(boundedIndex);
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  return (
    <div className="sf-container py-5 lg:grid lg:grid-cols-[3rem_minmax(0,1fr)_3rem] lg:items-center lg:gap-3">
      <button
        type="button"
        aria-label="موضوع قبلی"
        disabled={visibleIndex === 0}
        onClick={() => moveTo(visibleIndex - 1)}
        className="hidden size-12 items-center justify-center rounded-full border border-[var(--sf-color-border)] text-xl transition-colors hover:border-[var(--sf-color-ink)] disabled:cursor-default disabled:opacity-30 lg:inline-flex"
      >
        <span aria-hidden="true">→</span>
      </button>

      <div
        ref={scrollerRef}
        className="flex min-w-0 gap-3 overflow-x-auto whitespace-nowrap scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            scroll
            data-guide-topic-index={index}
            aria-current={item.current ? 'page' : undefined}
            className={`shrink-0 rounded-full border px-5 py-2 text-sm ${
              item.current
                ? 'border-[var(--sf-color-ink)] bg-[var(--sf-color-ink)] text-white'
                : 'border-[var(--sf-color-border)]'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <button
        type="button"
        aria-label="موضوع بعدی"
        disabled={visibleIndex === items.length - 1}
        onClick={() => moveTo(visibleIndex + 1)}
        className="hidden size-12 items-center justify-center rounded-full border border-[var(--sf-color-border)] text-xl transition-colors hover:border-[var(--sf-color-ink)] disabled:cursor-default disabled:opacity-30 lg:inline-flex"
      >
        <span aria-hidden="true">←</span>
      </button>
    </div>
  );
}
