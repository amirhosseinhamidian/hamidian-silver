'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import {
  supplierCreditRemainingAmount,
  type AdminSupplierCredit,
} from '@/lib/supplier-credits/supplier-credits-model';
import type { AdminSupplierPayable } from '@/lib/supplier-payables/supplier-payables-model';
import {
  parseSupplierSettlement,
  supplierSettlementNetAmount,
  type AdminSettlementCreditApplication,
  type AdminSupplierSettlement,
  type AdminSupplierSettlementActor,
  type AdminSupplierSettlementStatus,
} from '@/lib/supplier-settlements/supplier-settlements-model';

type Props = Readonly<{
  settlements: readonly AdminSupplierSettlement[];
  payables: readonly AdminSupplierPayable[];
  credits: readonly AdminSupplierCredit[];
  failed: boolean;
  canWrite: boolean;
}>;

type StatusFilter = AdminSupplierSettlementStatus | 'all';
type DetailMode = 'desktop' | 'mobile' | null;
type SettlementAction =
  | Readonly<{ kind: 'create' }>
  | Readonly<{ kind: 'apply-credit'; settlement: AdminSupplierSettlement; idempotencyKey: string }>
  | Readonly<{
      kind: 'remove-credit';
      settlement: AdminSupplierSettlement;
      application: AdminSettlementCreditApplication;
    }>
  | Readonly<{ kind: 'pay'; settlement: AdminSupplierSettlement }>
  | Readonly<{ kind: 'cancel'; settlement: AdminSupplierSettlement }>;

const STATUS: Readonly<
  Record<AdminSupplierSettlementStatus, Readonly<{ label: string; tone: BadgeTone }>>
> = {
  DRAFT: { label: 'پیش‌نویس', tone: 'warning' },
  PAID: { label: 'پرداخت‌شده', tone: 'success' },
  CANCELLED: { label: 'لغوشده', tone: 'danger' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'DRAFT', label: 'پیش‌نویس' },
  { value: 'PAID', label: 'پرداخت‌شده' },
  { value: 'CANCELLED', label: 'لغوشده' },
];

function actorLabel(actor: AdminSupplierSettlementActor | null): string {
  if (!actor) return 'ثبت نشده';
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(' ') || formatAdminPhone(actor.phone)
  );
}

function StatusBadge({ status }: Readonly<{ status: AdminSupplierSettlementStatus }>) {
  return (
    <Badge tone={STATUS[status].tone} dot>
      {STATUS[status].label}
    </Badge>
  );
}

