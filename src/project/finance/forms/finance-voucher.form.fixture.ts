import type { FormSpec } from '@/builders/form';

const spec = {
  entity: 'FinanceVoucher',
  specPath: 'src/project/finance/forms/finance-voucher.form.fixture.ts',
  schemaImport: '@/project/finance/model/finance',
  schemaName: 'financeVoucherFormSchema',
  valuesType: 'FinanceVoucherFormValues',
  title: 'Phiếu thu chi',
  fields: [
    {
      kind: 'select',
      name: 'voucherType',
      label: 'Loại phiếu',
      options: [
        { value: 'receipt', label: 'Phiếu thu' },
        { value: 'payment', label: 'Phiếu chi' },
      ],
      required: true,
      width: 'normal',
    },
    {
      kind: 'date',
      name: 'voucherDate',
      label: 'Ngày chứng từ',
      required: true,
      width: 'normal',
      format: 'iso',
    },
    {
      kind: 'text',
      name: 'transactionAt',
      label: 'Thời điểm giao dịch',
      required: true,
      width: 'normal',
    },
    {
      kind: 'combobox',
      name: 'accountId',
      label: 'Quỹ/tài khoản',
      optionsFrom: 'prop',
      required: true,
      width: 'normal',
    },
    {
      kind: 'select',
      name: 'partyType',
      label: 'Loại đối tượng',
      options: [
        { value: 'customer', label: 'Khách hàng' },
        { value: 'employee', label: 'Nhân viên' },
        { value: 'other', label: 'Vãng lai' },
      ],
      required: true,
      width: 'normal',
    },
    {
      kind: 'combobox',
      name: 'customerId',
      label: 'Khách hàng',
      optionsFrom: 'prop',
      width: 'normal',
    },
    {
      kind: 'combobox',
      name: 'employeeId',
      label: 'Nhân viên',
      optionsFrom: 'prop',
      width: 'normal',
    },
    {
      kind: 'text',
      name: 'partyName',
      label: 'Tên đối tượng',
      required: true,
      width: 'normal',
    },
    {
      kind: 'text',
      name: 'contactName',
      label: 'Người giao/nhận',
      width: 'normal',
    },
    { kind: 'text', name: 'address', label: 'Địa chỉ', width: 'full' },
    {
      kind: 'textarea',
      name: 'description',
      label: 'Nội dung chung',
      width: 'full',
    },
    {
      kind: 'text',
      name: 'externalReference',
      label: 'Mã giao dịch/chứng từ ngoài',
      width: 'normal',
    },
  ],
} satisfies FormSpec;

export default spec;
