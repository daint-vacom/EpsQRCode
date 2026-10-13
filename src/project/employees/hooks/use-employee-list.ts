import { useSubjectTagFilter } from '@/project/tags/hooks/use-subject-tag-filter';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { buildListQueryParams } from '@/lib/list-query-params';
import { useTableListState } from '@/hooks/use-table-list-state';
import { useWorkspace } from '@/providers/workspace-provider';
import {
  loadEmployeeList,
  loadEmployeeRoleOptions,
} from '../api/employees.api';
import {
  EMPLOYEE_LIST_INITIAL_FILTERS,
  EMPLOYEE_STATUSES,
  type EmployeeListParams,
  type EmployeeRoleOption,
  type EmployeeStatus,
} from '../model/employee';
import type { EmployeeListFilters } from '../model/employee';

export function useEmployeeList() {
  const workspaceState = useWorkspace();
  const listState = useTableListState<EmployeeListFilters>({
    initialFilters: EMPLOYEE_LIST_INITIAL_FILTERS,
    initialPageSize: 10,
  });

  const queryParams = buildListQueryParams(listState, {
    filters: {
      statuses: {
        param: 'statuses',
        serialize: (value) => (value.length > 0 ? value.join(',') : undefined),
      },
      roleIds: {
        param: 'roleIds',
        serialize: (value) => (value.length > 0 ? value.join(',') : undefined),
      },
      accountLinked: {
        param: 'accountLinked',
        serialize: (value) => (value === 'all' ? undefined : value),
      },
      tagIds: {
        param: 'tagIds',
        serialize: (value) => (value.length > 0 ? value.join(',') : undefined),
      },
    },
  });

  const listParams: EmployeeListParams = {
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    search:
      typeof queryParams.search === 'string' ? queryParams.search : undefined,
    statuses:
      typeof queryParams.statuses === 'string'
        ? queryParams.statuses
            .split(',')
            .filter((value): value is EmployeeStatus =>
              EMPLOYEE_STATUSES.includes(value as EmployeeStatus),
            )
        : undefined,
    roleIds:
      typeof queryParams.roleIds === 'string'
        ? queryParams.roleIds.split(',').filter(Boolean)
        : undefined,
    accountLinked:
      queryParams.accountLinked === 'linked'
        ? true
        : queryParams.accountLinked === 'unlinked'
          ? false
          : undefined,
    tagIds:
      typeof queryParams.tagIds === 'string'
        ? queryParams.tagIds.split(',').filter(Boolean)
        : undefined,
  };

  const subjectTagFilterQuery = useSubjectTagFilter('employee', {
    moduleCodes: ['organization'],
  });

  const roleOptionsQuery = useQuery({
    queryKey: ['project', 'employees', 'role-options'],
    queryFn: () => loadEmployeeRoleOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const listQuery = useQuery({
    queryKey: ['project', 'employees', 'list', listParams],
    queryFn: ({ signal }) => {
      return loadEmployeeList(listParams, signal);
    },
    placeholderData: keepPreviousData,
  });

  return {
    ...listState,
    accountQuery: workspaceState,
    workspaceQuery: listQuery,
    employees: listQuery.data?.employees ?? [],
    total: listQuery.data?.total ?? 0,
    employeeTagOptions: subjectTagFilterQuery.data?.options ?? [],
    employeeTagsByEmployeeId: subjectTagFilterQuery.data?.tagsBySubjectId ?? {},
    employeeTagOptionsQuery: subjectTagFilterQuery,
    employeeRoleOptions: roleOptionsQuery.data ?? ([] as EmployeeRoleOption[]),
    employeeRoleOptionsQuery: roleOptionsQuery,
  };
}
