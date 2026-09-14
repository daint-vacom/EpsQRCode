import type { TableSpec } from '@/builders/table';

const spec = {
  entity: 'FinanceObligation',
  modelImport: '@/project/finance/model/finance',
  specPath: 'src/project/finance/table/finance-obligation.table.fixture.ts',
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
      actionPresets: ['view'],
      actionCount: 1,
    },
  ],
} satisfies TableSpec;

export default spec;
