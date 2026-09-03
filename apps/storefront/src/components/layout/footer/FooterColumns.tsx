const columns = [
  {
    title: 'دسترسی سریع',
    items: ['انگشتر', 'گردنبند', 'دستبند', 'گوشواره'],
  },
  {
    title: 'خدمات مشتریان',
    items: ['تماس با ما', 'شرایط خرید', 'پیگیری سفارش'],
  },
  {
    title: 'درباره حمیدیان',
    items: ['داستان برند', 'فروشگاه‌ها', 'مجله'],
  },
];

export function FooterColumns() {
  return (
    <section
      className="
        grid
        gap-8
        border-t
        border-(--ui-border)
        py-10
        md:grid-cols-3
      "
    >
      {columns.map((column) => (
        <div key={column.title}>
          <h4
            className="
              mb-4
              text-sm
              font-medium
            "
          >
            {column.title}
          </h4>

          <ul
            className="
              space-y-3
              text-sm
              text-(--luxury-muted)
            "
          >
            {column.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
