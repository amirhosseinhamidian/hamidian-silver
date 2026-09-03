export default function ProductsLoading() {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <div className="h-10 w-56 animate-pulse bg-[var(--sf-color-surface-emphasis)]" />
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index}>
            <div className="aspect-[4/5] animate-pulse bg-[var(--sf-color-surface)]" />
            <div className="mt-4 h-4 w-2/3 animate-pulse bg-[var(--sf-color-surface-emphasis)]" />
            <div className="mt-3 h-3 w-1/3 animate-pulse bg-[var(--sf-color-surface-emphasis)]" />
          </div>
        ))}
      </div>
    </main>
  );
}
