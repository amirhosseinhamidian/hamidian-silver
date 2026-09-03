export default function CategoriesLoading() {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]" aria-busy="true">
      <div className="h-6 w-24 animate-pulse bg-[var(--sf-color-surface)]" />
      <div className="mt-5 h-12 w-72 animate-pulse bg-[var(--sf-color-surface)]" />
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="aspect-[4/5] animate-pulse bg-[var(--sf-color-surface)]" />
        ))}
      </div>
    </main>
  );
}
