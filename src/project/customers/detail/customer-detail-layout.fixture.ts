const spec = {
  componentName: 'CustomerDetailLayout',
  specPath: 'src/project/customers/detail/customer-detail-layout.fixture.ts',
  defaultTab: 'overview',
  tabs: [
    { value: 'overview', label: 'Tổng quan', icon: 'LayoutDashboard' },
    { value: 'debts', label: 'Công nợ', icon: 'CircleDollarSign' },
    { value: 'contracts', label: 'Hợp đồng', icon: 'FileText' },
    { value: 'employees', label: 'Nhân viên phụ trách', icon: 'Users' },
    {
      value: 'softwareAccounts',
      label: 'Tài khoản phần mềm',
      icon: 'KeyRound',
    },
  ],
} as const;

export default spec;
