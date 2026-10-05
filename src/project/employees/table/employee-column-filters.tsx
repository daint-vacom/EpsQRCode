import type { MultiSelectOption } from '@/components/ui/multi-select';
import type { SelectOption } from '@/components/ui/option-select';
import { ROLE_COLOR_LABELS } from '../../model/role-color';
import {
  EmployeeAccountBadge,
  EmployeeRoleBadge,
  EmployeeStatusBadge,
} from '../components/employee-badges';
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUSES,
  type EmployeeRoleOption,
  type EmployeeStatus,
} from '../model/employee';

export const EMPLOYEE_STATUS_FILTER_OPTIONS: MultiSelectOption[] =
  EMPLOYEE_STATUSES.map((status) => ({
    value: status,
    label: <EmployeeStatusBadge status={status} />,
    searchableText: EMPLOYEE_STATUS_LABELS[status],
    data: status,
  }));

export const EMPLOYEE_ACCOUNT_FILTER_OPTIONS: SelectOption[] = [
  {
    value: 'linked',
    label: <EmployeeAccountBadge linked />,
    searchableText: 'Đã liên kết',
  },
  {
    value: 'unlinked',
    label: <EmployeeAccountBadge linked={false} />,
    searchableText: 'Chưa liên kết',
  },
];

export function toEmployeeRoleFilterOption(
  role: EmployeeRoleOption,
): MultiSelectOption<EmployeeRoleOption> {
  return {
    value: role.id,
    label: <EmployeeRoleBadge role={{ name: role.name, color: role.color }} />,
    searchableText: `${role.name} ${ROLE_COLOR_LABELS[role.color]}`,
    data: role,
  };
}

export function toEmployeeStatusFilterValue(value: string[]): EmployeeStatus[] {
  return value.filter((status): status is EmployeeStatus =>
    EMPLOYEE_STATUSES.includes(status as EmployeeStatus),
  );
}
