const spec = {
  componentName: 'MaterialSpreadsheetImportDialogShell',
  specPath:
    'src/project/materials/components/material-spreadsheet-import.dialog.fixture.ts',
  title: 'Nhập vật tư từ Excel',
  titleMessageId: 'project.materials.spreadsheet.importTitle',
  width: '2xl',
  actions: [
    {
      name: 'close',
      label: 'Đóng',
      labelMessageId: 'project.materials.spreadsheet.close',
      variant: 'outline',
    },
  ],
} as const;

export default spec;
