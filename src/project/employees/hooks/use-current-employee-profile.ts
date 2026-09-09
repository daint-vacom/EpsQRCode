import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { loadCurrentEmployeeProfile } from '../api/employees.api';

export const currentEmployeeProfileQueryKey = (
  tenantId: string | null,
  userId: string | null,
) => ['project', 'current-employee-profile', tenantId, userId] as const;

export function useCurrentEmployeeProfile(options?: { enabled?: boolean }) {
  const { tenantId } = useTenant();
  const { userId } = useUser();

  return useQuery({
    queryKey: currentEmployeeProfileQueryKey(tenantId, userId),
    queryFn: () => {
      if (!tenantId || !userId) {
        throw new Error('Chưa xác định tài khoản hoặc tổ chức hiện tại.');
      }
      return loadCurrentEmployeeProfile(tenantId, userId);
    },
    enabled: Boolean(tenantId && userId) && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}
