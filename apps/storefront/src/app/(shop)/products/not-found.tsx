import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function ProductNotFound() {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <EmptyState
        title="این محصول پیدا نشد"
        description="ممکن است محصول حذف شده یا دیگر برای فروش فعال نباشد."
        action={
          <ButtonLink href="/products" variant="text" size="sm">
            بازگشت به محصولات
          </ButtonLink>
        }
      />
    </main>
  );
}
