import { useQuery } from '@tanstack/react-query';
import { loadEmployeeRoleOptions } from '../api/employees.api';

export function useEmployeeAccessWorkspace({
  tenantId,
  enabled,
}: {
  tenantId: string | null;
  enabled: boolean;
}) {
  const roleOptionsQuery = useQuery({
    queryKey: ['project', 'employees', 'access-role-options', tenantId],
    queryFn: () => loadEmployeeRoleOptions(tenantId!),
    enabled: Boolean(tenantId && enabled),
    staleTime: 5 * 60 * 1000,
  });

  return {
    roleOptions: roleOptionsQuery.data ?? [],
    isLoading: roleOptionsQuery.isPending,
    error: roleOptionsQuery.error,
  };
}
