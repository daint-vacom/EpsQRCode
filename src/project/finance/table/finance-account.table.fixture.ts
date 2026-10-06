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
      size: 112,
      badgeSize: 'sm',
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
      kind: 'currency',
      id: 'balance',
      field: 'balance',
      header: 'Số dư',
      sizePreset: 'number',
    },
    // Render with the domain-owned FinanceAccountStatusBadge so table/select
    // status labels and variants cannot drift apart.
    {
      kind: 'custom',
      id: 'isActive',
      header: 'Trạng thái',
      size: 150,
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionPresets: ['view', 'edit', 'delete'],
      actionCount: 3,
    },
  ],
} satisfies TableSpec;

export default spec;
