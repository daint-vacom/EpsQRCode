import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import {
  loadFinanceAccountLedgerReport,
  loadFinanceAccounts,
  loadFinanceCashflowReport,
  loadFinanceVouchers,
} from '@/project/finance/api/finance.api';
import { FinanceAccountCashflowChart } from '@/project/finance/charts/finance-account-cashflow.chart.generated';
import { FinanceAccountCategoryChart } from '@/project/finance/charts/finance-account-category.chart.generated';
import { FinanceAccountSelect } from '@/project/finance/components/finance-account-select';
import { formatFinanceAmount } from '@/project/finance/model/finance';
import {
  buildFinanceAccountWeeklyTrend,
  buildFinanceCategoryBreakdown,
  getFinanceBalanceBeforeDate,
  summarizeFinanceAccountActivity,
  withFinanceRunningBalances,
} from '@/project/finance/model/finance-analytics';
import {
  FINANCE_VOUCHER_COLUMN_PINNING,
  useFinanceVoucherColumns,
} from '@/project/finance/table/finance-voucher.columns.generated';
import { useQuery } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';
import {
  ArrowDownToLine,
  ArrowUpRight,
  ClipboardList,
  LineChart,
  PieChart,
  Receipt,
  Scale,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ReportPeriodSelect } from '../components/report-period-select';
import {
  resolveReportPeriod,
  type ReportPeriodKey,
} from '../model/report-period';

