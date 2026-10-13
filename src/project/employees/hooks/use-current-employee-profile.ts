import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import { loadCurrentEmployeeProfile } from '../api/employees.api';

export const currentEmployeeProfileQueryKey = (userId: string | null) =>
  ['project', 'current-employee-profile', userId] as const;

export function useCurrentEmployeeProfile(options?: { enabled?: boolean }) {
  const { userId } = useUser();

  return useQuery({
    queryKey: currentEmployeeProfileQueryKey(userId),
    queryFn: () => {
      if (!userId) {
        throw new Error('Chưa xác định tài khoản hiện tại.');
      }
      return loadCurrentEmployeeProfile(userId);
    },
    enabled: Boolean(userId) && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}
