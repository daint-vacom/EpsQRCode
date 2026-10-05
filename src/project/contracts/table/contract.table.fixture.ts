import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Contract',
  modelImport: '../model/contract',
  specPath: 'src/project/contracts/table/contract.table.fixture.ts',
  columns: [
    { kind: 'select' },
    {
      kind: 'custom',
      id: 'contract',
      header: 'Hợp đồng',
      headerClassName: 'min-w-[440px]',
      size: 480,
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerClassName: 'w-[140px]',
      cellClassName: 'px-3',
      size: 140,
    },
    {
      kind: 'custom',
      id: 'endDate',
      header: 'Ngày hết hạn hợp đồng',
      headerClassName: 'w-[190px]',
      size: 190,
    },
    {
      kind: 'custom',
      id: 'nextDueDate',
      header: 'Hạn thu tiếp theo',
      headerClassName: 'w-[160px]',
      size: 160,
    },
    {
      kind: 'currency',
      id: 'totalOutstanding',
      header: 'Còn phải thu',
      field: 'totalOutstanding',
      headerClassName: 'w-[150px]',
      cellClassName: 'px-3',
      size: 150,
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionCount: 2,
      cellClassName: 'text-center',
    },
  ],
};

export default spec;
