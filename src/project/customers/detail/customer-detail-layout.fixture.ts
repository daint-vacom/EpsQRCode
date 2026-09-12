const spec = {
  componentName: 'CustomerDetailLayout',
  specPath: 'src/project/customers/detail/customer-detail-layout.fixture.ts',
  defaultTab: 'overview',
  tabs: [
    { value: 'overview', label: 'Tổng quan', icon: 'LayoutDashboard' },
    { value: 'contracts', label: 'Hợp đồng', icon: 'FileText' },
    { value: 'employees', label: 'Nhân viên phụ trách', icon: 'Users' },
    { value: 'reports', label: 'Báo cáo', icon: 'BarChart3' },
  ],
} as const;

export default spec;
