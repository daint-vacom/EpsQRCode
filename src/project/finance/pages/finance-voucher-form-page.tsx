import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { loadCustomerSelectOptions } from '@/project/customers/api/customers.api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import {
  loadFinanceAccounts,
  loadFinanceCategories,
  loadFinanceObligations,
  loadFinanceVoucherDetail,
  postFinanceVoucher,
  saveFinanceVoucherDraft,
} from '../api/finance.api';
import {
  FinanceVoucherForm,
  useFinanceVoucherForm,
} from '../forms/finance-voucher-form.generated';
import {
  FINANCE_HANDLING_TYPE_LABELS,
  financeVoucherDefaultValues,
  mapFinanceVoucherToFormValues,
  type FinanceHandlingType,
  type FinanceVoucherLineDraft,
} from '../model/finance';

function newLine(): FinanceVoucherLineDraft {
  return {
    categoryId: '',
    categoryName: '',
    description: '',
    amount: '0',
    handlingType: 'direct',
    relatedContractId: '',
    advanceScope: '',
    allocations: [],
  };
}

export function FinanceVoucherFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: voucherId } = useParams();
  const { tenantId } = useTenant();
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const queryTypeIsPayment =
    new URLSearchParams(location.search).get('type') === 'payment';
  const detailQuery = useQuery({
    queryKey: ['project', 'finance', 'voucher', tenantId, voucherId],
    queryFn: () => loadFinanceVoucherDetail(tenantId!, voucherId!),
    enabled: Boolean(tenantId && voucherId),
  });
  const isPayment =
    queryTypeIsPayment || detailQuery.data?.voucherType === 'payment';
  const form = useFinanceVoucherForm({
    defaultValues: {
      ...financeVoucherDefaultValues,
      voucherType: isPayment ? 'payment' : 'receipt',
    },
  });
  const [lines, setLines] = useState<FinanceVoucherLineDraft[]>([newLine()]);
  const [revision, setRevision] = useState(1);
  const accountsQuery = useQuery({
    queryKey: ['project', 'finance', 'accounts', tenantId],
    queryFn: () => loadFinanceAccounts(tenantId!),
    enabled: Boolean(tenantId),
  });
  const categoriesQuery = useQuery({
    queryKey: ['project', 'finance', 'categories', tenantId],
    queryFn: () => loadFinanceCategories(tenantId!),
    enabled: Boolean(tenantId),
  });
  const customersQuery = useQuery({
    queryKey: ['project', 'finance', 'customers', userId, tenantId],
    queryFn: () => loadCustomerSelectOptions(userId!, tenantId!),
    enabled: Boolean(userId && tenantId),
  });
  const obligationsQuery = useQuery({
    queryKey: ['project', 'finance', 'obligations', tenantId, isPayment],
    queryFn: () =>
      loadFinanceObligations(tenantId!, isPayment ? 'payable' : 'receivable'),
    enabled: Boolean(tenantId),
  });
  useEffect(() => {
    if (!detailQuery.data) return;
    form.reset(mapFinanceVoucherToFormValues(detailQuery.data));
    setRevision(detailQuery.data.revision);
    setLines(
      detailQuery.data.lines.map((line) => ({
        categoryId: line.categoryId,
        categoryName: line.categoryNameSnapshot,
        description: line.description,
        amount: String(line.amount),
        handlingType: line.handlingType,
        relatedContractId: line.relatedContractId ?? '',
        advanceScope: line.advanceScope ?? '',
        allocations: line.allocations,
      })),
    );
  }, [detailQuery.data, form]);
  const accountOptions: SelectOption[] = (accountsQuery.data ?? [])
    .filter((account) => account.isActive)
    .map((account) => ({
      value: account.id,
      label: `${account.code} - ${account.name}`,
    }));
  const categoryOptions: SelectOption[] = (categoriesQuery.data ?? [])
    .filter(
      (category) =>
        category.isActive &&
        (category.direction === 'both' ||
          category.direction === (isPayment ? 'payment' : 'receipt')),
    )
    .map((category) => ({
      value: category.id,
      label: `${category.code} - ${category.name}`,
    }));
  const customerOptions: SelectOption[] = (customersQuery.data ?? []).map(
    (customer) => ({
      value: customer.id,
      label: `${customer.customerCode} - ${customer.name}`,
    }),
  );
  const obligationOptions: SelectOption[] = (obligationsQuery.data ?? [])
    .filter((item) => item.outstandingAmount > 0)
    .map((item) => ({
      value: item.id,
      label: `${item.code} - ${item.partyNameSnapshot} (${item.outstandingAmount.toLocaleString('vi-VN')} đ)`,
    }));
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [lines],
  );
  const saveMutation = useMutation({
    mutationFn: (values: Parameters<typeof saveFinanceVoucherDraft>[3]) =>
      saveFinanceVoucherDraft(
        tenantId!,
        voucherId ?? null,
        revision,
        values,
        lines,
      ),
    onSuccess: (result) => {
      setRevision(result.revision);
      toast.success('Đã lưu phiếu nháp.');
      void queryClient.invalidateQueries({
        queryKey: ['project', 'finance', 'vouchers'],
      });
      navigate(`${ROUTES.PROJECT.FINANCE_VOUCHERS}/${result.id}/edit`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const postMutation = useMutation({
    mutationFn: () => postFinanceVoucher(tenantId!, voucherId!),
    onSuccess: async (result) => {
      toast.success(`Đã ghi nhận phiếu ${result.voucherNo}.`);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['project', 'finance', 'vouchers'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'finance', 'voucher', tenantId, result.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'finance', 'accounts', tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'finance', 'report'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'finance', 'obligations', tenantId],
        }),
      ]);
      navigate(`${ROUTES.PROJECT.FINANCE_VOUCHERS}/${result.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const updateLine = (index: number, patch: Partial<FinanceVoucherLineDraft>) =>
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  const handleSubmit = (
    values: Parameters<typeof saveFinanceVoucherDraft>[3],
  ) => {
    if (!lines.every((line) => line.categoryId && Number(line.amount) > 0)) {
      toast.error('Mỗi dòng cần có khoản mục và số tiền lớn hơn 0.');
      return;
    }
    if (
      !lines.every(
        (line) => line.handlingType !== 'advance' || Boolean(line.advanceScope),
      )
    ) {
      toast.error('Vui lòng chọn phạm vi cho khoản ứng trước.');
      return;
    }
    saveMutation.mutate(values);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:p-5">
      <PageHeader
        title={isPayment ? 'Lập phiếu chi' : 'Lập phiếu thu'}
        icon={isPayment ? Trash2 : Plus}
        className="shrink-0"
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin chung</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceVoucherForm
              form={form}
              onSubmit={handleSubmit}
              accountIdOptions={accountOptions}
              customerIdOptions={customerOptions}
              employeeIdOptions={[]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Chi tiết phiếu</CardTitle>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLines((current) => [...current, newLine()])}
            >
              <Plus className="size-4" /> Thêm dòng
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line, index) => (
              <div
                key={index}
                className="relative grid gap-3 rounded-lg border p-3 md:grid-cols-12"
              >
                <div className="md:col-span-3">
                  <label className="mb-1.5 block text-xs font-semibold">
                    Khoản mục
                  </label>
                  <OptionSelect
                    value={line.categoryId}
                    onChange={(value) =>
                      updateLine(index, {
                        categoryId: value,
                        categoryName:
                          categoryOptions.find(
                            (option) => option.value === value,
                          )?.label ?? '',
                      })
                    }
                    options={categoryOptions}
                    searchable
                    placeholder="Chọn khoản mục"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="mb-1.5 block text-xs font-semibold">
                    Diễn giải
                  </label>
                  <Input
                    value={line.description}
                    onChange={(event) =>
                      updateLine(index, { description: event.target.value })
                    }
                    placeholder="Nội dung dòng"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold">
                    Số tiền
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={line.amount}
                    onChange={(event) =>
                      updateLine(index, {
                        amount: event.target.value,
                        allocations:
                          line.handlingType === 'settlement' &&
                          line.allocations[0]
                            ? [
                                {
                                  ...line.allocations[0],
                                  amount: event.target.value,
                                },
                              ]
                            : line.allocations,
                      })
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold">
                    Cách xử lý
                  </label>
                  <OptionSelect
                    value={line.handlingType}
                    onChange={(value) => {
                      const handlingType = (value ||
                        'direct') as FinanceHandlingType;
                      updateLine(index, {
                        handlingType,
                        advanceScope:
                          handlingType === 'advance'
                            ? line.advanceScope || 'party'
                            : '',
                        allocations:
                          handlingType === 'settlement' ? line.allocations : [],
                      });
                    }}
                    options={Object.entries(FINANCE_HANDLING_TYPE_LABELS)
                      .filter(([key]) => key !== 'refund')
                      .map(([value, label]) => ({ value, label }))}
                    searchable={false}
                  />
                </div>
                {line.handlingType === 'settlement' ? (
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold">
                      Công nợ
                    </label>
                    <OptionSelect
                      value={line.allocations[0]?.obligationId ?? ''}
                      onChange={(value) =>
                        updateLine(index, {
                          allocations: value
                            ? [{ obligationId: value, amount: line.amount }]
                            : [],
                        })
                      }
                      options={obligationOptions}
                      searchable
                      placeholder="Chọn công nợ"
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2" />
                )}
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    aria-label="Xóa dòng"
                    className="absolute end-2 top-2"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, lineIndex) => lineIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            ))}
            <div className="flex justify-end border-t pt-4 text-base font-bold">
              Tổng phiếu: {total.toLocaleString('vi-VN')} đ
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(ROUTES.PROJECT.FINANCE_VOUCHERS)}
          >
            <ArrowLeft className="size-4" /> Quay lại
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={saveMutation.isPending}
            onClick={() => void form.handleSubmit(handleSubmit)()}
          >
            Lưu nháp
          </Button>
          {voucherId ? (
            <Button
              type="button"
              variant="success"
              loading={postMutation.isPending}
              disabled={
                detailQuery.data?.status !== 'draft' || saveMutation.isPending
              }
              onClick={() => postMutation.mutate()}
            >
              Ghi nhận
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