interface FinanceAccountReportFilters {
  accountId: string;
  from: string;
  to: string;
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-b-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </span>
      <span
        className={[
          'text-right text-sm font-semibold tabular-nums',
          tone === 'positive' ? 'text-admin-success-text' : '',
          tone === 'negative' ? 'text-admin-red-dark' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function ReportCardHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <CardTitle className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {title}
      </CardTitle>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function formatChartAmount(value: number) {
  if (Math.abs(value) >= 1000000) {
    return (
      (value / 1000000).toLocaleString('vi-VN', {
        maximumFractionDigits: 1,
      }) + ' tr'
    );
  }
  if (Math.abs(value) >= 1000) {
    return (
      (value / 1000).toLocaleString('vi-VN', {
        maximumFractionDigits: 0,
      }) + 'k'
    );
  }
  return value.toLocaleString('vi-VN');
}

export function FinanceAccountReportPage() {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get('accountId') ?? '';
  const initialPeriod = resolveReportPeriod('current-month');
  const [period, setPeriod] = useState<ReportPeriodKey | undefined>(
    initialPeriod.key,
  );
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const [submittedFilters, setSubmittedFilters] =
    useState<FinanceAccountReportFilters>();
  const applyPeriod = (nextPeriod: ReportPeriodKey) => {
    const nextRange = resolveReportPeriod(nextPeriod);
    setPeriod(nextPeriod);
    setFrom(nextRange.from);
    setTo(nextRange.to);
  };
  const handleLoadData = () => {
    if (!accountId || !from || !to || from > to) return;
    setSubmittedFilters({ accountId, from, to });
  };

  const accountQuery = useQuery({
    queryKey: ['project', 'finance', 'accounts', tenantId],
    queryFn: () => loadFinanceAccounts(tenantId!),
    enabled: Boolean(tenantId),
  });
  const account = accountQuery.data?.find((item) => item.id === accountId);
  const submittedAccountId = submittedFilters?.accountId ?? '';
  const submittedFrom = submittedFilters?.from ?? '';
  const submittedTo = submittedFilters?.to ?? '';
  const submittedAccount = accountQuery.data?.find(
    (item) => item.id === submittedAccountId,
  );
  const selectAccount = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set('accountId', value);
    else nextParams.delete('accountId');
    setSearchParams(nextParams);
  };
  const ledgerFrom = submittedAccount?.openingDate ?? submittedFrom;
  const ledgerQuery = useQuery({
    queryKey: [
      'project',
      'finance',
      'account-ledger',
      tenantId,
      submittedAccountId,
      ledgerFrom,
      submittedTo,
    ],
    queryFn: () =>
      loadFinanceAccountLedgerReport(
        tenantId!,
        submittedAccountId,
        ledgerFrom,
        submittedTo,
      ),
    enabled: Boolean(tenantId && submittedFilters && submittedAccount),
  });
  const cashflowQuery = useQuery({
    queryKey: [
      'project',
      'finance',
      'account-cashflow',
      tenantId,
      submittedAccountId,
      ledgerFrom,
      submittedTo,
    ],
    queryFn: () =>
      loadFinanceCashflowReport(tenantId!, {
        from: ledgerFrom,
        to: submittedTo,
        accountId: submittedAccountId,
      }),
    enabled: Boolean(tenantId && submittedFilters && submittedAccount),
  });
  const voucherQuery = useQuery({
    queryKey: [
      'project',
      'finance',
      'report',
      'vouchers',
      tenantId,
      submittedAccountId,
      submittedFrom,
      submittedTo,
    ],
    queryFn: () =>
      loadFinanceVouchers(tenantId!, {
        accountId: submittedAccountId,
        from: submittedFrom,
        to: submittedTo,
        voucherType: 'all',
        status: 'posted',
      }),
    enabled: Boolean(tenantId && submittedFilters && submittedAccount),
  });

  const movements = useMemo(
    () =>
      withFinanceRunningBalances(
        submittedAccount?.openingBalance ?? 0,
        ledgerQuery.data ?? [],
      ),
    [ledgerQuery.data, submittedAccount?.openingBalance],
  );
  const periodRows = useMemo(
    () =>
      movements.filter(
        (row) =>
          row.effectiveDate >= submittedFrom &&
          row.effectiveDate <= submittedTo,
      ),
    [movements, submittedFrom, submittedTo],
  );
  const periodOpening = useMemo(
    () =>
      getFinanceBalanceBeforeDate(
        submittedAccount?.openingBalance ?? 0,
        movements,
        submittedFrom,
      ),
    [movements, submittedAccount?.openingBalance, submittedFrom],
  );
  const summary = useMemo(
    () => summarizeFinanceAccountActivity(periodOpening, periodRows),
    [periodOpening, periodRows],
  );
  const trend = useMemo(
    () =>
      buildFinanceAccountWeeklyTrend(periodOpening, periodRows, {
        from: submittedFrom,
        to: submittedTo,
        maxPoints: 12,
      }),
    [periodOpening, periodRows, submittedFrom, submittedTo],
  );
  const categoryRows = useMemo(
    () =>
      (cashflowQuery.data ?? []).filter(
        (row) =>
          row.effectiveDate >= submittedFrom &&
          row.effectiveDate <= submittedTo,
      ),
    [cashflowQuery.data, submittedFrom, submittedTo],
  );
  const categoryBreakdown = useMemo(
    () => buildFinanceCategoryBreakdown(categoryRows),
    [categoryRows],
  );
  const voucherRows = useMemo(
    () => voucherQuery.data ?? [],
    [voucherQuery.data],
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [submittedAccountId, submittedFrom, submittedTo]);
  const voucherColumns = useFinanceVoucherColumns({
    onView: (row) => navigate(`${ROUTES.PROJECT.FINANCE_VOUCHERS}/${row.id}`),
    showEdit: false,
  });
  const voucherTable = useReactTable({
    data: voucherRows,
    columns: voucherColumns,
    state: {
      columnPinning: FINANCE_VOUCHER_COLUMN_PINNING,
      pagination,
    },
    onPaginationChange: setPagination,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const isLoading =
    accountQuery.isLoading ||
    Boolean(
      submittedFilters &&
      (ledgerQuery.isLoading ||
        cashflowQuery.isLoading ||
        voucherQuery.isLoading),
    );
  const error = accountQuery.isError
    ? getApiErrorMessage(accountQuery.error)
    : ledgerQuery.isError
      ? getApiErrorMessage(ledgerQuery.error)
      : cashflowQuery.isError
        ? getApiErrorMessage(cashflowQuery.error)
        : voucherQuery.isError
          ? getApiErrorMessage(voucherQuery.error)
          : undefined;

  return (
    <div className="flex flex-none flex-col gap-4 pb-8">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1.4fr)_minmax(200px,0.8fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)]">
            <div>
              <Label variant="secondary" className="mb-1.5 block">
                Tài khoản
              </Label>
              <FinanceAccountSelect
                value={accountId}
                accounts={accountQuery.data ?? []}
                loading={accountQuery.isPending}
                emptyMessage={
                  accountQuery.isError
                    ? getApiErrorMessage(accountQuery.error)
                    : 'Không tìm thấy quỹ/tài khoản'
                }
                onChange={(value) => selectAccount(value || '')}
                searchable
                ariaLabel="Tài khoản"
              />
            </div>
            <div>
              <Label variant="secondary" className="mb-1.5 block">
                Khoảng thời gian
              </Label>
              <ReportPeriodSelect
                value={period}
                onChange={applyPeriod}
                size="md"
              />
            </div>
            <div>
              <Label variant="secondary" className="mb-1.5 block">
                Từ ngày
              </Label>
              <DatePickerInput
                aria-label="Từ ngày"
                value={from}
                valueMode="iso-date"
                calendarLabel="Chọn từ ngày"
                variant="md"
                max={to}
                onChange={(value) => {
                  setPeriod(undefined);
                  setFrom(typeof value === 'string' ? value : '');
                }}
              />
            </div>
            <div>
              <Label variant="secondary" className="mb-1.5 block">
                Đến ngày
              </Label>
              <DatePickerInput
                aria-label="Đến ngày"
                value={to}
                valueMode="iso-date"
                calendarLabel="Chọn đến ngày"
                variant="md"
                min={from}
                onChange={(value) => {
                  setPeriod(undefined);
                  setTo(typeof value === 'string' ? value : '');
                }}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              className="min-w-32"
              onClick={handleLoadData}
              disabled={!accountId || !from || !to || from > to || isLoading}
            >
              Tải dữ liệu
            </Button>
          </div>
        </CardContent>
      </Card>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      {accountQuery.isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Đang tải thông tin quỹ/tài khoản...
        </div>
      ) : !submittedFilters && !account ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Chọn một quỹ / tài khoản để xem báo cáo.
        </div>
      ) : !submittedFilters ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Chọn bộ lọc và bấm “Tải dữ liệu” để xem báo cáo.
        </div>
      ) : !submittedAccount ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Tài khoản đã chọn không còn khả dụng. Vui lòng chọn lại và tải dữ
          liệu.
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(310px,0.65fr)]">
            <Card className="min-w-0">
              <CardHeader>
                <ReportCardHeading icon={LineChart} title="Thu chi theo tuần" />
              </CardHeader>
              <CardContent className="pt-0">
                {trend.length ? (
                  <FinanceAccountCashflowChart
                    data={trend}
                    valueFormatter={(value) => formatFinanceAmount(value)}
                    axisValueFormatter={formatChartAmount}
                  />
                ) : (
                  <div className="flex h-80 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
                    Chưa có biến động trong khoảng thời gian đã chọn.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <ReportCardHeading
                  icon={ClipboardList}
                  title="Thống kê chi tiết"
                />
              </CardHeader>
              <CardContent className="pt-0">
                <SummaryRow
                  icon={WalletCards}
                  label="Số dư đầu kỳ"
                  value={formatFinanceAmount(summary.openingBalance)}
                />
                <SummaryRow
                  icon={ArrowDownToLine}
                  label="Tổng thu"
                  value={formatFinanceAmount(summary.totalReceipt)}
                  tone="positive"
                />
                <SummaryRow
                  icon={ArrowUpRight}
                  label="Tổng chi"
                  value={formatFinanceAmount(summary.totalPayment)}
                  tone="negative"
                />
                <SummaryRow
                  icon={Scale}
                  label="Ròng"
                  value={formatFinanceAmount(summary.netChange)}
                  tone={summary.netChange >= 0 ? 'positive' : 'negative'}
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-admin-success-bg/60 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-admin-success-text">
                      <ArrowDownToLine className="size-3.5" /> Giao dịch thu
                    </div>
                    <div className="mt-1 text-lg font-semibold text-admin-success-text">
                      {summary.receiptCount}
                    </div>
                  </div>
                  <div className="rounded-lg bg-admin-red-bg/60 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-admin-red-dark">
                      <ArrowUpRight className="size-3.5" /> Giao dịch chi
                    </div>
                    <div className="mt-1 text-lg font-semibold text-admin-red-dark">
                      {summary.paymentCount}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(290px,0.35fr)]">
            <DataGrid
              table={voucherTable}
              recordCount={voucherRows.length}
              isLoading={isLoading}
              isFetching={
                ledgerQuery.isFetching ||
                cashflowQuery.isFetching ||
                voucherQuery.isFetching
              }
              tableLayout={{ dense: true }}
              emptyMessage="Chưa có phiếu trong khoảng thời gian đã chọn."
            >
              <Card className="min-w-0 overflow-hidden">
                <CardHeader>
                  <ReportCardHeading icon={Receipt} title="Lịch sử giao dịch" />
                </CardHeader>
                <CardTable className="min-h-0">
                  <ScrollArea className="max-h-[34rem]">
                    <DataGridTable />
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardTable>
                <CardFooter className="justify-between">
                  <DataGridPagination sizes={[10, 25, 50]} />
                </CardFooter>
              </Card>
            </DataGrid>

            <Card>
              <CardHeader>
                <ReportCardHeading
                  icon={PieChart}
                  title="Phân bổ theo khoản mục"
                />
              </CardHeader>
              <CardContent className="pt-0">
                {categoryBreakdown.length ? (
                  <>
                    <FinanceAccountCategoryChart
                      data={categoryBreakdown}
                      valueFormatter={(value) => formatFinanceAmount(value)}
                      centerLabel={categoryBreakdown.length}
                      centerCaption="khoản mục"
                    />
                    <div className="space-y-2">
                      {categoryBreakdown.slice(0, 6).map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: item.fill }}
                            />
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="shrink-0 font-medium tabular-nums">
                            {formatFinanceAmount(item.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
                    Chưa có dữ liệu khoản mục.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
