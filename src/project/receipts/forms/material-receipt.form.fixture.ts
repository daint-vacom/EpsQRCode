import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'MaterialReceipt',
  componentName: 'MaterialReceiptHeaderFormDialog',
  schemaImport: '../model/material-receipt',
  schemaName: 'materialReceiptFormSchema',
  valuesType: 'MaterialReceiptFormValues',
  title: 'Phiếu nhập vật tư',
  titleMessageId: 'receipts.dialogs.formTitle',
  specPath: 'src/project/receipts/forms/material-receipt.form.fixture.ts',
  fields: [
    {
      kind: 'select',
      name: 'warehouseId',
      label: 'Kho nhận',
      labelMessageId: 'receipts.fields.warehouse',
      required: true,
      layout: 'horizontal',
      labelWidth: 'md',
      optionsFrom: 'prop',
    },
    {
      kind: 'textarea',
      name: 'note',
      label: 'Ghi chú',
      labelMessageId: 'receipts.fields.note',
      layout: 'horizontal',
      labelWidth: 'md',
      alignment: 'start',
      rows: 3,
    },
  ],
};

export default spec;
