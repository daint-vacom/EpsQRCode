import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialQrTrackingRow',
  modelImport: '../model/material-qr-tracking',
  hookName: 'useMaterialQrTrackingColumns',
  specPath: 'src/project/materials/table/material-qr-tracking.table.fixture.ts',
  columns: [
    { kind: 'select' },
    {
      kind: 'custom',
      id: 'availability',
      header: 'Sử dụng',
      headerMessageId: 'materialModels.fields.availability',
      size: 80,
    },
    {
      kind: 'custom',
      id: 'qrCode',
      header: 'Mã QR',
      headerMessageId: 'project.materials.fields.qrCode',
      size: 80,
    },
    {
      kind: 'custom',
      id: 'identity',
      header: 'Vật tư',
      headerMessageId: 'project.materials.fields.identity',
      size: 320,
      headerClassName: 'min-w-[260px]',
    },
    {
      kind: 'custom',
      id: 'scanCount',
      header: 'Lượt quét',
      headerMessageId: 'project.materialQrTracking.columns.scanCount',
      size: 120,
    },
    {
      kind: 'date',
      id: 'lastPrintedAt',
      field: 'lastPrintedAt',
      header: 'Ngày in',
      headerMessageId: 'project.materialQrTracking.columns.lastPrintedAt',
      sizePreset: 'date',
      mode: 'date',
    },
    {
      kind: 'actions',
      header: '',
      actionPresets: ['view', 'primary', 'copy'],
      actionCount: 3,
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
