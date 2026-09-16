import { useRef, useState, type ReactNode } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState } from '@tanstack/react-table';
import type { LucideIcon } from 'lucide-react';
import {
  CircleCheck,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  Grid2X2,
  List,
  ReceiptText,
  Trash2,
  TriangleAlert,
  Upload,
  WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { createSignedStorageUrl } from '@/lib/storage';
import { useNumberFormat } from '@/providers/number-format-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { CardEmptyState } from '@/components/ui/card-empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileUploadContent,
  type FileUploadContentHandle,
} from '@/components/ui/file-upload/file-upload-content';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { Progress, ProgressCircle } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getDashboardPaymentPlanRange } from '../../dashboard/model/dashboard';
import { buildOfficeViewerUrl, isOfficeDocument } from '../../files/model/file';
import { PaymentPlanChart } from '../../shared/components/payment-plan-chart';
import {
  activateContract,
  deleteContractAttachment,
  updateContractVersionEffectiveDate,
  uploadContractAttachments,
} from '../api/contracts.api';
import type { ContractDetail } from '../api/contracts.api';
import {
  useContractReceivableList,
  type ContractReceivableListFilters,
  type ContractReceivableSortOption,
} from '../hooks/use-contract-receivable-list';
import type { ContractVersion } from '../model/contract';
import {
  buildContractFeePaymentProgressData,
  buildContractPaymentPlanData,
} from '../model/contract-chart';
import {
  CONTRACT_CHARGE_DISPLAY_STATUS_LABELS,
  CONTRACT_CHARGE_DISPLAY_STATUSES,
  type ContractReceivableViewMode,
} from '../model/receivable';
import { useContractReceivableTableRowColumns } from '../table/contract-receivable.columns.generated';
import { ContractReceivableFilterBar } from '../table/contract-receivable.filters.generated';
import { useContractVersionColumns } from '../table/contract-version.columns.generated';
import { ContractReceivableViewSwitcher } from './contract-receivable-view-switcher.generated';
import { ContractStatusBadge } from './contract-status-badge';

const RECEIVABLE_SORT_OPTIONS: Array<{
  value: ContractReceivableSortOption;
  label: string;
}> = [
  { value: 'periodStart_desc', label: 'Kỳ mới nhất' },
  { value: 'periodStart_asc', label: 'Kỳ cũ nhất' },
  { value: 'dueDate_desc', label: 'Hạn thanh toán mới nhất' },
  { value: 'dueDate_asc', label: 'Hạn thanh toán cũ nhất' },
  { value: 'amount_desc', label: 'Số tiền cao nhất' },
  { value: 'amount_asc', label: 'Số tiền thấp nhất' },
];

const RECEIVABLE_FILTER_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  ...CONTRACT_CHARGE_DISPLAY_STATUSES.map((status) => ({
    value: status,
    label: CONTRACT_CHARGE_DISPLAY_STATUS_LABELS[status],
  })),
];

const RECEIVABLE_PLAN_YEARS = Array.from(
  { length: 8 },
  (_, index) => new Date().getFullYear() - 2 + index,
);

function formatDate(value: string | null | undefined) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`));
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const PAYMENT_METRIC_TONE_CLASSES = {
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive',
} as const;

function PaymentMetric({
  icon: Icon,
  iconTone,
  label,
  value,
  emphasis = false,
  className = '',
}: {
  icon: LucideIcon;
  iconTone: keyof typeof PAYMENT_METRIC_TONE_CLASSES;
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${PAYMENT_METRIC_TONE_CLASSES[iconTone]}`}
      >
        <Icon className="size-4" />
      </span>
      <p className="min-w-0 flex-1 truncate text-xs text-foreground">{label}</p>
      <p
        className={`shrink-0 truncate text-sm font-semibold tabular-nums ${emphasis ? 'text-primary' : 'text-foreground'}`}
      >
        {value}
      </p>
    </div>
  );
}

