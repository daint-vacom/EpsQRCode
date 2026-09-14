import type { TableSpec } from '@/builders/table';

const spec = {
  entity: 'FinanceAccount',
  modelImport: '@/project/finance/model/finance',
  specPath: 'src/project/finance/table/finance-account.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'code',
      field: 'code',
      header: 'Mã tài khoản',
      sizePreset: 'compact',
    },
    {
      kind: 'text',
      id: 'name',
      field: 'name',
      header: 'Tên tài khoản',
      sizePreset: 'identity',
    },
    {
      kind: 'badge',
      id: 'accountType',
      field: 'accountType',
      header: 'Loại',
      sizePreset: 'short',
      config: { cash: { label: 'Tiền mặt' }, bank: { label: 'Ngân hàng' } },
    },
    {
      kind: 'text',
      id: 'bankAccountNumber',
      field: 'bankAccountNumber',
      header: 'Số tài khoản',
      sizePreset: 'medium',
    },
    {
      kind: 'text',
      id: 'currencyCode',
      field: 'currencyCode',
      header: 'Loại tiền',
      sizePreset: 'compact',
    },
    {
      kind: 'currency',
      id: 'balance',
      field: 'balance',
      header: 'Số dư',
      sizePreset: 'number',
    },
    {
      kind: 'badge',
      id: 'isActive',
      field: 'isActive',
      header: 'Trạng thái',
      sizePreset: 'badge',
      config: {
        true: { label: 'Đang dùng', variant: 'success' },
        false: { label: 'Ngừng dùng', variant: 'outline' },
      },
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionPresets: ['view'],
      actionCount: 1,
    },
  ],
} satisfies TableSpec;

export default spec;
