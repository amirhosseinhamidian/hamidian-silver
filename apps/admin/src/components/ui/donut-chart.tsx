import { formatAdminInteger } from '@/lib/presentation/formatters';
import { cn } from '@/lib/ui/cn';

export type DonutChartSegment = Readonly<{
  label: string;
  value: number;
  color: string;
}>;

type DonutChartProps = Readonly<{
  title: string;
  segments: readonly DonutChartSegment[];
  centerLabel?: string;
  className?: string;
}>;

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ title, segments, centerLabel = 'مجموع', className }: DonutChartProps) {
  const normalizedSegments = segments.map((segment) => ({
    ...segment,
    value: Number.isFinite(segment.value) ? Math.max(0, segment.value) : 0,
  }));
  const total = normalizedSegments.reduce((sum, segment) => sum + segment.value, 0);
  let consumed = 0;

  return (
    <figure className={cn('grid items-center gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]', className)}>
      <div className="relative mx-auto size-40">
        <svg
          role="img"
          aria-label={`${title}؛ مجموع ${formatAdminInteger(total)}`}
          viewBox="0 0 100 100"
          className="size-full"
        >
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="var(--admin-color-surface-hover)"
            strokeWidth="10"
          />
          {total > 0
            ? normalizedSegments.map((segment) => {
                const length = (segment.value / total) * CIRCUMFERENCE;
                const offset = consumed;
                consumed += length;

                return (
                  <circle
                    key={segment.label}
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="10"
                    strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 50 50)"
                  />
                );
              })
            : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-black tabular-nums">{formatAdminInteger(total)}</p>
            <p className="mt-0.5 text-[0.625rem] text-[var(--admin-color-muted)]">{centerLabel}</p>
          </div>
        </div>
      </div>

      <figcaption>
        <p className="sr-only">{title}</p>
        <ul className="space-y-2.5">
          {normalizedSegments.map((segment) => (
            <li key={segment.label} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-[var(--admin-color-muted)]">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="font-black tabular-nums">{formatAdminInteger(segment.value)}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
