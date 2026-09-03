export default function AdminHomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-7xl items-center px-6 py-16">
      <section aria-labelledby="admin-title">
        <p className="mb-3 text-sm font-medium text-slate-500">HAMIDIAN ADMIN</p>
        <h1 id="admin-title" className="text-3xl font-semibold">
          پنل مدیریت نقره حمیدیان
        </h1>
        <p className="mt-4 max-w-xl leading-8 text-slate-600">
          زیرساخت نسخه جدید پنل برای توسعه عملیات فروش، موجودی، مالی، CMS و گزارش‌ها آماده است.
        </p>
      </section>
    </main>
  );
}
