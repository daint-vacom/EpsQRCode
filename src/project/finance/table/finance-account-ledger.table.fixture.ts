import type { TableSpec } from '@/builders/table';

const spec = {
  entity: 'FinanceAccountLedgerTableRow',
  hookName: 'useFinanceAccountLedgerColumns',
  modelImport: '@/project/finance/model/finance-analytics',
  specPath: 'src/project/finance/table/finance-account-ledger.table.fixture.ts',
  columns: [
    {
      kind: 'date',
      id: 'effectiveDate',
      field: 'effectiveDate',
      header: 'Ngày',
      sizePreset: 'date',
    },
    {
      kind: 'custom',
      id: 'voucherNo',
      header: 'Số phiếu',
      sizePreset: 'compact',
    },
    {
      kind: 'text',
      id: 'description',
      field: 'description',
      header: 'Diễn giải',
      sizePreset: 'long',
    },
    {
      kind: 'text',
      id: 'categoryName',
      field: 'categoryName',
      header: 'Khoản mục',
      sizePreset: 'medium',
    },
    {
      kind: 'text',
      id: 'partyName',
      field: 'partyName',
      header: 'Đối tác',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'receiptAmount',
      header: 'Thu (đ)',
      sizePreset: 'number',
    },
    {
      kind: 'custom',
      id: 'paymentAmount',
      header: 'Chi (đ)',
      sizePreset: 'number',
    },
    {
      kind: 'custom',
      id: 'runningBalance',
      header: 'Số dư (đ)',
      sizePreset: 'number',
    },
    {
      kind: 'actions',
      id: 'actions',
      header: 'Thao tác',
      actionPresets: ['view'],
      actionCount: 1,
    },
  ],
} satisfies TableSpec;

export default spec;
