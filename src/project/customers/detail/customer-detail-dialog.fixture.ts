const spec = {
  componentName: 'CustomerDetailDialogShell',
  specPath: 'src/project/customers/detail/customer-detail-dialog.fixture.ts',
  defaultTab: 'general',
  tabs: [
    {
      value: 'general',
      label: 'Thông tin chung',
      icon: 'Info',
      fieldProp: 'generalFields',
      searchTextProp: 'generalSearchText',
      searchMatchCountProp: 'generalSearchMatchCount',
    },
    {
      value: 'custom',
      label: 'Thông tin bổ sung',
      icon: 'List',
      contentMode: 'custom',
      contentProp: 'customContent',
      searchTextProp: 'customSearchText',
      searchMatchCountProp: 'customSearchMatchCount',
    },
    {
      value: 'responsibility',
      label: 'Nhân viên phụ trách',
      icon: 'Users',
      contentMode: 'custom',
      contentProp: 'responsibilityContent',
      searchTextProp: 'responsibilitySearchText',
      searchMatchCountProp: 'responsibilitySearchMatchCount',
    },
    {
      value: 'softwareAccounts',
      label: 'Tài khoản phần mềm',
      icon: 'KeyRound',
      contentMode: 'custom',
      contentProp: 'softwareAccountsContent',
      searchTextProp: 'softwareAccountsSearchText',
      searchMatchCountProp: 'softwareAccountsSearchMatchCount',
    },
  ],
} as const;

export default spec;
