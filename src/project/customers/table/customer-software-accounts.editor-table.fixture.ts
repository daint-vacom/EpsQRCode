import type { EditorTableSpec } from '@/builders/editor-table';

const spec: EditorTableSpec = {
  entity: 'CustomerSoftwareAccount',
  componentName: 'CustomerSoftwareAccountsEditorTable',
  modelImport: '../model/customer',
  valuesType: 'CustomerFormValues',
  valuesImport: '../model/customer',
  arrayName: 'softwareAccounts',
  specPath:
    'src/project/customers/table/customer-software-accounts.editor-table.fixture.ts',
  tableMinWidthClass: 'min-w-[1160px]',
  toolbar: {
    title: 'Tài khoản phần mềm',
    titleProp: 'toolbarTitle',
    addLabel: 'Thêm tài khoản',
    addVariant: 'outline',
    contentPosition: 'afterAdd',
  },
  viewport: { mode: 'remaining' },
  actions: {
    enabled: true,
    widthClass: 'w-16',
    duplicate: false,
    insert: false,
    delete: true,
  },
  reorder: {
    enabled: true,
    header: '',
    widthClass: 'w-12',
  },
  columns: [
    {
      kind: 'text',
      name: 'softwareName',
      header: 'Tên phần mềm *',
      widthClass: 'min-w-48',
      inputType: 'text',
    },
    {
      kind: 'text',
      name: 'accessUrl',
      header: 'Địa chỉ truy cập',
      widthClass: 'min-w-56',
      inputType: 'url',
    },
    {
      kind: 'text',
      name: 'username',
      header: 'Tài khoản',
      widthClass: 'min-w-44',
      inputType: 'text',
    },
    {
      kind: 'text',
      name: 'password',
      header: 'Mật khẩu',
      widthClass: 'min-w-40',
      inputType: 'password',
    },
    {
      kind: 'text',
      name: 'accountType',
      header: 'Loại tài khoản',
      widthClass: 'w-40',
      inputType: 'text',
    },
    {
      kind: 'date',
      name: 'expiresAt',
      header: 'Ngày hết hạn',
      widthClass: 'w-44',
      format: 'iso',
    },
  ],
};

export default spec;
