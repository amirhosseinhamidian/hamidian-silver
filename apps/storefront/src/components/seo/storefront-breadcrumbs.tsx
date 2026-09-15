import Link from 'next/link';

import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbStructuredData,
  type StorefrontBreadcrumbItem,
} from '@/lib/seo/structured-data';

type StorefrontBreadcrumbsProps = Readonly<{
  items: readonly StorefrontBreadcrumbItem[];
  className?: string;
}>;

export function StorefrontBreadcrumbs({ items, className = '' }: StorefrontBreadcrumbsProps) {
  return (
    <>
      <nav aria-label="مسیر صفحه" className={`text-xs ${className}`}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {items.map((item, index) => {
            const current = index === items.length - 1;
            return (
              <li key={`${item.href}:${item.label}`} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden="true" className="opacity-45">
                    /
                  </span>
                ) : null}
                {current ? (
                  <span aria-current="page">{item.label}</span>
                ) : (
                  <Link href={item.href} className="transition-opacity hover:opacity-55">
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={buildBreadcrumbStructuredData(items)} />
    </>
  );
}
