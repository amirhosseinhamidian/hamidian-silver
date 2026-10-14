'use client';

type GuideTableOfContentsItem = Readonly<{
  anchor: string;
  heading: string;
}>;

function scrollToAnchor(anchor: string) {
  const target = document.getElementById(anchor);
  if (!target) return;

  window.history.replaceState(null, '', `#${anchor}`);
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function GuideTableOfContents({
  items,
  desktop = false,
}: Readonly<{
  items: readonly GuideTableOfContentsItem[];
  desktop?: boolean;
}>) {
  return (
    <nav
      aria-label="در این دانستنی"
      className={
        desktop
          ? 'border border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)] p-6 shadow-[0_18px_50px_rgba(23,23,23,0.06)]'
          : 'sticky top-16 z-20 border-b border-[var(--sf-color-border)] bg-[color:var(--sf-color-canvas)/0.94] backdrop-blur-md lg:hidden'
      }
    >
      {desktop ? (
        <p className="border-b border-[var(--sf-color-border)] pb-4 text-sm font-medium">
          در این دانستنی
        </p>
      ) : null}
      <div
        className={
          desktop
            ? 'mt-3 flex flex-col'
            : 'sf-container flex gap-8 overflow-x-auto py-4 text-sm whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-12'
        }
      >
        {items.map((item) => (
          <a
            key={item.anchor}
            href={`#${item.anchor}`}
            className={
              desktop
                ? 'border-b border-[var(--sf-color-border)] py-3 text-sm leading-7 text-[var(--sf-color-muted)] transition-colors last:border-b-0 hover:text-[var(--sf-color-ink)]'
                : 'transition-opacity hover:opacity-50'
            }
            onClick={(event) => {
              event.preventDefault();
              scrollToAnchor(item.anchor);
            }}
          >
            {item.heading}
          </a>
        ))}
      </div>
    </nav>
  );
}
