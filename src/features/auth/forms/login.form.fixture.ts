import type { FormSpec } from '@/builders/form';

const spec = {
  entity: 'Login',
  schemaImport: './login-form.schema',
  schemaName: 'loginFormSchema',
  valuesType: 'LoginFormValues',
  title: 'Đăng nhập',
  titleMessageId: 'auth.login.title',
  specPath: 'src/features/auth/forms/login.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'identifier',
      label: 'Tài khoản hoặc email',
      labelMessageId: 'auth.login.identifier',
      width: 'full',
      required: true,
      inputType: 'text',
    },
    {
      kind: 'text',
      name: 'password',
      label: 'Mật khẩu',
      labelMessageId: 'auth.login.password',
      width: 'full',
      required: true,
      inputType: 'password',
    },
  ],
} satisfies FormSpec;

export default spec;
