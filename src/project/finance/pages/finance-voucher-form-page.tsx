import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { loadContractList } from '@/project/contracts/api/contracts.api';
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
  const selectedPartyType = form.watch('partyType');
  const selectedCustomerId = form.watch('customerId');
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
    queryKey: [
      'project',
      'finance',
      'obligations',
      tenantId,
      isPayment,
      selectedCustomerId,
    ],
    queryFn: () =>
      loadFinanceObligations(
        tenantId!,
        isPayment ? 'payable' : 'receivable',
        selectedCustomerId || undefined,
      ),
    enabled: Boolean(tenantId && selectedCustomerId),
  });
  const contractsQuery = useQuery({
    queryKey: [
      'project',
      'contracts',
      'finance-options',
      tenantId,
      selectedCustomerId,
    ],
    queryFn: () =>
      loadContractList(tenantId!, {
        page: 1,
        pageSize: 100,
        customerId: selectedCustomerId,
      }),
    enabled: Boolean(
      tenantId && selectedPartyType === 'customer' && selectedCustomerId,
    ),
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
  const contractOptions: SelectOption[] = (contractsQuery.data?.contracts ?? [])
    .filter((contract) => contract.status !== 'draft')
    .map((contract) => ({
      value: contract.id,
      label: `${contract.contractCode} - ${contract.name}`,
    }));
  const getObligationOptions = (
    line: FinanceVoucherLineDraft,
    allocationIndex?: number,
  ): SelectOption[] =>
    (obligationsQuery.data ?? [])
      .filter(
        (item) =>
          item.outstandingAmount > 0 &&
          (!line.relatedContractId ||
            item.contractId === line.relatedContractId) &&
          !line.allocations.some(
            (allocation, index) =>
              index !== allocationIndex && allocation.obligationId === item.id,
          ),
      )
      .map((item) => ({
        value: item.id,
        label: `${item.code} - ${item.partyNameSnapshot} (${item.outstandingAmount.toLocaleString('vi-VN')} đ)`,
      }));
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [lines],
  );
  const saveMutation = useMutation({
    mutationFn: ({
      values,
      requestKey,
    }: {
      values: Parameters<typeof saveFinanceVoucherDraft>[3];
      requestKey: string;
    }) =>
      saveFinanceVoucherDraft(
        tenantId!,
        voucherId ?? null,
        revision,
        values,
        lines,
        requestKey,
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
    mutationFn: ({ requestKey }: { requestKey: string }) =>
      postFinanceVoucher(tenantId!, voucherId!, requestKey),
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
  const updateLineAllocation = (
    lineIndex: number,
    allocationIndex: number,
    patch: Partial<FinanceVoucherLineDraft['allocations'][number]>,
  ) =>
    setLines((current) =>
      current.map((line, index) =>
        index === lineIndex
          ? {
              ...line,
              allocations: line.allocations.map((allocation, index) =>
                index === allocationIndex
                  ? { ...allocation, ...patch }
                  : allocation,
              ),
            }
          : line,
      ),
    );
  const removeLineAllocation = (lineIndex: number, allocationIndex: number) =>
    setLines((current) =>
      current.map((line, index) =>
        index === lineIndex
          ? {
              ...line,
              allocations: line.allocations.filter(
                (_, currentIndex) => currentIndex !== allocationIndex,
              ),
            }
          : line,
      ),
    );
  const addLineAllocation = (lineIndex: number) =>
    setLines((current) =>
      current.map((line, index) =>
        index === lineIndex
          ? {
              ...line,
              allocations: [
                ...line.allocations,
                {
                  obligationId: '',
                  amount: line.allocations.length === 0 ? line.amount : '0',
                },
              ],
            }
          : line,
      ),
    );
  const setLineAllocationObligation = (
    lineIndex: number,
    allocationIndex: number,
    obligationId: string,
  ) => {
    if (obligationId) {
      updateLineAllocation(lineIndex, allocationIndex, { obligationId });
    } else {
      removeLineAllocation(lineIndex, allocationIndex);
    }
  };
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
    if (
      lines.some(
        (line) =>
          line.handlingType === 'advance' &&
          line.advanceScope === 'contract' &&
          !line.relatedContractId,
      )
    ) {
      toast.error('Ứng trước theo hợp đồng phải chọn hợp đồng.');
      return;
    }
    if (
      lines.some((line) => {
        if (line.handlingType !== 'settlement') return false;
        const allocationTotal = line.allocations.reduce(
          (sum, allocation) => sum + (Number(allocation.amount) || 0),
          0,
        );
        return allocationTotal > Number(line.amount);
      })
    ) {
      toast.error('Tổng phân bổ không được vượt số tiền của dòng.');
      return;
    }
    saveMutation.mutate({ values, requestKey: crypto.randomUUID() });
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
                          line.allocations.length === 1
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
                      const advanceScope: FinanceVoucherLineDraft['advanceScope'] =
                        handlingType === 'advance'
                          ? line.advanceScope || 'party'
                          : '';
                      updateLine(index, {
                        handlingType,
                        advanceScope,
                        relatedContractId:
                          handlingType === 'direct' ||
                          (handlingType === 'advance' &&
                            advanceScope === 'party')
                            ? ''
                            : line.relatedContractId,
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
                {line.handlingType === 'advance' ? (
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold">
                      Phạm vi ứng trước
                    </label>
                    <OptionSelect
                      value={line.advanceScope}
                      onChange={(value) =>
                        updateLine(index, {
                          advanceScope: (value || 'party') as
                            'party' | 'contract',
                          relatedContractId:
                            value === 'party' ? '' : line.relatedContractId,
                        })
                      }
                      options={[
                        { value: 'party', label: 'Theo khách hàng' },
                        { value: 'contract', label: 'Theo hợp đồng' },
                      ]}
                      searchable={false}
                    />
                  </div>
                ) : null}
                {(line.handlingType === 'settlement' ||
                  (line.handlingType === 'advance' &&
                    line.advanceScope === 'contract')) && (
                  <div className="md:col-span-4">
                    <label className="mb-1.5 block text-xs font-semibold">
                      Hợp đồng
                      {line.handlingType === 'settlement' ? ' (tùy chọn)' : ''}
                    </label>
                    <OptionSelect
                      value={line.relatedContractId}
                      onChange={(value) =>
                        updateLine(index, {
                          relatedContractId: value || '',
                          allocations:
                            line.handlingType === 'settlement'
                              ? line.allocations.filter((allocation) => {
                                  const obligation =
                                    obligationsQuery.data?.find(
                                      (item) =>
                                        item.id === allocation.obligationId,
                                    );
                                  return (
                                    !value || obligation?.contractId === value
                                  );
                                })
                              : line.allocations,
                        })
                      }
                      options={contractOptions}
                      searchable
                      placeholder={
                        contractsQuery.isLoading
                          ? 'Đang tải hợp đồng...'
                          : 'Chọn hợp đồng'
                      }
                    />
                  </div>
                )}
                {line.handlingType === 'settlement' ? (
                  <div className="md:col-span-12 space-y-2 rounded-md bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold">Phân bổ công nợ</span>
                      <span
                        className={
                          line.allocations.reduce(
                            (sum, allocation) =>
                              sum + (Number(allocation.amount) || 0),
                            0,
                          ) === Number(line.amount)
                            ? 'text-success'
                            : 'text-destructive'
                        }
                      >
                        Đã phân bổ{' '}
                        {line.allocations
                          .reduce(
                            (sum, allocation) =>
                              sum + (Number(allocation.amount) || 0),
                            0,
                          )
                          .toLocaleString('vi-VN')}{' '}
                        / {Number(line.amount || 0).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    {line.allocations.map((allocation, allocationIndex) => (
                      <div
                        key={`${index}-${allocationIndex}`}
                        className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]"
                      >
                        <OptionSelect
                          value={allocation.obligationId}
                          onChange={(value) =>
                            setLineAllocationObligation(
                              index,
                              allocationIndex,
                              value || '',
                            )
                          }
                          options={getObligationOptions(line, allocationIndex)}
                          searchable
                          placeholder="Chọn công nợ"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={allocation.amount}
                          onChange={(event) =>
                            updateLineAllocation(index, allocationIndex, {
                              amount: event.target.value,
                            })
                          }
                          aria-label={`Số tiền phân bổ dòng ${allocationIndex + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          mode="icon"
                          aria-label="Xóa phân bổ"
                          onClick={() =>
                            removeLineAllocation(index, allocationIndex)
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-fit"
                      onClick={() => addLineAllocation(index)}
                    >
                      <Plus className="size-4" /> Thêm công nợ phân bổ
                    </Button>
                  </div>
                ) : null}
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
              onClick={() =>
                postMutation.mutate({ requestKey: crypto.randomUUID() })
              }
            >
              Ghi nhận
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
