import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function CampaignsLoading() {
  return (
    <main className="admin-container min-w-0 py-5">
      <Card title="جشنواره‌ها و کمپین‌ها">
        <p role="status" className="mb-3 text-sm">
          در حال دریافت اطلاعات…
        </p>
        <Skeleton className="h-16 w-full" />
      </Card>
    </main>
  );
}
