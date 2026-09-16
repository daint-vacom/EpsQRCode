import type { FormSpec } from '@/builders/form';

const spec = {
  entity: 'CustomerDebtPayment',
  specPath: 'src/project/customers/forms/customer-debt-payment.form.fixture.ts',
  schemaImport: '@/project/customers/model/customer-finance',
  schemaName: 'customerDebtPaymentFormSchema',
  valuesType: 'CustomerDebtPaymentFormValues',
  title: 'Thu tiền công nợ',
  fields: [
    {
      kind: 'number',
      name: 'amount',
      label: 'Số tiền thu',
      required: true,
      width: 'normal',
      format: 'currency',
    },
    {
      kind: 'date',
      name: 'voucherDate',
      label: 'Ngày thu',
      required: true,
      width: 'normal',
      format: 'iso',
    },
    {
      kind: 'combobox',
      name: 'accountId',
      label: 'Quỹ/tài khoản',
      optionsFrom: 'prop',
      required: true,
      width: 'full',
    },
    {
      kind: 'text',
      name: 'externalReference',
      label: 'Mã giao dịch',
      width: 'normal',
    },
    {
      kind: 'textarea',
      name: 'description',
      label: 'Diễn giải',
      width: 'full',
    },
  ],
} satisfies FormSpec;

export default spec;
