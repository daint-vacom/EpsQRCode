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
  ],
} as const;

export default spec;
