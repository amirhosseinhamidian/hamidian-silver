import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function CampaignsLoading() {
  return (
    <div className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
      <Card title="جشنواره‌ها و کمپین‌ها">
        <p role="status" className="mb-3 text-sm">
          در حال دریافت اطلاعات…
        </p>
        <Skeleton className="h-16 w-full" />
      </Card>
    </div>
  );
}
