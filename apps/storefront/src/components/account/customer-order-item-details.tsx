import type { CustomerOrderItem } from '@/components/account/account-types';
import { toPersianDigits } from '@/components/account/account-types';
import { CampaignTag } from '@/components/catalog/campaign-tag';
import { PlatingTypeIndicator } from '@/components/plating/plating-type-indicator';

type CustomerOrderItemDetailsProps = Readonly<{
  item: CustomerOrderItem;
  className?: string;
}>;

export function CustomerOrderItemDetails({ item, className }: CustomerOrderItemDetailsProps) {
  const leadingDetails = [
    item.variantNameSnapshot ? toPersianDigits(item.variantNameSnapshot) : null,
    item.sizeLabelSnapshot ? `سایز ${toPersianDigits(item.sizeLabelSnapshot)}` : null,
  ].filter((detail): detail is string => detail !== null);

  return (
    <p className={className}>
      {leadingDetails.length > 0 ? <>{leadingDetails.join(' · ')} · </> : null}
      {item.platingType ? (
        <>
          <PlatingTypeIndicator type={item.platingType} /> {' · '}
        </>
      ) : null}
      تعداد {item.quantity.toLocaleString('fa-IR')}
      {item.campaignNameSnapshot && (
        <span className="ms-2">
          <CampaignTag name={item.campaignNameSnapshot} />
        </span>
      )}
    </p>
  );
}
