import { ProductForm } from '@/components/products/product-form';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { requireAdminSession } from '@/lib/auth/session';
import { loadProductForm } from '@/lib/catalog/catalog-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadSupplierImportDraft } from '@/lib/supplier-imports/supplier-imports-data';

export const dynamic = 'force-dynamic';

type Props = Readonly<{ searchParams: Promise<{ importDraftId?: string }> }>;

export default async function NewProductPage({ searchParams }: Props) {
  const { importDraftId } = await searchParams;
  const returnTo = importDraftId
    ? `/products/new?importDraftId=${encodeURIComponent(importDraftId)}`
    : '/products/new';
  await requireAdminSession({ permissions: ['catalog.write'], returnTo });
  const [data, importDraft] = await Promise.all([
    loadProductForm(),
    importDraftId ? loadSupplierImportDraft(importDraftId) : Promise.resolve(null),
  ]);
  const unavailableDraft = Boolean(importDraftId && !importDraft);
  const importedProduct = importDraft?.product;
  const rejectedDraft = importDraft?.status === 'REJECTED';

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header>
        <Badge tone="info">مرحله {formatAdminInteger(5)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">
          {importDraft ? 'تکمیل و ساخت محصول دریافتی' : 'افزودن محصول'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--admin-color-muted)]">
          اطلاعات پایه، تصاویر و همه تنوع‌های فعلی محصول را در یک مرحله ثبت کنید.
        </p>
      </header>
      {unavailableDraft ? (
        <p role="alert" className="mt-6 text-sm text-[var(--admin-color-danger)]">
          پیش‌نویس انتخاب‌شده دریافت نشد یا دیگر در دسترس نیست.
        </p>
      ) : importedProduct ? (
        <div className="mt-6 rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] p-5">
          <p className="text-sm">
            این پیش‌نویس قبلاً به محصول «{importedProduct.name}» تبدیل شده است.
          </p>
          <ButtonLink href={`/products/${importedProduct.id}/edit`} className="mt-4">
            ویرایش محصول ساخته‌شده
          </ButtonLink>
        </div>
      ) : rejectedDraft ? (
        <div className="mt-6 rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] p-5">
          <p className="text-sm">
            این پیش‌نویس رد شده است. ابتدا وضعیت آن را از فهرست بازبینی تغییر دهید.
          </p>
          <ButtonLink href="/product-imports" variant="secondary" className="mt-4">
            بازگشت به محصولات دریافتی
          </ButtonLink>
        </div>
      ) : data ? (
        <ProductForm data={data} mode="create" importDraft={importDraft} />
      ) : (
        <p role="alert" className="mt-6 text-sm text-[var(--admin-color-danger)]">
          اطلاعات پایه کاتالوگ دریافت نشد. اتصال API را بررسی کنید.
        </p>
      )}
    </main>
  );
}