function ContractFinancialOverview({ contract }: { contract: ContractDetail }) {
  const { formatCurrency } = useNumberFormat();
  const summary = contract.financialSummary;
  const headlineTotal = summary.totalContractValue ?? summary.totalIncurred;
  const headlineLabel =
    summary.totalContractValue === null
      ? 'Tổng đã phát sinh'
      : 'Tổng giá trị hợp đồng';
  const progress = summary.progressPercent;
  const formattedProgress = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(progress);

  return (
    <Card className="min-w-0 overflow-hidden xl:h-72">
      <CardHeader>
        <CardHeading>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <WalletCards className="size-4" />
            </span>
            <CardTitle>Tình hình thanh toán</CardTitle>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-1 lg:flex-row lg:items-start">
        <div
          className="flex shrink-0 justify-center lg:justify-start"
          aria-label={`Đã thanh toán ${formattedProgress}%`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <ProgressCircle
            value={progress}
            size={148}
            strokeWidth={11}
            indicatorClassName="text-emerald-500"
            trackClassName="text-muted"
          >
            <div className="flex flex-col items-center text-center">
              <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formattedProgress}%
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                Đã thanh toán
              </span>
            </div>
          </ProgressCircle>
        </div>
        <div className="min-w-0 flex-1 divide-y divide-border">
          <PaymentMetric
            icon={FileText}
            iconTone="info"
            label={headlineLabel}
            value={formatCurrency(headlineTotal, contract.currencyCode)}
            className="py-2.5 first:pt-0 last:pb-0"
          />
          <PaymentMetric
            icon={CircleCheck}
            iconTone="success"
            label="Đã thanh toán"
            value={formatCurrency(summary.totalPaid, contract.currencyCode)}
            className="py-2.5 first:pt-0 last:pb-0"
          />
          <PaymentMetric
            icon={WalletCards}
            iconTone="warning"
            label="Còn phải thu"
            value={formatCurrency(
              summary.totalOutstanding,
              contract.currencyCode,
            )}
            emphasis
            className="py-2.5 first:pt-0 last:pb-0"
          />
          <PaymentMetric
            icon={TriangleAlert}
            iconTone="danger"
            label="Quá hạn"
            value={formatCurrency(
              summary.overdueOutstanding,
              contract.currencyCode,
            )}
            className="py-2.5 first:pt-0 last:pb-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ContractFeePaymentOverview({
  contract,
}: {
  contract: ContractDetail;
}) {
  const { formatCurrency } = useNumberFormat();
  const feeData = buildContractFeePaymentProgressData(
    contract.charges,
    contract.lines,
  );

  return (
    <Card className="min-w-0 overflow-hidden xl:h-72">
      <CardHeader>
        <CardHeading>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <ReceiptText className="size-4" />
            </span>
            <CardTitle>Công nợ theo khoản phí</CardTitle>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="min-h-0 grow overflow-y-auto pt-1">
        {feeData.length > 0 ? (
          <div className="space-y-4">
            {feeData.map((fee) => {
              const progress =
                fee.totalAmount > 0
                  ? Math.min(100, (fee.paidAmount / fee.totalAmount) * 100)
                  : 0;
              const formattedProgress = new Intl.NumberFormat('vi-VN', {
                maximumFractionDigits: 2,
              }).format(progress);

              return (
                <div key={fee.feeName} className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ReceiptText className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {fee.feeName}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        <span className="font-medium text-primary">
                          {formatCurrency(
                            fee.paidAmount,
                            contract.currencyCode,
                          )}{' '}
                          /{' '}
                          {formatCurrency(
                            fee.totalAmount,
                            contract.currencyCode,
                          )}
                        </span>{' '}
                        <span className="text-muted-foreground">
                          ({formattedProgress}%)
                        </span>
                      </span>
                    </div>
                    <Progress
                      value={progress}
                      aria-label={`${fee.feeName}: đã thanh toán ${formattedProgress}%`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                      className="h-2 bg-muted"
                      indicatorClassName="bg-emerald-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">
            Chưa có dữ liệu khoản phí để hiển thị.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContractChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardHeading>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeading>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function ContractChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function ContractOverviewContent({
  contract,
}: {
  contract: ContractDetail;
}) {
  const { formatCompactCurrency } = useNumberFormat();
  const paymentPlanData = buildContractPaymentPlanData(
    contract.charges,
    getDashboardPaymentPlanRange(),
  );
  const valueFormatter = (value: number) =>
    formatCompactCurrency(value, contract.currencyCode);
  const axisValueFormatter = (value: number) =>
    formatCompactCurrency(value, contract.currencyCode);

  return (
    <>
      <div className="grid min-w-0 items-start gap-admin-page-section xl:grid-cols-2">
        <ContractFinancialOverview contract={contract} />
        <ContractFeePaymentOverview contract={contract} />
      </div>
      <div className="mt-admin-page-section">
        <ContractChartCard title="Kế hoạch thu tiền">
          {paymentPlanData.length > 0 ? (
            <PaymentPlanChart
              data={paymentPlanData}
              valueFormatter={valueFormatter}
              axisValueFormatter={axisValueFormatter}
            />
          ) : (
            <ContractChartEmptyState message="Chưa có dữ liệu kế hoạch thu tiền để hiển thị." />
          )}
        </ContractChartCard>
      </div>
    </>
  );
}

export function ContractReceivablesContent({
  tenantId,
  dueSoonDays,
  contractId,
}: {
  tenantId: string;
  dueSoonDays: number;
  contractId: string;
}) {
  const {
    filters,
    keyword,
    setFilter,
    setKeyword,
    pagination,
    onPaginationChange,
    total,
    listQuery,
    visibleRows,
  } = useContractReceivableList({ tenantId, contractId, dueSoonDays });
  const columns = useContractReceivableTableRowColumns({});
  const table = useReactTable({
    data: visibleRows,
    columns,
    getRowId: (row) => row.id,
    state: { pagination },
    onPaginationChange,
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={listQuery.isLoading}
        isFetching={listQuery.isFetching}
        emptyMessage={
          listQuery.isError
            ? getApiErrorMessage(listQuery.error)
            : 'Chưa có kỳ phải thu'
        }
      >
        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="flex-col items-stretch gap-4 xl:flex-row xl:items-center xl:justify-between">
            <CardHeading>
              <CardTitle>Kỳ thanh toán</CardTitle>
              <ContractReceivableViewSwitcher
                value={filters.view}
                onValueChange={(value) =>
                  setFilter('view', value as ContractReceivableViewMode)
                }
                className="pt-1"
              />
            </CardHeading>
            <CardToolbar className="flex-wrap">
              <Select
                value={String(filters.year)}
                onValueChange={(value) => setFilter('year', Number(value))}
              >
                <SelectTrigger className="w-28" aria-label="Năm kế hoạch">
                  <SelectValue placeholder="Năm" />
                </SelectTrigger>
                <SelectContent>
                  {RECEIVABLE_PLAN_YEARS.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ContractReceivableFilterBar
                keyword={keyword}
                onKeywordChange={setKeyword}
                status={filters.status}
                onStatusChange={(value) =>
                  setFilter(
                    'status',
                    value as ContractReceivableListFilters['status'],
                  )
                }
                statusOptions={RECEIVABLE_FILTER_STATUS_OPTIONS}
                statusRenderOption={(option) =>
                  option.value === 'all' ? (
                    option.label
                  ) : (
                    <ContractStatusBadge
                      status={option.value}
                      direction="receivable"
                      size="sm"
                      showDot
                    />
                  )
                }
                statusRenderValue={(option) =>
                  option?.value === 'all' ? (
                    option.label
                  ) : option ? (
                    <ContractStatusBadge
                      status={option.value}
                      direction="receivable"
                      size="sm"
                      showDot
                    />
                  ) : null
                }
              />
              <Select
                value={filters.sort}
                onValueChange={(value) =>
                  setFilter(
                    'sort',
                    value as ContractReceivableListFilters['sort'],
                  )
                }
              >
                <SelectTrigger
                  className="w-52"
                  aria-label="Sắp xếp kỳ thanh toán"
                >
                  <SelectValue label="Sắp xếp" placeholder="Sắp xếp" />
                </SelectTrigger>
                <SelectContent>
                  {RECEIVABLE_SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardToolbar>
          </CardHeader>
          <CardTable className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="min-w-[1360px]">
                <DataGridTable />
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
          <CardFooter className="justify-between">
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>
    </>
  );
}

export function ContractVersionsContent({
  contract,
  onView,
}: {
  contract: ContractDetail;
  onView: (version: ContractVersion) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const [versionToApply, setVersionToApply] = useState<ContractVersion | null>(
    null,
  );
  const [versionToEditDate, setVersionToEditDate] =
    useState<ContractVersion | null>(null);
  const [effectiveDateDraft, setEffectiveDateDraft] = useState<string | null>(
    null,
  );
  const applyMutation = useMutation({
    mutationFn: (version: ContractVersion) => {
      if (!userId) throw new Error('Chưa xác định tài khoản đăng nhập.');
      return activateContract(contract, userId, version.id, {
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: async (_, version) => {
      toast.success(`Đã áp dụng phiên bản v${version.versionNo}.`);
      setVersionToApply(null);
      await queryClient.invalidateQueries({
        queryKey: ['project', 'contracts'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const effectiveDateMutation = useMutation({
    mutationFn: async () => {
      if (!versionToEditDate) throw new Error('Chưa chọn phiên bản nháp.');
      return updateContractVersionEffectiveDate(
        contract,
        versionToEditDate.id,
        effectiveDateDraft,
      );
    },
    onSuccess: async () => {
      toast.success('Đã cập nhật ngày dự kiến áp dụng.');
      setVersionToEditDate(null);
      await queryClient.invalidateQueries({
        queryKey: ['project', 'contracts'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const columns = useContractVersionColumns({
    onView,
    onPrimary: setVersionToApply,
    onEdit: () =>
      navigate(
        `${ROUTES.PROJECT.CONTRACT_CREATE}?edit=${encodeURIComponent(contract.id)}`,
      ),
    onEditDate: (version) => {
      setVersionToEditDate(version);
      setEffectiveDateDraft(version.effectiveFrom);
    },
  });
  const table = useReactTable({
    data: contract.versions,
    columns,
    getRowId: (row) => row.id,
    state: { pagination },
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
  });

  if (contract.versions.length === 0) {
    return (
      <CardEmptyState
        icon={FileText}
        title="Chưa có phiên bản"
        description="Hợp đồng chưa có phiên bản chính sách."
      />
    );
  }

  return (
    <DataGrid
      table={table}
      recordCount={contract.versions.length}
      emptyMessage="Chưa có phiên bản"
    >
      <Card className="min-h-0 overflow-hidden">
        <CardHeader>
          <CardHeading>
            <CardTitle>Lịch sử phiên bản</CardTitle>
          </CardHeading>
        </CardHeader>
        <CardTable className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="min-w-[920px]">
              <DataGridTable />
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardTable>
        <CardFooter className="justify-between">
          <DataGridPagination />
        </CardFooter>
      </Card>
      <ConfirmDialog
        open={versionToApply !== null}
        onOpenChange={(open) => {
          if (!open && !applyMutation.isPending) setVersionToApply(null);
        }}
        title="Áp dụng phiên bản ngay?"
        description={`Phiên bản v${versionToApply?.versionNo ?? ''} sẽ trở thành phiên bản đang áp dụng và phiên bản hiện tại sẽ được thay thế nếu có.`}
        confirmLabel="Áp dụng ngay"
        onConfirm={() => {
          if (versionToApply && !applyMutation.isPending) {
            applyMutation.mutate(versionToApply);
          }
        }}
      />
      <Dialog
        open={versionToEditDate !== null}
        onOpenChange={(open) => {
          if (!open && !effectiveDateMutation.isPending) {
            setVersionToEditDate(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Đổi ngày dự kiến áp dụng v{versionToEditDate?.versionNo ?? ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium text-foreground">
              Ngày dự kiến áp dụng
            </p>
            <DatePickerInput
              value={effectiveDateDraft}
              valueMode="iso-date"
              onChange={(value) =>
                setEffectiveDateDraft(typeof value === 'string' ? value : null)
              }
              calendarLabel="Chọn ngày dự kiến áp dụng"
              variant="md"
            />
            <p className="text-xs text-muted-foreground">
              Để trống nếu chưa muốn lên lịch áp dụng. Phiên bản vẫn là bản nháp
              cho đến khi được áp dụng.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={effectiveDateMutation.isPending}
              onClick={() => setVersionToEditDate(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={effectiveDateMutation.isPending}
              loadingText="Đang lưu..."
              onClick={() => effectiveDateMutation.mutate()}
            >
              Lưu ngày
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataGrid>
  );
}

export function ContractAttachmentsContent({
  contract,
  userId,
  onChanged,
}: {
  contract: ContractDetail;
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(
    null,
  );
  const fileUploadRef = useRef<FileUploadContentHandle>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<
    ContractDetail['attachments'][number] | null
  >(null);
  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      uploadContractAttachments(contract.tenantId, contract.id, userId, files),
    onSuccess: async () => {
      toast.success('Đã tải tài liệu lên hợp đồng.');
      await onChanged();
    },
    onError: (uploadError) => toast.error(getApiErrorMessage(uploadError)),
  });
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      deleteContractAttachment(contract.tenantId, contract.id, attachmentId),
    onSuccess: async () => {
      setAttachmentToDelete(null);
      toast.success('Đã xóa tài liệu khỏi hợp đồng.');
      await onChanged();
    },
    onError: (deleteError) => toast.error(getApiErrorMessage(deleteError)),
  });

  const handleOpenAttachment = async (
    attachment: ContractDetail['attachments'][number],
  ) => {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      toast.error(
        'Trình duyệt đang chặn cửa sổ xem tệp. Hãy cho phép popup rồi thử lại.',
      );
      return;
    }

    previewWindow.opener = null;
    setOpeningAttachmentId(attachment.id);

    try {
      const signedUrl = await createSignedStorageUrl(
        attachment.storageBucket,
        attachment.storagePath,
      );
      const targetUrl = isOfficeDocument(attachment)
        ? buildOfficeViewerUrl(signedUrl)
        : signedUrl;

      previewWindow.location.href = targetUrl;
    } catch (error) {
      previewWindow.close();
      toast.error(getApiErrorMessage(error));
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardHeading>
            <CardTitle>Tài liệu đính kèm</CardTitle>
          </CardHeading>
          <CardToolbar className="flex-wrap justify-end gap-2">
            <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5">
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="md"
                selected={viewMode === 'table'}
                aria-label="Hiển thị dạng bảng"
                aria-pressed={viewMode === 'table'}
                title="Hiển thị dạng bảng"
                onClick={() => setViewMode('table')}
              >
                <List />
              </Button>
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="md"
                selected={viewMode === 'card'}
                aria-label="Hiển thị dạng thẻ"
                aria-pressed={viewMode === 'card'}
                title="Hiển thị dạng thẻ"
                onClick={() => setViewMode('card')}
              >
                <Grid2X2 />
              </Button>
            </div>
            <div className="h-7 w-px bg-border" aria-hidden="true" />
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={uploadMutation.isPending}
              onClick={() => fileUploadRef.current?.openFileDialog()}
            >
              <Upload />
              Tải tệp lên
            </Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <FileUploadContent
            ref={fileUploadRef}
            onUpload={(files) => uploadMutation.mutateAsync(files)}
            isUploading={uploadMutation.isPending}
            showUploadButton={false}
          >
            {viewMode === 'table' && contract.attachments.length > 0 ? (
              <CardTable>
                <Table className="min-w-[820px] text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tài liệu</TableHead>
                      <TableHead>Dung lượng</TableHead>
                      <TableHead>Ngày tải lên</TableHead>
                      <TableHead>Người upload</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contract.attachments.map((attachment) => (
                      <TableRow key={attachment.id}>
                        <TableCell>
                          <button
                            type="button"
                            disabled={openingAttachmentId === attachment.id}
                            className="flex min-w-0 items-center gap-3 text-left hover:text-primary disabled:cursor-wait disabled:opacity-60"
                            onClick={() =>
                              void handleOpenAttachment(attachment)
                            }
                          >
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate font-medium">
                              {attachment.fileName}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="text-foreground">
                          {formatFileSize(attachment.sizeBytes)}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {formatDate(attachment.createdAt.slice(0, 10))}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {attachment.uploadedByName ?? 'Không xác định'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={openingAttachmentId === attachment.id}
                              className="inline-flex items-center gap-1.5 text-primary hover:underline disabled:cursor-wait disabled:opacity-60"
                              onClick={() =>
                                void handleOpenAttachment(attachment)
                              }
                            >
                              <ExternalLink className="size-4" />
                              Mở file
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              mode="icon"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deleteMutation.isPending}
                              aria-label={`Xóa tệp ${attachment.fileName}`}
                              title="Xóa file"
                              onClick={() => setAttachmentToDelete(attachment)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardTable>
            ) : null}

            {viewMode === 'card' && contract.attachments.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
                {contract.attachments.map((attachment) => {
                  const isImage = attachment.mimeType.startsWith('image/');
                  const FileIcon = isImage
                    ? FileImage
                    : attachment.mimeType.includes('spreadsheet') ||
                        attachment.mimeType.includes('excel')
                      ? FileSpreadsheet
                      : FileText;

                  return (
                    <div
                      key={attachment.id}
                      className="group overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-sm"
                    >
                      <button
                        type="button"
                        disabled={openingAttachmentId === attachment.id}
                        className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
                        onClick={() => void handleOpenAttachment(attachment)}
                      >
                        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/40">
                          {isImage ? (
                            <img
                              src={attachment.url}
                              alt={attachment.fileName}
                              className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                            />
                          ) : (
                            <FileIcon className="size-16 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                      <div className="space-y-2 p-3">
                        <button
                          type="button"
                          disabled={openingAttachmentId === attachment.id}
                          className="block w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary disabled:cursor-wait disabled:opacity-60"
                          title={attachment.fileName}
                          onClick={() => void handleOpenAttachment(attachment)}
                        >
                          {attachment.fileName}
                        </button>
                        <div className="flex items-center justify-between gap-2 text-xs text-foreground">
                          <span>{formatFileSize(attachment.sizeBytes)}</span>
                          <span>
                            {formatDate(attachment.createdAt.slice(0, 10))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="min-w-0 truncate text-xs text-foreground"
                            title={
                              attachment.uploadedByName ?? 'Không xác định'
                            }
                          >
                            {attachment.uploadedByName ?? 'Không xác định'}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            mode="icon"
                            size="sm"
                            className="shrink-0 text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            aria-label={`Xóa tệp ${attachment.fileName}`}
                            title="Xóa file"
                            onClick={() => setAttachmentToDelete(attachment)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {contract.attachments.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center text-center text-sm text-muted-foreground">
                Chưa có tài liệu. Kéo thả tệp vào khu vực này để bắt đầu.
              </div>
            ) : null}
          </FileUploadContent>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={attachmentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setAttachmentToDelete(null);
        }}
        title="Xóa tài liệu?"
        description={`Bạn có chắc muốn xóa tệp "${attachmentToDelete?.fileName ?? ''}" khỏi hợp đồng?`}
        confirmLabel="Xóa tài liệu"
        confirmVariant="destructive"
        onConfirm={() => {
          if (attachmentToDelete) {
            deleteMutation.mutate(attachmentToDelete.id);
          }
        }}
      />
    </>
  );
}
