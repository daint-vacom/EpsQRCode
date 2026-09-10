import type { TagSelectOption } from '@/project/tags/model/tag';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerResponsibilityFilterRow } from './customer-responsibility-filter-row';

const tagOptions: TagSelectOption[] = [
  {
    id: 'tag-vip',
    name: 'VIP',
    color: '#16a34a',
    groupId: 'group-1',
    groupName: 'Nhóm khách hàng',
    moduleCode: 'customers',
    isSystem: false,
    isActive: true,
  },
];

const employeeOptions = [
  {
    id: 'employee-1',
    employeeCode: 'NV-001',
    displayName: 'Nguyễn Văn A',
    department: 'Kinh doanh',
    status: 'active' as const,
    avatarUrl: null,
    customerCount: 3,
  },
  {
    id: 'employee-2',
    employeeCode: 'NV-002',
    displayName: 'Trần Thị B',
    department: 'Tài chính',
    status: 'active' as const,
    avatarUrl: null,
    customerCount: 1,
  },
];

describe('CustomerResponsibilityFilterRow', () => {
  it('shows group chips and clears the previous group filter when switching to employees', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const onTagIdsChange = vi.fn();
    const onEmployeeIdsChange = vi.fn();

    render(
      <CustomerResponsibilityFilterRow
        mode="group"
        onModeChange={onModeChange}
        tagOptions={tagOptions}
        selectedTagIds={['tag-vip']}
        onTagIdsChange={onTagIdsChange}
        employeeOptions={employeeOptions}
        selectedEmployeeIds={[]}
        onEmployeeIdsChange={onEmployeeIdsChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'VIP' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('radio', { name: 'Theo nhân viên' }));

    expect(onTagIdsChange).toHaveBeenCalledWith([]);
    expect(onModeChange).toHaveBeenCalledWith('employee');
  });

  it('filters by one employee chip at a time and shows the customer count', async () => {
    const user = userEvent.setup();
    const onEmployeeIdsChange = vi.fn();

    render(
      <CustomerResponsibilityFilterRow
        mode="employee"
        onModeChange={vi.fn()}
        tagOptions={[]}
        selectedTagIds={[]}
        onTagIdsChange={vi.fn()}
        employeeOptions={employeeOptions}
        selectedEmployeeIds={[]}
        onEmployeeIdsChange={onEmployeeIdsChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Nguyễn Văn A/ }));
    await user.click(screen.getByRole('button', { name: /Trần Thị B/ }));

    expect(onEmployeeIdsChange).toHaveBeenNthCalledWith(1, ['employee-1']);
    expect(onEmployeeIdsChange).toHaveBeenNthCalledWith(2, ['employee-2']);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
