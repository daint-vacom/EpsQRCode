import type { TableSpec } from '@/builders/table';

const spec = {
  entity: 'CustomerFinanceObligation',
  modelImport: '@/project/customers/model/customer-finance',
  specPath: 'src/project/customers/table/customer-debt.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'code',
      field: 'code',
      header: 'Mã nợ',
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
      id: 'sourceType',
      field: 'sourceType',
      header: 'Nguồn',
      sizePreset: 'short',
    },
    {
      kind: 'text',
      id: 'contractName',
      field: 'contractName',
      header: 'Hợp đồng',
      sizePreset: 'medium',
    },
    {
      kind: 'date',
      id: 'dueDate',
      field: 'dueDate',
      header: 'Hạn thanh toán',
      sizePreset: 'date',
    },
    {
      kind: 'currency',
      id: 'originalAmount',
      field: 'originalAmount',
      header: 'Gốc',
      sizePreset: 'number',
    },
    {
      kind: 'currency',
      id: 'settledAmount',
      field: 'settledAmount',
      header: 'Đã trả',
      sizePreset: 'number',
    },
    {
      kind: 'currency',
      id: 'outstandingAmount',
      field: 'outstandingAmount',
      header: 'Còn nợ',
      sizePreset: 'number',
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionPresets: ['primary', 'view'],
      actionCount: 2,
    },
  ],
} satisfies TableSpec;

export default spec;
