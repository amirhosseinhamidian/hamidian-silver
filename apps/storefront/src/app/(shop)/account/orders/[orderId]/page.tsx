import { CustomerOrderDetailView } from '@/components/account/customer-order-detail';

type CustomerOrderPageProps = Readonly<{ params: Promise<{ orderId: string }> }>;

export default async function CustomerOrderPage({ params }: CustomerOrderPageProps) {
  return <CustomerOrderDetailView orderId={(await params).orderId} />;
}
