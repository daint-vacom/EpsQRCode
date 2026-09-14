import { useMemo, useState, type ReactNode } from 'react';
import { ROUTES } from '@/constants/routes';
import {
  loadFinanceAccounts,
  loadFinanceCashflowReport,
  loadFinanceCategories,
  loadFinanceObligations,
} from '@/project/finance/api/finance.api';
import { formatFinanceAmount } from '@/project/finance/model/finance';
import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { BarChart3, FileText, WalletCards } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { FinanceAccountReportPage } from './finance-account-report-page';

const reports = [
  {
    code: 'finance-cashflow',
    name: 'Thu chi theo khoản mục',
    description: 'Theo dõi tiền thu, chi theo ngày, tài khoản và khoản mục.',
    icon: WalletCards,
  },
  {
    code: 'finance-account-ledger',
    name: 'Sổ quỹ & Tài khoản',
    description: 'Xem các biến động và số dư chạy của từng tài khoản.',
    icon: BarChart3,
  },
  {
    code: 'finance-obligations',
    name: 'Công nợ theo đối tượng',
    description: 'Tổng hợp nghĩa vụ, đã thanh toán, còn nợ và quá hạn.',
    icon: FileText,
  },
] as const;
const dateToday = new Date().toISOString().slice(0, 10);
const dateMonthStart = `${dateToday.slice(0, 8)}01`;

function CashflowReport({ tenantId }: { tenantId: string }) {
  const [from, setFrom] = useState(dateMonthStart);
  const [to, setTo] = useState(dateToday);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const accountsQuery = useQuery({
    queryKey: ['project', 'finance', 'accounts', tenantId],
    queryFn: () => loadFinanceAccounts(tenantId),
  });
  const categoriesQuery = useQuery({
    queryKey: ['project', 'finance', 'categories', tenantId],
    queryFn: () => loadFinanceCategories(tenantId),
  });
  const query = useQuery({
    queryKey: [
      'project',
      'finance',
      'report',
      'cashflow',
      tenantId,
      from,
      to,
      accountId,
      categoryId,
    ],
    queryFn: () =>
      loadFinanceCashflowReport(tenantId, {
        from,
        to,
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
      }),
    enabled: Boolean(from && to),
  });
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const summary = useMemo(
    () =>
      rows.reduce(
        (result, row) => {
          result.receipt += row.voucherType === 'receipt' ? row.amount : 0;
          result.payment += row.voucherType === 'payment' ? row.amount : 0;
          return result;
        },
        { receipt: 0, payment: 0 },
      ),
    [rows],
  );
  const helper = createColumnHelper<(typeof rows)[number]>();
  const columns = [
    helper.accessor('effectiveDate', { header: 'Ngày' }),
    helper.accessor('voucherNo', {
      header: 'Số phiếu',
      cell: (info) => info.getValue() || 'Nháp',
    }),
    helper.accessor('voucherType', {
      header: 'Loại',
      cell: (info) => (info.getValue() === 'receipt' ? 'Thu' : 'Chi'),
    }),
    helper.accessor('categoryName', { header: 'Khoản mục' }),
    helper.accessor('partyName', { header: 'Đối tượng' }),
    helper.accessor('accountName', { header: 'Tài khoản' }),
    helper.accessor('amount', {
      header: 'Số tiền',
      cell: (info) => formatFinanceAmount(info.getValue()),
    }),
  ];
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <ReportCard
      title="Thu chi theo khoản mục"
      error={query.isError ? getApiErrorMessage(query.error) : undefined}
    >
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Từ ngày</label>
          <DatePickerInput
            valueMode="iso-date"
            variant="md"
            calendarLabel="Chọn từ ngày"
            value={from}
            onChange={(value) =>
              setFrom(typeof value === 'string' ? value : '')
            }
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Đến ngày</label>
          <DatePickerInput
            valueMode="iso-date"
            variant="md"
            calendarLabel="Chọn đến ngày"
            value={to}
            onChange={(value) => setTo(typeof value === 'string' ? value : '')}
          />
        </div>
        <OptionSelect
          value={accountId}
          onChange={(value) => setAccountId(value || '')}
          options={(accountsQuery.data ?? []).map((item) => ({
            value: item.id,
            label: `${item.code} - ${item.name}`,
          }))}
          searchable
          placeholder="Tất cả tài khoản"
        />
        <OptionSelect
          value={categoryId}
          onChange={(value) => setCategoryId(value || '')}
          options={(categoriesQuery.data ?? [])
            .filter((item) => item.isActive)
            .map((item) => ({ value: item.id, label: item.name }))}
          searchable
          placeholder="Tất cả khoản mục"
        />
      </div>
      <div className="grid gap-3 py-4 md:grid-cols-3">
        <Metric
          label="Tổng thu"
          value={formatFinanceAmount(summary.receipt)}
          tone="text-success"
        />
        <Metric
          label="Tổng chi"
          value={formatFinanceAmount(summary.payment)}
          tone="text-destructive"
        />
        <Metric
          label="Chênh lệch dòng tiền"
          value={formatFinanceAmount(summary.receipt - summary.payment)}
        />
      </div>
      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={query.isLoading}
        emptyMessage="Không có biến động trong khoảng đã chọn"
      >
        <DataGridTable />
      </DataGrid>
    </ReportCard>
  );
}