function DetailRows({ rows }: Readonly<{ rows: readonly (readonly [string, string])[] }>) {
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-2.5 text-xs sm:text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[68%] text-left font-semibold break-words">
            {toPersianDigits(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Kpi({
  label,
  value,
  description,
  tone,
}: Readonly<{ label: string; value: string; description: string; tone: BadgeTone }>) {
  return (
    <Card className="h-full">
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-3 text-xl font-black tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-[var(--admin-color-muted)]">{description}</p>
    </Card>
  );
}

function SettlementItems({ settlement }: Readonly<{ settlement: AdminSupplierSettlement }>) {
  if (!settlement.items.length) {
    return (
      <p className="text-sm text-[var(--admin-color-muted)]">جزئیات اقلام در حال دریافت است.</p>
    );
  }
  return (
    <div className="grid gap-3">
      {settlement.items.map((item) => (
        <article
          key={item.id}
          className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold">{item.payable.productName}</h4>
              <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                سفارش {toPersianDigits(item.payable.orderNumber)} · SKU{' '}
                {toPersianDigits(item.payable.sku)}
              </p>
            </div>
            <Badge tone={item.payable.status === 'PAID' ? 'success' : 'warning'}>
              {item.payable.status === 'PAID' ? 'پرداخت‌شده' : 'در انتظار پرداخت'}
            </Badge>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['تعداد', formatAdminInteger(item.payable.quantity)],
              ['قیمت خرید واحد', formatAdminToman(item.payable.unitSupplierPriceToman)],
              ['مبلغ بدهی', formatAdminToman(item.payable.amountToman)],
              ['سهم در batch', formatAdminToman(item.amountToman)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[var(--admin-radius-sm)] bg-[var(--admin-color-surface-subtle)] p-2"
              >
                <dt className="text-[0.6875rem] text-[var(--admin-color-subtle)]">{label}</dt>
                <dd className="mt-1 text-xs font-black">{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

function SettlementCredits({
  settlement,
  canWrite,
  onRemove,
}: Readonly<{
  settlement: AdminSupplierSettlement;
  canWrite: boolean;
  onRemove: (application: AdminSettlementCreditApplication) => void;
}>) {
  if (!settlement.creditApplications.length) {
    return (
      <p className="text-sm text-[var(--admin-color-muted)]">
        اعتباری روی این دوره اعمال نشده است.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {settlement.creditApplications.map((application) => (
        <article
          key={application.id}
          className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{application.supplierCredit.supplierName}</p>
              <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                اعتبار مرجوعی {toPersianDigits(application.supplierCredit.returnItemId)}
              </p>
            </div>
            <Badge tone={application.status === 'ACTIVE' ? 'info' : 'danger'}>
              {application.status === 'ACTIVE' ? 'فعال' : 'حذف‌شده'}
            </Badge>
          </div>
          <DetailRows
            rows={[
              ['مبلغ اعمال‌شده', formatAdminToman(application.amountToman)],
              ['زمان اعمال', formatAdminDateTime(application.createdAt)],
              ['اعمال توسط', actorLabel(application.appliedBy)],
              [
                'زمان حذف',
                application.removedAt ? formatAdminDateTime(application.removedAt) : 'ثبت نشده',
              ],
              ['دلیل حذف', application.removalReason ?? 'ثبت نشده'],
            ]}
          />
          {canWrite && settlement.status === 'DRAFT' && application.status === 'ACTIVE' ? (
            <Button
              className="mt-3"
              size="sm"
              variant="danger"
              onClick={() => onRemove(application)}
            >
              حذف اعتبار از دوره
            </Button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function SettlementDetails({
  settlement,
  canWrite,
  onRemoveCredit,
}: Readonly<{
  settlement: AdminSupplierSettlement;
  canWrite: boolean;
  onRemoveCredit: (application: AdminSettlementCreditApplication) => void;
}>) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="خلاصه مالی">
          <DetailRows
            rows={[
              ['تأمین‌کننده', settlement.supplierName],
              ['وضعیت دوره', STATUS[settlement.status].label],
              ['تعداد بدهی', formatAdminInteger(settlement.payableCount)],
              ['مبلغ ناخالص', formatAdminToman(settlement.totalAmountToman)],
              ['اعتبار کسرشده', formatAdminToman(settlement.creditAppliedToman)],
              ['مبلغ خالص', formatAdminToman(supplierSettlementNetAmount(settlement))],
              [
                'پرداخت ثبت‌شده',
                settlement.paidAmountToman === null
                  ? 'ثبت نشده'
                  : formatAdminToman(settlement.paidAmountToman),
              ],
            ]}
          />
        </Card>
        <Card title="سابقه دوره">
          <DetailRows
            rows={[
              ['زمان ایجاد', formatAdminDateTime(settlement.createdAt)],
              ['ایجادکننده', actorLabel(settlement.createdBy)],
              ['مرجع پرداخت', settlement.paymentReference ?? 'ثبت نشده'],
              [
                'زمان پرداخت',
                settlement.paidAt ? formatAdminDateTime(settlement.paidAt) : 'ثبت نشده',
              ],
              ['ثبت پرداخت توسط', actorLabel(settlement.paidBy)],
              [
                'زمان لغو',
                settlement.cancelledAt ? formatAdminDateTime(settlement.cancelledAt) : 'ثبت نشده',
              ],
              ['لغو توسط', actorLabel(settlement.cancelledBy)],
              ['یادداشت', settlement.note ?? 'ثبت نشده'],
            ]}
          />
        </Card>
      </div>
      <Card
        title={`اقلام بدهی · ${formatAdminInteger(settlement.payableCount)} رکورد`}
        description="همه اقلام این batch متعلق به یک تأمین‌کننده هستند."
      >
        <SettlementItems settlement={settlement} />
      </Card>
      <Card
        title={`اعتبارهای اعمال‌شده · ${formatAdminInteger(settlement.creditApplications.length)} رکورد`}
        description="اعتبار فقط پیش از پرداخت نهایی قابل اعمال یا حذف است."
      >
        <SettlementCredits settlement={settlement} canWrite={canWrite} onRemove={onRemoveCredit} />
      </Card>
    </div>
  );
}

function normalizeMoneyInput(value: string): string {
  return toPersianDigits(toAsciiDigits(value).replace(/\D/g, ''));
}

function requestError(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام عملیات مالی را ندارید.';
  if (status === 404) return 'دوره، بدهی یا اعتبار انتخاب‌شده پیدا نشد.';
  if (status === 409)
    return 'وضعیت بدهی، اعتبار یا دوره هم‌زمان تغییر کرده است؛ صفحه را تازه کنید.';
  if (status === 400 || status === 422)
    return 'اطلاعات واردشده معتبر نیست یا اقلام به یک تأمین‌کننده تعلق ندارند.';
  return 'عملیات تسویه انجام نشد. دوباره تلاش کنید.';
}

function detailError(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز مشاهده اطلاعات مالی را ندارید.';
  if (status === 404) return 'دوره تسویه پیدا نشد.';
  return 'جزئیات دوره دریافت نشد. دوباره تلاش کنید.';
}

export function SupplierSettlementsView({
  settlements,
  payables,
  credits,
  failed,
  canWrite,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [selected, setSelected] = useState<AdminSupplierSettlement | null>(null);
  const [detail, setDetail] = useState<AdminSupplierSettlement | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErrorMessage, setDetailErrorMessage] = useState('');
  const [action, setAction] = useState<SettlementAction | null>(null);
  const [actionSupplierId, setActionSupplierId] = useState('');
  const [selectedPayableIds, setSelectedPayableIds] = useState<readonly string[]>([]);
  const [selectedCreditId, setSelectedCreditId] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const detailRequest = useRef(0);
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const readyPayables = useMemo(
    () => payables.filter((payable) => payable.status === 'OPEN' && !payable.settlementId),
    [payables],
  );
  const readySuppliers = useMemo(
    () =>
      [
        ...new Map(
          readyPayables.map((payable) => [payable.supplierId, payable.supplierName]),
        ).entries(),
      ]
        .map(([id, name]) => ({ value: id, label: name }))
        .sort((first, second) => first.label.localeCompare(second.label, 'fa')),
    [readyPayables],
  );
  const suppliers = useMemo(
    () =>
      [...new Map(settlements.map((item) => [item.supplierId, item.supplierName])).entries()]
        .map(([id, name]) => ({ value: id, label: name }))
        .sort((first, second) => first.label.localeCompare(second.label, 'fa')),
    [settlements],
  );
  const actionPayables = readyPayables.filter((payable) => payable.supplierId === actionSupplierId);
  const selectedPayableTotal = actionPayables
    .filter((payable) => selectedPayableIds.includes(payable.id))
    .reduce((sum, payable) => sum + payable.amountToman, 0);

  const totals = useMemo(
    () => ({
      draftNet: settlements
        .filter((item) => item.status === 'DRAFT')
        .reduce((sum, item) => sum + supplierSettlementNetAmount(item), 0),
      appliedCredit: settlements.reduce((sum, item) => sum + item.creditAppliedToman, 0),
      paidCash: settlements
        .filter((item) => item.status === 'PAID')
        .reduce((sum, item) => sum + (item.paidAmountToman ?? 0), 0),
      draftCount: settlements.filter((item) => item.status === 'DRAFT').length,
      paidCount: settlements.filter((item) => item.status === 'PAID').length,
      cancelledCount: settlements.filter((item) => item.status === 'CANCELLED').length,
    }),
    [settlements],
  );

  const filtered = useMemo(
    () =>
      settlements.filter((settlement) => {
        if (statusFilter !== 'all' && settlement.status !== statusFilter) return false;
        if (supplierFilter !== 'all' && settlement.supplierId !== supplierFilter) return false;
        if (!needle) return true;
        return [
          settlement.id,
          settlement.supplierName,
          settlement.paymentReference ?? '',
          settlement.note ?? '',
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [needle, settlements, statusFilter, supplierFilter],
  );

  const actionSettlement = action && action.kind !== 'create' ? action.settlement : null;
  const availableCredits = actionSettlement
    ? credits.filter(
        (credit) =>
          credit.supplierId === actionSettlement.supplierId &&
          (credit.status === 'AVAILABLE' || credit.status === 'PARTIALLY_APPLIED') &&
          supplierCreditRemainingAmount(credit) > 0,
      )
    : [];
  const selectedCredit = availableCredits.find((credit) => credit.id === selectedCreditId) ?? null;
  const maximumCredit =
    actionSettlement && selectedCredit
      ? Math.min(
          supplierSettlementNetAmount(actionSettlement),
          supplierCreditRemainingAmount(selectedCredit),
        )
      : 0;

  async function openDetails(settlement: AdminSupplierSettlement, mode: Exclude<DetailMode, null>) {
    const requestId = detailRequest.current + 1;
    detailRequest.current = requestId;
    setSelected(settlement);
    setDetail(settlement);
    setDetailMode(mode);
    setDetailLoading(true);
    setDetailErrorMessage('');
    try {
      const response = await fetch(
        `/api/supplier-settlements/${encodeURIComponent(settlement.id)}`,
      );
      if (requestId !== detailRequest.current) return;
      if (!response.ok) {
        setDetailErrorMessage(detailError(response.status));
        return;
      }
      const parsed = parseSupplierSettlement(await response.json());
      if (!parsed) {
        setDetailErrorMessage('پاسخ جزئیات دوره معتبر نیست.');
        return;
      }
      setDetail(parsed);
    } catch {
      if (requestId === detailRequest.current) {
        setDetailErrorMessage('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
      }
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }

  function closeDetails() {
    detailRequest.current += 1;
    setSelected(null);
    setDetail(null);
    setDetailMode(null);
    setDetailLoading(false);
    setDetailErrorMessage('');
  }

  function resetActionFields() {
    setSelectedPayableIds([]);
    setSelectedCreditId('');
    setAmount('');
    setReference('');
    setNote('');
    setReason('');
    setError('');
  }

  function openCreate() {
    resetActionFields();
    setActionSupplierId(readySuppliers[0]?.value ?? '');
    setAction({ kind: 'create' });
  }

  function openSettlementAction(
    kind: 'apply-credit' | 'pay' | 'cancel',
    settlement: AdminSupplierSettlement,
  ) {
    closeDetails();
    resetActionFields();
    if (kind === 'apply-credit') {
      const firstCredit = credits.find(
        (credit) =>
          credit.supplierId === settlement.supplierId &&
          (credit.status === 'AVAILABLE' || credit.status === 'PARTIALLY_APPLIED') &&
          supplierCreditRemainingAmount(credit) > 0,
      );
      setSelectedCreditId(firstCredit?.id ?? '');
      if (firstCredit) {
        setAmount(
          toPersianDigits(
            Math.min(
              supplierSettlementNetAmount(settlement),
              supplierCreditRemainingAmount(firstCredit),
            ),
          ),
        );
      }
      setAction({
        kind,
        settlement,
        idempotencyKey: `admin-settlement-credit-${crypto.randomUUID()}`,
      });
      return;
    }
    setAction({ kind, settlement });
  }

  function openRemoveCredit(
    settlement: AdminSupplierSettlement,
    application: AdminSettlementCreditApplication,
  ) {
    closeDetails();
    resetActionFields();
    setAction({ kind: 'remove-credit', settlement, application });
  }

  async function submitAction() {
    if (!action || pending) return;
    let path: string;
    let body: object;
    let successMessage: string;
    const normalizedNote = note.trim();
    if (normalizedNote && normalizedNote.length < 3) {
      setError('یادداشت باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (action.kind === 'create') {
      if (!actionSupplierId || selectedPayableIds.length === 0) {
        setError('حداقل یک بدهی را برای ساخت دوره انتخاب کنید.');
        return;
      }
      const validIds = new Set(actionPayables.map((payable) => payable.id));
      if (selectedPayableIds.some((id) => !validIds.has(id))) {
        setError('اقلام انتخاب‌شده به یک تأمین‌کننده تعلق ندارند.');
        return;
      }
      path = '/api/supplier-settlements';
      body = {
        payableIds: selectedPayableIds,
        ...(normalizedNote ? { note: normalizedNote } : {}),
      };
      successMessage = 'دوره تسویه با موفقیت ساخته شد.';
    } else if (action.kind === 'apply-credit') {
      const numericAmount = Number(toAsciiDigits(amount));
      if (!selectedCredit || !Number.isSafeInteger(numericAmount) || numericAmount < 1) {
        setError('اعتبار و مبلغ معتبر را انتخاب کنید.');
        return;
      }
      if (numericAmount > maximumCredit) {
        setError('مبلغ از مانده اعتبار یا مانده دوره بیشتر است.');
        return;
      }
      path = `/api/supplier-settlements/${encodeURIComponent(action.settlement.id)}/credits`;
      body = {
        supplierCreditId: selectedCredit.id,
        amountToman: numericAmount,
        idempotencyKey: action.idempotencyKey,
      };
      successMessage = 'اعتبار با موفقیت روی دوره اعمال شد.';
    } else if (action.kind === 'remove-credit') {
      const normalizedReason = reason.trim();
      if (normalizedReason.length < 3) {
        setError('دلیل حذف اعتبار باید حداقل ۳ کاراکتر باشد.');
        return;
      }
      path = `/api/supplier-settlements/${encodeURIComponent(action.settlement.id)}/credits/${encodeURIComponent(action.application.id)}/remove`;
      body = { reason: normalizedReason };
      successMessage = 'اعتبار از دوره حذف و مانده آن آزاد شد.';
    } else if (action.kind === 'pay') {
      const normalizedReference = toAsciiDigits(reference.trim());
      if (supplierSettlementNetAmount(action.settlement) > 0 && !normalizedReference) {
        setError('برای پرداخت دارای مبلغ نقدی، مرجع پرداخت را ثبت کنید.');
        return;
      }
      path = `/api/supplier-settlements/${encodeURIComponent(action.settlement.id)}/pay`;
      body = {
        ...(normalizedReference ? { paymentReference: normalizedReference } : {}),
        ...(normalizedNote ? { note: normalizedNote } : {}),
      };
      successMessage = 'پرداخت دوره و بدهی‌های آن با موفقیت ثبت شد.';
    } else {
      const normalizedReason = reason.trim();
      if (normalizedReason.length < 3) {
        setError('دلیل لغو دوره باید حداقل ۳ کاراکتر باشد.');
        return;
      }
      path = `/api/supplier-settlements/${encodeURIComponent(action.settlement.id)}/cancel`;
      body = { reason: normalizedReason };
      successMessage = 'دوره لغو و بدهی‌ها و اعتبارهای آن آزاد شدند.';
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(requestError(response.status));
        return;
      }
      setAction(null);
      setSuccess(successMessage);
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  const shownDetail = detail ?? selected;
  const shownDetailHasAvailableCredit = shownDetail
    ? supplierSettlementNetAmount(shownDetail) > 0 &&
      credits.some(
        (credit) =>
          credit.supplierId === shownDetail.supplierId &&
          (credit.status === 'AVAILABLE' || credit.status === 'PARTIALLY_APPLIED') &&
          supplierCreditRemainingAmount(credit) > 0,
      )
    : false;
  const detailFooter = shownDetail ? (
    <div className="flex flex-wrap justify-end gap-2">
      <ButtonLink href="/supplier-payables" size="sm" variant="outline">
        مشاهده بدهی‌ها
      </ButtonLink>
      <ButtonLink href="/supplier-credits" size="sm" variant="ghost">
        مشاهده اعتبارها
      </ButtonLink>
      {canWrite && shownDetail.status === 'DRAFT' ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={!shownDetailHasAvailableCredit}
            onClick={() => openSettlementAction('apply-credit', shownDetail)}
          >
            اعمال اعتبار
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => openSettlementAction('cancel', shownDetail)}
          >
            لغو دوره
          </Button>
          <Button size="sm" onClick={() => openSettlementAction('pay', shownDetail)}>
            تأیید و ثبت تسویه
          </Button>
        </>
      ) : null}
    </div>
  ) : undefined;
  const detailContent = shownDetail ? (
    <div className="space-y-4">
      {detailLoading ? <Alert tone="info">در حال دریافت اقلام و اعتبارهای دوره…</Alert> : null}
      {detailErrorMessage ? <Alert tone="danger">{detailErrorMessage}</Alert> : null}
      <SettlementDetails
        settlement={shownDetail}
        canWrite={canWrite}
        onRemoveCredit={(application) => openRemoveCredit(shownDetail, application)}
      />
    </div>
  ) : null;

  const columns: readonly DataTableColumn<AdminSupplierSettlement>[] = [
    {
      id: 'supplier',
      header: 'تأمین‌کننده و batch',
      cell: (settlement) => (
        <div>
          <p className="font-bold">{settlement.supplierName}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {toPersianDigits(settlement.id.slice(0, 12))}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (settlement) => <StatusBadge status={settlement.status} />,
    },
    {
      id: 'count',
      header: 'بدهی‌ها',
      align: 'center',
      cell: (settlement) => formatAdminInteger(settlement.payableCount),
    },
    {
      id: 'gross',
      header: 'ناخالص',
      align: 'end',
      visibility: 'lg',
      cell: (settlement) => formatAdminToman(settlement.totalAmountToman),
    },
    {
      id: 'credit',
      header: 'اعتبار',
      align: 'end',
      cell: (settlement) => formatAdminToman(settlement.creditAppliedToman),
    },
    {
      id: 'net',
      header: 'خالص پرداخت',
      align: 'end',
      cell: (settlement) => (
        <strong>{formatAdminToman(supplierSettlementNetAmount(settlement))}</strong>
      ),
    },
    {
      id: 'created',
      header: 'زمان ایجاد',
      visibility: 'lg',
      cell: (settlement) => formatAdminDateTime(settlement.createdAt),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (settlement) => (
        <Button size="sm" variant="outline" onClick={() => void openDetails(settlement, 'desktop')}>
          مدیریت batch
        </Button>
      ),
    },
  ];

  const activeFilterCount =
    Number(Boolean(needle)) + Number(statusFilter !== 'all') + Number(supplierFilter !== 'all');

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="اطلاعات دوره‌های تسویه دریافت نشد">
          اتصال API و دسترسی مالی را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canWrite ? <Alert tone="info">دسترسی شما به دوره‌های تسویه فقط‌خواندنی است.</Alert> : null}

      <section aria-label="شاخص‌های دوره تسویه" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="خالص در انتظار"
          value={formatAdminToman(totals.draftNet)}
          description="مانده نقدی batchهای پیش‌نویس"
          tone={totals.draftNet ? 'warning' : 'success'}
        />
        <Kpi
          label="اعتبار اعمال‌شده"
          value={formatAdminToman(totals.appliedCredit)}
          description="کسرشده از بدهی تأمین‌کنندگان"
          tone="info"
        />
        <Kpi
          label="پرداخت نقدی ثبت‌شده"
          value={formatAdminToman(totals.paidCash)}
          description="مبلغ خالص دوره‌های پرداخت‌شده"
          tone="success"
        />
        <Kpi
          label="دوره پیش‌نویس"
          value={formatAdminInteger(totals.draftCount)}
          description="قابل ویرایش و تسویه"
          tone={totals.draftCount ? 'warning' : 'neutral'}
        />
      </section>

      <Card title="وضعیت دوره‌های تسویه" description="تعداد batchهای فعال و نهایی‌شده">
        <DonutChart
          title="ترکیب وضعیت دوره‌های تسویه تأمین‌کنندگان"
          centerLabel="دوره"
          segments={[
            { label: 'پیش‌نویس', value: totals.draftCount, color: 'var(--admin-color-warning)' },
            { label: 'پرداخت‌شده', value: totals.paidCount, color: 'var(--admin-color-success)' },
            { label: 'لغوشده', value: totals.cancelledCount, color: 'var(--admin-color-danger)' },
          ]}
        />
      </Card>

      <FilterBar
        activeCount={activeFilterCount}
        actions={
          canWrite ? (
            <Button disabled={!readyPayables.length} onClick={openCreate}>
              ایجاد batch تسویه
            </Button>
          ) : undefined
        }
        resetAction={
          activeFilterCount ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setSupplierFilter('all');
              }}
            >
              بازنشانی فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی دوره تسویه"
          value={search}
          placeholder="تأمین‌کننده، شناسه batch یا مرجع پرداخت"
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت دوره"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        />
        <Select
          aria-label="فیلتر تأمین‌کننده دوره"
          value={supplierFilter}
          options={[{ value: 'all', label: 'همه تأمین‌کنندگان' }, ...suppliers]}
          onValueChange={setSupplierFilter}
        />
      </FilterBar>

      <ResponsiveDataView
        caption="دوره‌های تسویه تأمین‌کنندگان"
        mobileLabel="کارت‌های دوره تسویه"
        columns={columns}
        rows={filtered}
        getRowKey={(settlement) => settlement.id}
        emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'دوره تسویه‌ای ثبت نشده است'}
        emptyDescription="بدهی‌های آماده را انتخاب کنید تا اولین batch تسویه ساخته شود."
        renderMobileCard={(settlement) => (
          <MobileDataCard
            detailsOpen={detailMode === 'mobile' && selected?.id === settlement.id}
            onDetailsOpenChange={(open) =>
              open ? void openDetails(settlement, 'mobile') : closeDetails()
            }
            title={settlement.supplierName}
            eyebrow={`batch ${toPersianDigits(settlement.id.slice(0, 12))}`}
            status={<StatusBadge status={settlement.status} />}
            items={[
              { label: 'تعداد بدهی', value: formatAdminInteger(settlement.payableCount) },
              { label: 'مبلغ ناخالص', value: formatAdminToman(settlement.totalAmountToman) },
              { label: 'اعتبار', value: formatAdminToman(settlement.creditAppliedToman) },
              { label: 'خالص', value: formatAdminToman(supplierSettlementNetAmount(settlement)) },
            ]}
            detailsLabel="مشاهده و مدیریت batch"
            detailsTitle={`تسویه ${settlement.supplierName}`}
            detailsDescription={`${STATUS[settlement.status].label} · ${toPersianDigits(settlement.id)}`}
            details={detailContent}
            detailsFooter={detailFooter}
          />
        )}
      />

      <Dialog
        open={detailMode === 'desktop'}
        onOpenChange={(open) => {
          if (!open) closeDetails();
        }}
      >
        <DialogContent
          size="lg"
          title={shownDetail ? `تسویه ${shownDetail.supplierName}` : 'جزئیات دوره تسویه'}
          description={
            shownDetail
              ? `${STATUS[shownDetail.status].label} · ${toPersianDigits(shownDetail.id)}`
              : undefined
          }
          footer={detailFooter}
        >
          {detailContent}
        </DialogContent>
      </Dialog>

      <BottomSheet
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
      >
        <BottomSheetContent
          height="large"
          hideClose={pending}
          title={
            action?.kind === 'create'
              ? 'ایجاد batch تسویه'
              : action?.kind === 'apply-credit'
                ? 'اعمال اعتبار تأمین‌کننده'
                : action?.kind === 'remove-credit'
                  ? 'حذف اعتبار از دوره'
                  : action?.kind === 'pay'
                    ? 'تأیید و ثبت تسویه'
                    : 'لغو دوره تسویه'
          }
          description={
            actionSettlement
              ? `${actionSettlement.supplierName} · ${formatAdminToman(supplierSettlementNetAmount(actionSettlement))}`
              : 'فقط بدهی‌های باز یک تأمین‌کننده قابل تجمیع هستند.'
          }
          footer={
            <>
              <Button variant="outline" disabled={pending} onClick={() => setAction(null)}>
                انصراف
              </Button>
              <Button
                variant={
                  action?.kind === 'cancel' || action?.kind === 'remove-credit'
                    ? 'danger'
                    : 'primary'
                }
                loading={pending}
                onClick={submitAction}
              >
                {action?.kind === 'create'
                  ? 'ساخت دوره'
                  : action?.kind === 'apply-credit'
                    ? 'اعمال اعتبار'
                    : action?.kind === 'remove-credit'
                      ? 'تأیید حذف اعتبار'
                      : action?.kind === 'pay'
                        ? 'ثبت قطعی پرداخت'
                        : 'تأیید لغو دوره'}
              </Button>
            </>
          }
        >
          {action?.kind === 'create' ? (
            <div className="space-y-4">
              <FormField id="settlement-supplier" label="تأمین‌کننده" required>
                {(controlProps) => (
                  <Select
                    {...controlProps}
                    value={actionSupplierId}
                    options={readySuppliers}
                    placeholder="تأمین‌کننده را انتخاب کنید"
                    disabled={pending}
                    onValueChange={(value) => {
                      setActionSupplierId(value);
                      setSelectedPayableIds([]);
                      setError('');
                    }}
                  />
                )}
              </FormField>
              <Card
                title={`بدهی‌های آماده · ${formatAdminInteger(actionPayables.length)} رکورد`}
                description={`جمع انتخاب‌شده: ${formatAdminToman(selectedPayableTotal)}`}
                action={
                  actionPayables.length ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setSelectedPayableIds(
                          selectedPayableIds.length === actionPayables.length
                            ? []
                            : actionPayables.map((payable) => payable.id),
                        )
                      }
                    >
                      {selectedPayableIds.length === actionPayables.length
                        ? 'لغو انتخاب همه'
                        : 'انتخاب همه'}
                    </Button>
                  ) : undefined
                }
              >
                <div className="grid max-h-72 gap-3 overflow-y-auto">
                  {actionPayables.map((payable) => (
                    <Checkbox
                      key={payable.id}
                      id={`settlement-payable-${payable.id}`}
                      checked={selectedPayableIds.includes(payable.id)}
                      disabled={pending}
                      label={`${payable.orderItem.productName} · سفارش ${toPersianDigits(payable.order.orderNumber)}`}
                      description={`${formatAdminToman(payable.amountToman)} · ${toPersianDigits(payable.orderItem.sku)}`}
                      onChange={(event) =>
                        setSelectedPayableIds((current) =>
                          event.target.checked
                            ? [...current, payable.id]
                            : current.filter((id) => id !== payable.id),
                        )
                      }
                    />
                  ))}
                  {!actionPayables.length ? (
                    <p className="text-sm text-[var(--admin-color-muted)]">
                      بدهی آماده‌ای برای این تأمین‌کننده وجود ندارد.
                    </p>
                  ) : null}
                </div>
              </Card>
              <FormField id="settlement-create-note" label="یادداشت دوره">
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    value={note}
                    maxLength={1000}
                    disabled={pending}
                    placeholder="مثلاً تسویه بدهی‌های نیمه اول شهریور"
                    onChange={(event) => setNote(toPersianDigits(event.target.value))}
                  />
                )}
              </FormField>
            </div>
          ) : action?.kind === 'apply-credit' ? (
            <div className="space-y-4">
              <Alert tone="info">
                اعتبار فقط از همان تأمین‌کننده و حداکثر تا مانده خالص دوره قابل اعمال است.
              </Alert>
              <FormField id="settlement-credit" label="اعتبار قابل استفاده" required>
                {(controlProps) => (
                  <Select
                    {...controlProps}
                    value={selectedCreditId}
                    options={availableCredits.map((credit) => ({
                      value: credit.id,
                      label: `${formatAdminToman(supplierCreditRemainingAmount(credit))} · سفارش ${toPersianDigits(credit.order.orderNumber)}`,
                    }))}
                    placeholder="اعتبار را انتخاب کنید"
                    disabled={pending || !availableCredits.length}
                    onValueChange={(value) => {
                      const credit = availableCredits.find((item) => item.id === value);
                      setSelectedCreditId(value);
                      setAmount(
                        credit && actionSettlement
                          ? toPersianDigits(
                              Math.min(
                                supplierSettlementNetAmount(actionSettlement),
                                supplierCreditRemainingAmount(credit),
                              ),
                            )
                          : '',
                      );
                      setError('');
                    }}
                  />
                )}
              </FormField>
              <FormField
                id="settlement-credit-amount"
                label="مبلغ اعتبار"
                required
                hint={`حداکثر قابل اعمال: ${formatAdminToman(maximumCredit)}`}
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    dir="ltr"
                    inputMode="numeric"
                    value={amount}
                    disabled={pending || !selectedCredit}
                    placeholder="مثلاً ۵۰۰۰۰۰"
                    onChange={(event) => {
                      setAmount(normalizeMoneyInput(event.target.value));
                      setError('');
                    }}
                  />
                )}
              </FormField>
            </div>
          ) : action?.kind === 'pay' ? (
            <div className="space-y-4">
              <Alert tone="warning">
                ثبت پرداخت قطعی است و همه بدهی‌های این batch را پرداخت‌شده می‌کند. مبلغ خالص قابل
                پرداخت {formatAdminToman(supplierSettlementNetAmount(action.settlement))} است.
              </Alert>
              <FormField
                id="settlement-payment-reference"
                label="مرجع پرداخت"
                required={supplierSettlementNetAmount(action.settlement) > 0}
                hint="شماره پیگیری بانکی، حواله یا سند مالی"
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    value={reference}
                    maxLength={255}
                    disabled={pending}
                    placeholder="مثلاً TRX-1405-0012"
                    onChange={(event) => setReference(toPersianDigits(event.target.value))}
                  />
                )}
              </FormField>
              <FormField id="settlement-payment-note" label="یادداشت پرداخت">
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    value={note}
                    maxLength={1000}
                    disabled={pending}
                    placeholder="توضیحات تکمیلی پرداخت یا سند مالی"
                    onChange={(event) => setNote(toPersianDigits(event.target.value))}
                  />
                )}
              </FormField>
            </div>
          ) : action ? (
            <div className="space-y-4">
              <Alert tone="danger">
                {action.kind === 'remove-credit'
                  ? 'با حذف، مبلغ اعتبار از batch کم و مانده اعتبار برای استفاده مجدد آزاد می‌شود.'
                  : 'با لغو، همه بدهی‌های batch و اعتبارهای فعال آن به‌صورت اتمیک آزاد می‌شوند.'}
              </Alert>
              <FormField
                id="settlement-action-reason"
                label={action.kind === 'remove-credit' ? 'دلیل حذف اعتبار' : 'دلیل لغو دوره'}
                required
              >
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    value={reason}
                    maxLength={1000}
                    disabled={pending}
                    placeholder="دلیل تصمیم را برای سابقه مالی ثبت کنید."
                    onChange={(event) => {
                      setReason(toPersianDigits(event.target.value));
                      setError('');
                    }}
                  />
                )}
              </FormField>
            </div>
          ) : null}
          {error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
