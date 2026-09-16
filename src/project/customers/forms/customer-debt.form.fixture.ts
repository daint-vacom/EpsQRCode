import type { FormSpec } from '@/builders/form';

const spec = {
  entity: 'CustomerDebt',
  specPath: 'src/project/customers/forms/customer-debt.form.fixture.ts',
  schemaImport: '@/project/customers/model/customer-finance',
  schemaName: 'customerDebtFormSchema',
  valuesType: 'CustomerDebtFormValues',
  title: 'Thêm công nợ',
  fields: [
    {
      kind: 'text',
      name: 'code',
      label: 'Mã công nợ',
      required: true,
      width: 'normal',
    },
    {
      kind: 'number',
      name: 'originalAmount',
      label: 'Số tiền',
      required: true,
      width: 'normal',
      format: 'currency',
    },
    {
      kind: 'date',
      name: 'documentDate',
      label: 'Ngày ghi nhận',
      required: true,
      width: 'normal',
      format: 'iso',
    },
    {
      kind: 'date',
      name: 'dueDate',
      label: 'Hạn thanh toán',
      width: 'normal',
      format: 'iso',
    },
    {
      kind: 'textarea',
      name: 'description',
      label: 'Diễn giải',
      required: true,
      width: 'full',
    },
  ],
} satisfies FormSpec;

export default spec;
