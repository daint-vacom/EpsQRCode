const spec = {
  componentName: 'MaterialSelectionDialogShell',
  specPath:
    'src/project/materials/components/material-selection.dialog.fixture.ts',
  title: 'Chọn vật tư',
  titleMessageId: 'project.materials.selection.title',
  width: '2xl',
  actions: [
    {
      name: 'confirm',
      label: 'Xác nhận',
      labelMessageId: 'project.materials.selection.confirm',
      variant: 'primary',
    },
  ],
} as const;

export default spec;
