export function CampaignTag({ name }: { name: string }) {
  return (
    <span className="inline-block max-w-full rounded-sm bg-[var(--sf-color-ink)] px-2 py-0.5 text-xs font-medium leading-5 text-[var(--sf-color-inverse)] [overflow-wrap:anywhere]">
      {name}
    </span>
  );
}
