import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'SoftwareAccountCatalog',
  componentName: 'SoftwareAccountCatalog',
  modelImport: '../model/software-account-catalog',
  schemaImport: '../model/software-account-catalog',
  schemaName: 'softwareAccountCatalogFormSchema',
  valuesType: 'SoftwareAccountCatalogFormValues',
  specPath: 'src/project/tags/forms/software-account-catalog.form.fixture.ts',
  title: 'Tài khoản phần mềm',
  fields: [
    {
      kind: 'text',
      name: 'name',
      label: 'Tên phần mềm',
      required: true,
      width: 'normal',
    },
    {
      kind: 'switch',
      name: 'isActive',
      label: 'Đang sử dụng',
      width: 'normal',
    },
    {
      kind: 'textarea',
      name: 'description',
      label: 'Mô tả',
      rows: 3,
      width: 'full',
    },
    {
      kind: 'text',
      name: 'defaultAccessUrl',
      label: 'Địa chỉ truy cập mặc định',
      inputType: 'url',
      width: 'full',
    },
    {
      kind: 'text',
      name: 'defaultUsername',
      label: 'Tài khoản mặc định',
      width: 'normal',
    },
    {
      kind: 'text',
      name: 'defaultPassword',
      label: 'Mật khẩu mặc định',
      inputType: 'password',
      width: 'normal',
    },
  ],
};

export default spec;
