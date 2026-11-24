import { formatTomanPrice } from '@/lib/catalog/presentation';
import { formatWalletDate, type WalletBalance } from '@/lib/wallet/wallet-presentation';

export function WalletBalanceView({ balance }: Readonly<{ balance: WalletBalance }>) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt>اعتبار قابل مصرف</dt>
        <dd className="font-bold">{formatTomanPrice(balance.availableToman)}</dd>
        <dt>در انتظار تأیید</dt>
        <dd>{formatTomanPrice(balance.pendingToman)}</dd>
        <dt>رزروشده</dt>
        <dd>{formatTomanPrice(balance.reservedToman)}</dd>
      </dl>
      {balance.nextExpiryAt && Boolean(balance.nextExpiryToman) && (
        <p>
          {formatTomanPrice(balance.nextExpiryToman ?? 0)} از اعتبار شما تا{' '}
          <time dateTime={balance.nextExpiryAt}>{formatWalletDate(balance.nextExpiryAt)}</time> قابل
          مصرف است.
        </p>
      )}
    </div>
  );
}
