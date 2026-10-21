import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'Warehouse',
  schemaImport: '../model/warehouse',
  schemaName: 'warehouseFormSchema',
  valuesType: 'WarehouseFormValues',
  title: 'Thêm kho',
  titleMessageId: 'warehouses.dialogs.createTitle',
  specPath: 'src/project/warehouses/forms/warehouse.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'code',
      label: 'Mã kho',
      labelMessageId: 'warehouses.fields.code',
      required: true,
      layout: 'horizontal',
      labelWidth: 'md',
    },
    {
      kind: 'text',
      name: 'name',
      label: 'Tên kho',
      labelMessageId: 'warehouses.fields.name',
      required: true,
      layout: 'horizontal',
      labelWidth: 'md',
    },
    {
      kind: 'textarea',
      name: 'address',
      label: 'Địa chỉ',
      labelMessageId: 'warehouses.fields.address',
      rows: 3,
      layout: 'horizontal',
      labelWidth: 'md',
      alignment: 'start',
    },
    {
      kind: 'multiselect',
      name: 'accountUserIds',
      label: 'Tài khoản phụ trách',
      labelMessageId: 'warehouses.fields.accounts',
      optionsFrom: 'prop',
      layout: 'horizontal',
      labelWidth: 'md',
    },
    {
      kind: 'switch',
      name: 'isActive',
      label: 'Đang hoạt động',
      labelMessageId: 'warehouses.fields.availability',
      layout: 'horizontal',
      labelWidth: 'md',
      modes: ['edit'],
    },
  ],
};

export default spec;