function AccountLedgerReport({ tenantId }: { tenantId: string }) {
  return <FinanceAccountReportPage tenantId={tenantId} />;
}

function ObligationReport({ tenantId }: { tenantId: string }) {
  const receivableQuery = useQuery({
    queryKey: [
      'project',
      'finance',
      'report',
      'obligations',
      tenantId,
      'receivable',
    ],
    queryFn: () => loadFinanceObligations(tenantId, 'receivable'),
  });
  const payableQuery = useQuery({
    queryKey: [
      'project',
      'finance',
      'report',
      'obligations',
      tenantId,
      'payable',
    ],
    queryFn: () => loadFinanceObligations(tenantId, 'payable'),
  });
  const rows = [...(receivableQuery.data ?? []), ...(payableQuery.data ?? [])];
  const total = rows.reduce((sum, row) => sum + row.outstandingAmount, 0);
  return (
    <ReportCard
      title="Công nợ theo đối tượng"
      error={
        receivableQuery.isError || payableQuery.isError
          ? getApiErrorMessage(receivableQuery.error || payableQuery.error)
          : undefined
      }
    >
      <div className="py-4">
        <Metric
          label="Tổng còn phải thu/phải trả"
          value={formatFinanceAmount(total)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Mã</th>
              <th className="p-2">Đối tượng</th>
              <th className="p-2">Chiều</th>
              <th className="p-2 text-right">Gốc</th>
              <th className="p-2 text-right">Đã thanh toán</th>
              <th className="p-2 text-right">Còn nợ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2 font-mono text-xs">{row.code}</td>
                <td className="p-2">{row.partyNameSnapshot}</td>
                <td className="p-2">
                  {row.direction === 'receivable' ? 'Phải thu' : 'Phải trả'}
                </td>
                <td className="p-2 text-right">
                  {formatFinanceAmount(row.originalAmount)}
                </td>
                <td className="p-2 text-right">
                  {formatFinanceAmount(row.settledAmount)}
                </td>
                <td className="p-2 text-right font-medium">
                  {formatFinanceAmount(row.outstandingAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

function ReportCard({
  title,
  error,
  children,
}: {
  title: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {error ? (
          <CardDescription className="text-destructive">
            {error}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function Metric({
  label,
  value,
  tone = '',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function ReportPageFrame({
  title,
  icon,
  children,
}: {
  title: string;
  icon: typeof BarChart3;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 pb-8 xl:p-5 xl:pb-10">
      <PageHeader title={title} icon={icon} />
      {children}
    </div>
  );
}

export function ReportsPage() {
  const { reportCode: routeReportCode } = useParams();
  const { pathname } = useLocation();
  const reportCode =
    routeReportCode ??
    (pathname.startsWith(`${ROUTES.PROJECT.REPORTS}/`)
      ? pathname.slice(`${ROUTES.PROJECT.REPORTS}/`.length).split('/')[0]
      : undefined);
  const {
    tenantId,
    isPending: isTenantPending,
    isPermissionsPending,
    isError: isTenantError,
    error: tenantError,
  } = useTenant();
  const { hasPermission } = useUser();
  const report = reports.find((item) => item.code === reportCode);
  const canViewReports = hasPermission('finance:report:view');

  if (report) {
    if (isTenantPending || isPermissionsPending || !tenantId) {
      return (
        <ReportPageFrame title={report.name} icon={report.icon}>
          <div className="py-10 text-center text-sm text-muted-foreground">
            {isTenantError
              ? tenantError?.message || 'Không thể tải dữ liệu báo cáo.'
              : 'Đang tải báo cáo...'}
          </div>
        </ReportPageFrame>
      );
    }

    if (!canViewReports) {
      return (
        <ReportPageFrame title={report.name} icon={report.icon}>
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Bạn chưa được cấp quyền xem báo cáo.
            </CardContent>
          </Card>
        </ReportPageFrame>
      );
    }

    const content =
      report.code === 'finance-cashflow' ? (
        <CashflowReport tenantId={tenantId} />
      ) : report.code === 'finance-account-ledger' ? (
        <AccountLedgerReport tenantId={tenantId} />
      ) : (
        <ObligationReport tenantId={tenantId} />
      );
    return (
      <ReportPageFrame title={report.name} icon={report.icon}>
        {content}
      </ReportPageFrame>
    );
  }
  if (!canViewReports) {
    return (
      <ReportPageFrame title="Báo cáo" icon={BarChart3}>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Bạn chưa được cấp quyền xem báo cáo.
          </CardContent>
        </Card>
      </ReportPageFrame>
    );
  }
  return (
    <ReportPageFrame title="Báo cáo" icon={BarChart3}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((item) => (
          <Link
            key={item.code}
            to={`${ROUTES.PROJECT.REPORTS}/${item.code}`}
            className="group"
          >
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </div>
                <CardTitle className="text-base">{item.name}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </ReportPageFrame>
  );
}
