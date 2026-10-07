import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EmployeeIdentity } from './employee-identity';

describe('EmployeeIdentity', () => {
  it('shows the shared code-name tooltip', async () => {
    const user = userEvent.setup();

    render(
      <EmployeeIdentity
        employee={{
          displayName: 'Nguyễn Văn A',
          employeeCode: 'NV01',
          avatarUrl: null,
          userId: 'user-1',
        }}
      />,
    );

    await user.hover(screen.getByText('Nguyễn Văn A'));

    expect(
      await screen.findByRole('tooltip', { name: 'NV01 - Nguyễn Văn A' }),
    ).toBeInTheDocument();
  });

  it('shows the shared warning badge and full tooltip for an unlinked account', async () => {
    const user = userEvent.setup();

    render(
      <EmployeeIdentity
        employee={{
          displayName: 'Đặng Nam',
          employeeCode: 'NV-DEMO-07',
          avatarUrl: null,
          userId: null,
        }}
      />,
    );

    const badge = screen.getByLabelText('Có 1 cảnh báo');
    expect(badge).toBeInTheDocument();

    await user.hover(badge);
    expect(
      await screen.findByRole('tooltip', { name: 'Chưa liên kết tài khoản' }),
    ).toBeInTheDocument();
  });

  it('combines employee warnings into the same badge', () => {
    render(
      <EmployeeIdentity
        employee={{
          displayName: 'Nguyễn Văn A',
          employeeCode: 'NV01',
          avatarUrl: null,
          userId: 'user-1',
          alerts: [
            {
              id: 'missing-profile-setting',
              message: 'Chưa cấu hình thông tin hồ sơ',
            },
          ],
        }}
      />,
    );

    expect(screen.getByLabelText('Có 1 cảnh báo')).toBeInTheDocument();
  });
});
