const spec = {
  componentName: 'MaterialSpreadsheetExportDialogShell',
  specPath:
    'src/project/materials/components/material-spreadsheet-export.dialog.fixture.ts',
  title: 'Xuất danh sách vật tư',
  titleMessageId: 'project.materials.spreadsheet.exportTitle',
  width: '2xl',
  actions: [
    {
      name: 'export',
      label: 'Xuất danh sách vật tư',
      labelMessageId: 'project.materials.spreadsheet.exportNow',
      variant: 'primary',
      icon: 'Download',
      loadingProp: 'isExporting',
      loadingMessageId: 'project.materials.spreadsheet.exporting',
      disabledProp: 'exportDisabled',
    },
  ],
} as const;

export default spec;
