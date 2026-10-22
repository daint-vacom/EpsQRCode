import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'Custodian',
  schemaImport: '../../custodians/model/custodian-form-schema',
  schemaName: 'custodianFormSchema',
  valuesType: 'CustodianFormValues',
  title: 'Thêm chủ thể bàn giao',
  titleMessageId: 'project.handover.custodians.dialogs.createTitle',
  specPath: 'src/project/handover/forms/custodian.form.fixture.ts',
  fields: [
    {
      kind: 'select',
      name: 'sourceKey',
      label: 'Dữ liệu EPS',
      labelMessageId: 'project.handover.custodians.fields.epsSource',
      layout: 'horizontal',
      labelWidth: 'md',
      required: true,
      optionsFrom: 'prop',
    },
    {
      kind: 'select',
      name: 'representativeUserId',
      label: 'Người đại diện',
      labelMessageId: 'project.handover.custodians.fields.representative',
      layout: 'horizontal',
      labelWidth: 'md',
      optionsFrom: 'prop',
    },
  ],
};

export default spec;
