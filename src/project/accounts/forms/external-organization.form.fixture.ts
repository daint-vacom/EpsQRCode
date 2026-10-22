import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'ExternalOrganization',
  schemaImport: '../model/account',
  schemaName: 'externalOrganizationFormSchema',
  valuesType: 'ExternalOrganizationFormValues',
  title: 'Đơn vị ngoài',
  titleMessageId: 'accounts.external.dialog.title',
  specPath: 'src/project/accounts/forms/external-organization.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'code',
      label: 'Mã đơn vị',
      labelMessageId: 'accounts.external.fields.code',
      required: true,
      layout: 'horizontal',
      labelWidth: 'md',
    },
    {
      kind: 'text',
      name: 'name',
      label: 'Tên đơn vị',
      labelMessageId: 'accounts.external.fields.name',
      required: true,
      layout: 'horizontal',
      labelWidth: 'md',
    },
    {
      kind: 'switch',
      name: 'isActive',
      label: 'Đang hoạt động',
      labelMessageId: 'accounts.external.fields.status',
      layout: 'horizontal',
      labelWidth: 'md',
    },
  ],
};

export default spec;
