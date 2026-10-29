const spec = {
  componentName: 'MaterialHandoverPreflightDialogShell',
  specPath:
    'src/project/materials/components/material-handover-preflight.dialog.fixture.ts',
  title: 'Kiểm tra trước khi lập phiếu bàn giao',
  titleMessageId: 'project.materials.bulk.handover.dialog.title',
  width: 'lg',
  actions: [
    {
      name: 'cancel',
      label: 'Đóng',
      labelMessageId: 'project.materials.bulk.handover.dialog.close',
      variant: 'outline',
    },
  ],
} as const;

export default spec;
