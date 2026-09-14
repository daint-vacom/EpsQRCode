import type { TableSpec } from '@/builders/table';

const spec = {
  entity: 'FinanceVoucher',
  modelImport: '@/project/finance/model/finance',
  specPath: 'src/project/finance/table/finance-voucher.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'voucherNo',
      field: 'voucherNo',
      header: 'Số phiếu',
      sizePreset: 'compact',
    },
    {
      kind: 'date',
      id: 'voucherDate',
      field: 'voucherDate',
      header: 'Ngày giao dịch',
      sizePreset: 'date',
    },
    {
      kind: 'badge',
      id: 'voucherType',
      field: 'voucherType',
      header: 'Thu/Chi',
      sizePreset: 'short',
      config: {
        receipt: { label: 'Phiếu thu', variant: 'success' },
        payment: { label: 'Phiếu chi', variant: 'destructive' },
      },
    },
    {
      kind: 'text',
      id: 'partyNameSnapshot',
      field: 'partyNameSnapshot',
      header: 'Đối tượng',
      sizePreset: 'identity',
    },
    {
      kind: 'text',
      id: 'description',
      field: 'description',
      header: 'Nội dung',
      sizePreset: 'long',
    },
    {
      kind: 'text',
      id: 'accountName',
      field: 'accountName',
      header: 'Quỹ/tài khoản',
      sizePreset: 'medium',
    },
    {
      kind: 'currency',
      id: 'totalAmount',
      field: 'totalAmount',
      header: 'Tổng tiền',
      sizePreset: 'number',
    },
    {
      kind: 'badge',
      id: 'status',
      field: 'status',
      header: 'Trạng thái',
      sizePreset: 'badge',
      config: {
        draft: { label: 'Nháp', variant: 'outline' },
        posted: { label: 'Đã ghi nhận', variant: 'success' },
        cancelled: { label: 'Đã hủy', variant: 'destructive' },
        reversed: { label: 'Đã đảo', variant: 'warning' },
      },
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionPresets: ['view', 'edit'],
      actionCount: 2,
    },
  ],
} satisfies TableSpec;

export default spec;
