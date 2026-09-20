import { platingPresentation } from '@/lib/plating/presentation';

type PlatingTypeIndicatorProps = Readonly<{
  type: string;
  className?: string;
}>;

export function PlatingTypeIndicator({ type, className }: PlatingTypeIndicatorProps) {
  const presentation = platingPresentation(type);

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className ?? ''}`.trim()}
      data-plating-type={type}
    >
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full border"
        style={{
          backgroundColor: presentation.color,
          borderColor: presentation.borderColor,
        }}
      />
      <span>{presentation.label}</span>
    </span>
  );
}
