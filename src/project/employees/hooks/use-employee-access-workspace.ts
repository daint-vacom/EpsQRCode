import { useQuery } from '@tanstack/react-query';
import { loadEmployeeRoleOptions } from '../api/employees.api';

export function useEmployeeAccessWorkspace({ enabled }: { enabled: boolean }) {
  const roleOptionsQuery = useQuery({
    queryKey: ['project', 'employees', 'access-role-options'],
    queryFn: () => loadEmployeeRoleOptions(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return {
    roleOptions: roleOptionsQuery.data ?? [],
    isLoading: roleOptionsQuery.isPending,
    error: roleOptionsQuery.error,
  };
}
