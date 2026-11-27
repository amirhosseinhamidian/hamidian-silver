'use client';

import { useId, useState } from 'react';

import { CampaignProductSearch } from './campaign-product-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { addCampaignSelection, type CampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { formatAdminInteger } from '@/lib/presentation/formatters';

type Props = Readonly<{
  taxonomy: CampaignTaxonomy;
  kind: 'categories' | 'brands';
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  max: number;
  disabled?: boolean;
  categoryMode?: 'direct' | 'tree';
  describeScope?: boolean;
  campaignId?: string;
}>;

function normalizeLabel(value: string) {
  return value.trim().toLocaleLowerCase('fa-IR').replaceAll('ي', 'ی').replaceAll('ك', 'ک');
}

export function CampaignTaxonomyPicker({
  taxonomy,
  kind,
  selected,
  onChange,
  max,
  disabled = false,
  categoryMode = 'tree',
  describeScope = true,
  campaignId,
}: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const category = kind === 'categories';
  const label = category ? 'دسته‌بندی‌ها' : 'برندها';
  const categoryById = new Map(taxonomy.categories.map((option) => [option.id, option]));
  const optionNames = new Map(taxonomy[kind].map((option) => [option.slug, option.name]));
  const choices = taxonomy[kind]
    .map((option) => {
      const lineage = [option.name];
      const seen = new Set([option.id]);
      const node = category ? categoryById.get(option.id) : undefined;
      let child = node;
      while (child?.parentId && !seen.has(child.parentId)) {
        seen.add(child.parentId);
        child = categoryById.get(child.parentId);
        if (child) lineage.unshift(child.name);
      }
      return {
        ...option,
        lineage,
        count:
          node && (categoryMode === 'direct' ? node.directProductCount : node.subtreeProductCount),
      };
    })
    .sort((left, right) => left.lineage.join(' / ').localeCompare(right.lineage.join(' / '), 'fa'));
  const term = normalizeLabel(query);
  const results = choices.filter((option) =>
    normalizeLabel(`${option.lineage.join(' ')} ${option.slug}`).includes(term),
  );
  const previewSlug = preview && selected.includes(preview) ? preview : null;

  return (
    <section
      className="min-w-0 space-y-2 rounded-lg border border-[var(--admin-color-border)] p-3"
      aria-label={label}
    >
      <p className="text-sm font-semibold">
        {label} ({formatAdminInteger(selected.length)} از {formatAdminInteger(max)})
      </p>
      {category && describeScope && (
        <p className="text-xs text-[var(--admin-color-muted)]">
          {categoryMode === 'direct'
            ? 'هر انتخاب محصولات ثبت‌شده در همان دسته را شامل می‌شود. زیرمجموعه‌ها جداگانه قابل انتخاب‌اند.'
            : 'انتخاب دستهٔ مادر، محصولات زیرمجموعه‌های فعال آن را هم به‌صورت پویا شامل می‌شود.'}
        </p>
      )}
      {selected.length > 0 && (
        <ul aria-label={`${label} انتخاب‌شده`} className="flex flex-wrap gap-2">
          {selected.map((slug) => (
            <li
              className="flex min-w-0 flex-wrap items-center gap-1 rounded-md border px-2 py-1 text-xs"
              key={slug}
            >
              <span className="[overflow-wrap:anywhere]">{optionNames.get(slug) ?? slug}</span>
              {optionNames.has(slug) && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`دیدن محصولات ${optionNames.get(slug)}`}
                  aria-expanded={previewSlug === slug}
                  onClick={() => setPreview(previewSlug === slug ? null : slug)}
                >
                  دیدن محصولات
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                aria-label={`حذف ${optionNames.get(slug) ?? slug}`}
                onClick={() => onChange(selected.filter((entry) => entry !== slug))}
              >
                حذف
              </Button>
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">انتخاب {label}</summary>
        <label htmlFor={id} className="mt-2 block text-xs">
          جست‌وجوی {label}
        </label>
        <Input
          id={id}
          type="search"
          className="mt-1"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
          }}
        />
        {results.length === 0 ? (
          <p role="status" className="mt-2 text-xs">
            نتیجه‌ای پیدا نشد.
          </p>
        ) : (
          <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
            {results.map((option) => {
              const checked = selected.includes(option.slug);
              return (
                <li
                  key={option.id}
                  style={{ paddingInlineStart: `${Math.min(option.lineage.length - 1, 4) * 12}px` }}
                >
                  <label
                    className="flex items-center gap-2 rounded p-1.5 text-sm"
                    title={option.lineage.join(' / ')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled || (!checked && selected.length >= max)}
                      onChange={() =>
                        onChange(
                          checked
                            ? selected.filter((entry) => entry !== option.slug)
                            : addCampaignSelection(selected, option.slug, max),
                        )
                      }
                    />
                    <span className="[overflow-wrap:anywhere]">
                      {term ? option.lineage.join(' / ') : option.name}
                    </span>
                    {option.count !== undefined && (
                      <span className="text-xs text-[var(--admin-color-muted)]">
                        {formatAdminInteger(option.count)} محصول فعال
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </details>
      {previewSlug && (
        <div className="space-y-2 border-t pt-2">
          <p className="text-sm font-semibold">محصولات {optionNames.get(previewSlug)}</p>
          <CampaignProductSearch
            key={previewSlug}
            fixedCategory={category ? previewSlug : undefined}
            fixedBrand={category ? undefined : previewSlug}
            categoryMode={categoryMode}
            campaignId={campaignId}
            withinCampaign={Boolean(campaignId)}
            taxonomy={taxonomy}
            disabled={disabled}
          />
        </div>
      )}
    </section>
  );
}
