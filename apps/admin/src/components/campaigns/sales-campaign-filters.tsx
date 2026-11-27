import type { paths } from '@hamidian/contracts';

import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DualCalendarPicker } from '@/components/ui/dual-calendar-picker';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { campaignStatusLabels } from '@/lib/campaigns/campaign-model';

type Query = NonNullable<paths['/api/v1/campaigns']['get']['parameters']['query']>;
const statuses = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  ...Object.entries(campaignStatusLabels).map(([value, label]) => ({ value, label })),
];
const sortOptions = [
  { value: 'newest', label: 'شروع دیرتر' },
  { value: 'oldest', label: 'شروع زودتر' },
];
const salesKinds = [
  { value: 'all', label: 'همهٔ انواع' },
  { value: 'offers', label: 'پیشنهاد فروش مستقل' },
  { value: 'existing', label: 'سایر کمپین‌های دارای شواهد فروش' },
];

export function SalesCampaignFilters({ filters }: { filters: Query }) {
  return (
    <Card title="جست‌وجو و فیلتر پیشنهادهای فروش">
      <form action="/campaigns" method="get" className="space-y-4">
        <input type="hidden" name="view" value="sales" />
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="sales-search" label="نام پیشنهاد یا کمپین">
            {(control) => <Input {...control} name="q" defaultValue={filters.q} maxLength={150} />}
          </FormField>
          <FormField id="sales-status" label="وضعیت">
            {(control) => (
              <Select
                {...control}
                name="status"
                options={statuses}
                defaultValue={filters.status ?? 'all'}
              />
            )}
          </FormField>
          <FormField id="sales-sort" label="ترتیب بر اساس زمان شروع">
            {(control) => (
              <Select
                {...control}
                name="sort"
                options={sortOptions}
                defaultValue={filters.sort ?? 'newest'}
              />
            )}
          </FormField>
          <FormField id="sales-kind" label="نوع">
            {(control) => (
              <Select
                {...control}
                name="salesKind"
                options={salesKinds}
                defaultValue={filters.salesKind ?? 'all'}
              />
            )}
          </FormField>
          <DualCalendarPicker
            name="fromTehran"
            label="ابتدای بازهٔ فعالیت"
            defaultValue={filters.fromTehran}
          />
          <DualCalendarPicker
            name="toTehran"
            label="انتهای بازهٔ فعالیت"
            defaultValue={filters.toTehran}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary">
            اعمال فیلتر
          </Button>
          <ButtonLink href="/campaigns?view=sales" variant="ghost">
            پاک‌کردن فیلترها
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
