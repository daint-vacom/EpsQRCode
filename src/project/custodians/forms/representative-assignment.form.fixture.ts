import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'RepresentativeAssignment',
  schemaImport: '../model/representative-assignment',
  schemaName: 'representativeAssignmentFormSchema',
  valuesType: 'RepresentativeAssignmentFormValues',
  title: 'Tài khoản đại diện',
  titleMessageId: 'custodians.representatives.dialog.title',
  specPath:
    'src/project/custodians/forms/representative-assignment.form.fixture.ts',
  fields: [
    {
      kind: 'multiselect',
      name: 'userIds',
      label: 'Tài khoản đại diện',
      labelMessageId: 'custodians.representatives.fields.accounts',
      optionsFrom: 'prop',
      layout: 'horizontal',
      labelWidth: 'md',
    },
  ],
};

export default spec;
