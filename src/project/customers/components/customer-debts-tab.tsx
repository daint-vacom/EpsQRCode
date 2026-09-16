import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Plus, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  createFinanceObligation,
  loadFinanceAccounts,
  loadFinanceCategories,
  loadFinanceObligations,
} from '../../finance/api/finance.api';
import { recordCustomerDebtPayment } from '../api/customer-finance.api';
import {
  CustomerDebtFormDialog,
  useCustomerDebtForm,
} from '../forms/customer-debt-form.generated';
import {
  CustomerDebtPaymentFormDialog,
  useCustomerDebtPaymentForm,
} from '../forms/customer-debt-payment-form.generated';
import type { Customer } from '../model/customer';
import {
  customerDebtDefaultValues,
  customerDebtPaymentDefaultValues,
  groupCustomerFinanceObligations,
  isCustomerFinanceObligationActual,
  type CustomerDebtFormValues,
  type CustomerDebtPaymentFormValues,
  type CustomerFinanceObligation,
} from '../model/customer-finance';
import {
  CUSTOMER_FINANCE_OBLIGATION_COLUMN_PINNING,
  useCustomerFinanceObligationColumns,
} from '../table/customer-debt.columns.generated';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CustomerDebtsTab({ customer }: { customer: Customer }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] =
    useState<CustomerFinanceObligation | null>(null);
  const canView =
    hasPermission('finance:obligation:view') ||
    hasPermission('finance:report:view');
  const canCreate = hasPermission('finance:obligation:create');
  const canPay =
    hasPermission('finance:voucher:create') &&
    hasPermission('finance:voucher:post');
  const asOfDate = todayIso();
  const debtQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'finance-obligations',
      tenantId,
      customer.id,
      asOfDate,
    ],
    queryFn: () => loadFinanceObligations(tenantId!, 'receivable', customer.id),
    enabled: Boolean(tenantId && customer.id && canView),
  });
  const accountsQuery = useQuery({
    queryKey: ['project', 'finance', 'accounts', tenantId],
    queryFn: () => loadFinanceAccounts(tenantId!),
    enabled: Boolean(tenantId && paymentDebt && canPay),
  });
  const categoriesQuery = useQuery({
    queryKey: ['project', 'finance', 'categories', tenantId],
    queryFn: () => loadFinanceCategories(tenantId!),
    enabled: Boolean(tenantId && paymentDebt && canPay),
  });
  const createForm = useCustomerDebtForm({
    defaultValues: customerDebtDefaultValues,
  });
  const paymentForm = useCustomerDebtPaymentForm({
    defaultValues: customerDebtPaymentDefaultValues,
  });
  const { reset: resetCreateForm } = createForm;
  const { reset: resetPaymentForm } = paymentForm;

  useEffect(() => {
    if (!createOpen) return;

    resetCreateForm({
      ...customerDebtDefaultValues,
      documentDate: todayIso(),
    });
  }, [createOpen, resetCreateForm]);

  useEffect(() => {
    if (!paymentDebt) return;

    resetPaymentForm({
      ...customerDebtPaymentDefaultValues,
      amount: paymentDebt.outstandingAmount,
      voucherDate: todayIso(),
      description: `Thu tiền công nợ ${paymentDebt.code}`,
    });
  }, [paymentDebt, resetPaymentForm]);

  const createMutation = useMutation({
    mutationFn: (values: CustomerDebtFormValues) =>
      createFinanceObligation(tenantId!, {
        code: values.code,
        description: values.description,
        customerId: customer.id,
        partyNameSnapshot: customer.name,
        direction: 'receivable',
        documentDate: values.documentDate,
        dueDate: values.dueDate,
        originalAmount: values.originalAmount,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      toast.success('Đã tạo công nợ.');
      await queryClient.invalidateQueries({
        queryKey: [
          'project',
          'customers',
          'finance-obligations',
          tenantId,
          customer.id,
        ],
      });
      await queryClient.invalidateQueries({
        queryKey: ['project', 'customers', 'overview', tenantId, customer.id],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const paymentMutation = useMutation({
    mutationFn: (values: CustomerDebtPaymentFormValues) => {
      if (!paymentDebt) throw new Error('Chưa chọn công nợ.');
      if (values.amount > paymentDebt.outstandingAmount) {
        throw new Error('Số tiền thu không được vượt quá số còn phải thu.');
      }
      const category = categoriesQuery.data?.find(
        (item) => item.code === 'thu-cong-no' && item.isActive,
      );
      if (!category) throw new Error('Chưa có khoản mục Thu công nợ.');
      return recordCustomerDebtPayment(
        tenantId!,
        customer,
        paymentDebt,
        values,
        category,
      );
    },
    onSuccess: async () => {
      setPaymentDebt(null);
      toast.success('Đã ghi nhận phiếu thu công nợ.');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            'project',
            'customers',
            'finance-obligations',
            tenantId,
            customer.id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'customers', 'overview', tenantId, customer.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'finance', 'obligations', tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'finance', 'vouchers'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'finance', 'accounts', tenantId],
        }),
      ]);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const debts = useMemo(
    () =>
      groupCustomerFinanceObligations(
        (debtQuery.data ?? []).filter((obligation) =>
          isCustomerFinanceObligationActual(obligation, asOfDate),
        ),
      ),
    [asOfDate, debtQuery.data],
  );

  const handlePayment = useCallback((row: CustomerFinanceObligation) => {
    if (row.outstandingAmount > 0) setPaymentDebt(row);
  }, []);
  const handleView = useCallback(
    (row: CustomerFinanceObligation) =>
      navigate(
        buildPath(ROUTES.PROJECT.FINANCE_OBLIGATION_DETAIL, { id: row.id }),
      ),
    [navigate],
  );
  const columns = useCustomerFinanceObligationColumns({
    onPrimary: canPay ? handlePayment : undefined,
    onView: handleView,
  });

  const table = useReactTable({
    data: debts,
    columns,
    state: { columnPinning: CUSTOMER_FINANCE_OBLIGATION_COLUMN_PINNING },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!canView) {
    return (
      <Card className="flex min-h-56 items-center justify-center p-8 text-center">
        <CardDescription>
          Bạn không có quyền xem công nợ khách hàng.
        </CardDescription>
      </Card>
    );
  }

  if (debtQuery.isError) {
    return (
      <Card className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
        <TriangleAlert className="size-7 text-destructive" />
        <CardDescription>{getApiErrorMessage(debtQuery.error)}</CardDescription>
        <Button variant="outline" onClick={() => void debtQuery.refetch()}>
          Thử lại
        </Button>
      </Card>
    );
  }

  const accountOptions = (accountsQuery.data ?? [])
    .filter((account) => account.isActive)
    .map((account) => ({
      value: account.id,
      label: `${account.code} - ${account.name}`,
    }));

  return (
    <>
      <div className="space-y-admin-page-section">
        <DataGrid
          table={table}
          recordCount={debts.length}
          isLoading={debtQuery.isLoading}
          isFetching={debtQuery.isFetching}
          tableLayout={{ dense: true }}
          emptyMessage="Khách hàng chưa có công nợ"
        >
          <Card className="min-h-0 overflow-hidden">
            <CardHeader>
              <CardHeading>
                <CardTitle>Danh sách công nợ</CardTitle>
                <CardDescription>{debts.length} khoản nợ</CardDescription>
              </CardHeading>
              <CardToolbar>
                {canCreate ? (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" /> Thêm công nợ
                  </Button>
                ) : null}
              </CardToolbar>
            </CardHeader>
            <CardTable className="min-h-0">
              <DataGridTable />
            </CardTable>
          </Card>
        </DataGrid>
      </div>
      <CustomerDebtFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        form={createForm}
        onSubmit={(values) => createMutation.mutate(values)}
        isSaving={createMutation.isPending}
        title={
          <>
            Thêm công nợ:{' '}
            <span className="font-semibold text-primary">{customer.name}</span>
          </>
        }
      />
      <CustomerDebtPaymentFormDialog
        open={Boolean(paymentDebt)}
        onOpenChange={(open) => {
          if (!open && !paymentMutation.isPending) setPaymentDebt(null);
        }}
        mode="create"
        form={paymentForm}
        onSubmit={(values) => paymentMutation.mutate(values)}
        isSaving={paymentMutation.isPending}
        title={
          paymentDebt ? `Thu tiền: ${paymentDebt.code}` : 'Thu tiền công nợ'
        }
        accountIdOptions={accountOptions}
      />
    </>
  );
}
