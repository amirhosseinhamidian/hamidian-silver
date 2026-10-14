'use client';

import { useId, useState } from 'react';

type GuideAccordionItem = Readonly<{
  question: string;
  answer: string;
}>;

export function GuideAccordion({
  items,
  variant,
}: Readonly<{
  items: readonly GuideAccordionItem[];
  variant?: string | null;
}>) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();
  const cards = variant === 'cards';

  return (
    <div
      className={`mt-8 ${cards ? 'grid gap-4 md:grid-cols-2' : 'border-t border-[var(--sf-color-border)]'}`}
    >
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const triggerId = `${baseId}-trigger-${index}`;
        const panelId = `${baseId}-panel-${index}`;

        return (
          <div
            key={`${item.question}-${index}`}
            className={
              cards
                ? 'border border-[var(--sf-color-border)] p-6'
                : 'border-b border-[var(--sf-color-border)] py-5'
            }
          >
            <h3>
              <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-start justify-between gap-5 text-right text-base font-medium leading-8"
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className={`mt-1 shrink-0 text-xl font-normal transition-transform duration-300 ease-out ${
                    isOpen ? 'rotate-45' : ''
                  }`}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              aria-hidden={!isOpen}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <p className="pt-4 text-base leading-8 text-[var(--sf-color-muted)]">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
