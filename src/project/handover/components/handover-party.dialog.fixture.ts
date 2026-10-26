const spec = {
  componentName: 'HandoverPartyDialogShell',
  specPath: 'src/project/handover/components/handover-party.dialog.fixture.ts',
  title: 'Thông tin đối tượng',
  titleMessageId: 'project.handover.partyDialog.title',
  width: '2xl',
  actions: [
    {
      name: 'save',
      label: 'Lưu thông tin',
      labelMessageId: 'project.handover.partyDialog.save',
      variant: 'primary',
      disabledProp: 'isInvalid',
    },
  ],
} as const;

export default spec;
