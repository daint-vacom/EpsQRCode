import {
  loadCustomerCustomFields,
  loadCustomerSelectOptions,
} from '@/project/customers/api/customers.api';
import { type CustomerTableController } from '@/project/customers/components/customer-table';
import { useCustomerList } from '@/project/customers/hooks/use-customer-list';
import { useQuery } from '@tanstack/react-query';
import {
  loadEmployeeResponsibilityWorkspace,
  loadEmployeeRoleOptions,
} from '../api/employees.api';
import type {
  EmployeeCustomerOption,
  EmployeeResponsibilityWorkspace,
} from '../model/employee-responsibility';

export function useEmployeeAccessWorkspace({
  tenantId,
  employeeId,
  enabled,
}: {
  tenantId: string | null;
  employeeId?: string;
  enabled: boolean;
}) {
  const customerList = useCustomerList({
    enabled,
    initialPageSize: 10,
    includeStats: false,
    includeResponsibilityFilterOptions: false,
  });

  const roleOptionsQuery = useQuery({
    queryKey: ['project', 'employees', 'access-role-options', tenantId],
    queryFn: () => loadEmployeeRoleOptions(tenantId!),
    enabled: Boolean(tenantId && enabled),
    staleTime: 5 * 60 * 1000,
  });

  const customersQuery = useQuery({
    queryKey: ['project', 'employees', 'access-customers', tenantId],
    queryFn: async (): Promise<EmployeeCustomerOption[]> => {
      const customers = await loadCustomerSelectOptions('', tenantId!);
      return customers.map((customer) => ({
        ...customer,
        status: 'active',
      }));
    },
    enabled: Boolean(tenantId && enabled),
    staleTime: 60 * 1000,
  });

  const customerCustomFieldsQuery = useQuery({
    queryKey: ['project', 'customers', 'custom-fields', tenantId],
    queryFn: () => loadCustomerCustomFields(tenantId!),
    enabled: Boolean(tenantId && enabled),
    staleTime: 60 * 1000,
  });

  const responsibilityQuery = useQuery({
    queryKey: [
      'project',
      'employees',
      'responsibility-workspace',
      tenantId,
      employeeId,
    ],
    queryFn: () => loadEmployeeResponsibilityWorkspace(tenantId!, employeeId!),
    enabled: Boolean(tenantId && employeeId && enabled),
    staleTime: 60 * 1000,
  });

  const workspace: EmployeeResponsibilityWorkspace | null =
    responsibilityQuery.data ?? null;

  return {
    roleOptions: roleOptionsQuery.data ?? [],
    customers: workspace?.customers ?? customersQuery.data ?? [],
    assignments: workspace?.assignments ?? [],
    roleOptionsQuery,
    customersQuery,
    responsibilityQuery,
    isLoading:
      roleOptionsQuery.isPending ||
      customersQuery.isPending ||
      responsibilityQuery.isPending,
    error:
      roleOptionsQuery.error ??
      customersQuery.error ??
      responsibilityQuery.error ??
      customerList.workspaceQuery.error ??
      customerCustomFieldsQuery.error ??
      null,
    customerTable: {
      customers: customerList.customers,
      total: customerList.total,
      keyword: customerList.keyword,
      setKeyword: customerList.setKeyword,
      filters: customerList.filters,
      setFilter: customerList.setFilter,
      pagination: customerList.pagination,
      onPaginationChange: customerList.onPaginationChange,
      customFields: customerCustomFieldsQuery.data ?? [],
      tagsByCustomerId: customerList.customerTagsByCustomerId,
      isLoading:
        customerList.workspaceQuery.isPending ||
        customerCustomFieldsQuery.isPending,
      isFetching:
        customerList.workspaceQuery.isFetching ||
        customerCustomFieldsQuery.isFetching,
    } satisfies CustomerTableController,
  };
}
