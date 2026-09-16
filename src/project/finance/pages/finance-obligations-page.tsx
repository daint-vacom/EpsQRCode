import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { CircleDollarSign, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTable,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { loadCustomerSelectOptions } from '../../customers/api/customers.api';
import {
  createFinanceObligation,
  loadFinanceObligations,
} from '../api/finance.api';
import {
  FINANCE_OBLIGATION_COLUMN_PINNING,
  useFinanceObligationColumns,
} from '../table/finance-obligation.columns.generated';

export function FinanceObligationsPage() {
  const { tenantId } = useTenant();
  const { userId, hasPermission } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<'receivable' | 'payable'>(
    'receivable',
  );
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const customersQuery = useQuery({
    queryKey: ['project', 'finance', 'obligation-customers', userId, tenantId],
    queryFn: () => loadCustomerSelectOptions(userId!, tenantId!),
    enabled: Boolean(userId && tenantId && open),
  });
  const query = useQuery({
    queryKey: ['project', 'finance', 'obligations', tenantId, direction],
    queryFn: () => loadFinanceObligations(tenantId!, direction),
    enabled: Boolean(tenantId && hasPermission('finance:obligation:view')),
  });
  const mutation = useMutation({
    mutationFn: ({ requestKey }: { requestKey: string }) =>
      createFinanceObligation(
        tenantId!,
        {
          code,
          description,
          customerId,
          direction,
          documentDate,
          dueDate,
          originalAmount: Number(originalAmount),
        },
        requestKey,
      ),
    onSuccess: async () => {
      setOpen(false);
      toast.success('Đã ghi nhận công nợ.');
      await queryClient.invalidateQueries({
        queryKey: ['project', 'finance', 'obligations', tenantId, direction],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const rows = query.data ?? [];
  const columns = useFinanceObligationColumns({
    onView: (row) => navigate(`/finance/obligations/${row.id}`),
  });
  const table = useReactTable({
    data: rows,
    columns,
    state: { columnPinning: FINANCE_OBLIGATION_COLUMN_PINNING },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      <PageHeader
        title="Công nợ"
        icon={CircleDollarSign}
        className="shrink-0"
      />
      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        tableLayout={{ dense: true }}
        emptyMessage={
          query.isError
            ? getApiErrorMessage(query.error)
            : 'Chưa có công nợ đã ghi nhận'
        }
      >
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader>
            <CardTitle>Công nợ theo đối tượng</CardTitle>
            <CardToolbar>
              <OptionSelect
                value={direction}
                onChange={(value) =>
                  setDirection((value || 'receivable') as typeof direction)
                }
                options={[
                  { value: 'receivable', label: 'Phải thu' },
                  { value: 'payable', label: 'Phải trả' },
                ]}
                searchable={false}
                className="w-36"
              />
              {hasPermission('finance:obligation:create') ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setCode('');
                    setDescription('');
                    setCustomerId('');
                    setDocumentDate(new Date().toISOString().slice(0, 10));
                    setDueDate('');
                    setOriginalAmount('');
                    setOpen(true);
                  }}
                >
                  <Plus className="size-4" /> Thêm công nợ
                </Button>
              ) : null}
            </CardToolbar>
          </CardHeader>
          <CardTable className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
        </Card>
      </DataGrid>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Thêm công nợ{' '}
              {direction === 'receivable' ? 'phải thu' : 'phải trả'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Mã công nợ
              </label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="CN-2026-001"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Đối tượng
              </label>
              <OptionSelect
                value={customerId}
                onChange={(value) => setCustomerId(value || '')}
                options={(customersQuery.data ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.customerCode} - ${item.name}`,
                }))}
                searchable
                placeholder="Chọn khách hàng"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Nội dung
              </label>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Phí dịch vụ tháng 09/2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Ngày chứng từ
                </label>
                <Input
                  type="date"
                  value={documentDate}
                  onChange={(event) => setDocumentDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Hạn thanh toán
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Số tiền
              </label>
              <Input
                inputMode="decimal"
                value={originalAmount}
                onChange={(event) => setOriginalAmount(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={mutation.isPending}
              onClick={() => {
                if (
                  !code.trim() ||
                  !description.trim() ||
                  !customerId ||
                  !documentDate ||
                  Number(originalAmount) <= 0
                ) {
                  toast.error(
                    'Vui lòng nhập đủ thông tin công nợ và số tiền lớn hơn 0.',
                  );
                  return;
                }
                mutation.mutate({ requestKey: crypto.randomUUID() });
              }}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
