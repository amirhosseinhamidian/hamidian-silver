const persianNumber = new Intl.NumberFormat('fa-IR', {
  maximumFractionDigits: 0,
});

type DiscountBadgeProps = Readonly<{
  percent: number;
}>;

export function DiscountBadge({ percent }: DiscountBadgeProps) {
  return (
    <span
      className="
        inline-flex min-h-6 items-center justify-center rounded-sm
        bg-[var(--sf-color-ink)] px-2 py-1 text-xs font-medium
        leading-none text-white
      "
    >
      {persianNumber.format(percent)}٪
    </span>
  );
}
