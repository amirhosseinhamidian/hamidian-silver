import { Skeleton } from '@/components/ui/skeleton';

export default function ProductsLoading() {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]" aria-busy="true">
      <Skeleton className="h-10 w-56" />
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index}>
            <Skeleton className="aspect-[4/5] bg-[var(--sf-color-surface)]" />
            <Skeleton className="mt-4 h-4 w-2/3" />
            <Skeleton className="mt-3 h-3 w-1/3" />
          </div>
        ))}
      </div>
    </main>
  );
}
