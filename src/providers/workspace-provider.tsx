import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { getEffectivePermissionCodes } from '@/project/api/permission-access.api';
import {
  loadProjectContext,
  type ProjectContext,
} from '@/project/api/project-context.api';
import { useAuthStore } from '@/stores/auth.store';
import { useQuery } from '@tanstack/react-query';
import { useUser } from './user-provider';

export interface WorkspaceContextValue {
  accountRoles: ProjectContext['accountRoles'];
  isPending: boolean;
  isPermissionsPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { userId, token } = useUser();
  const setPermissions = useAuthStore((state) => state.setPermissions);
  const accountQuery = useQuery({
    queryKey: ['project', 'account-context', userId],
    queryFn: () => {
      if (!userId || !token) {
        throw new Error('Chưa xác định tài khoản Supabase đăng nhập.');
      }
      return loadProjectContext(userId);
    },
    enabled: Boolean(userId && token),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const permissionQuery = useQuery({
    queryKey: ['project', 'effective-permissions', userId],
    queryFn: () => {
      if (!userId || !token) {
        throw new Error('Chưa xác định tài khoản Supabase đăng nhập.');
      }
      return getEffectivePermissionCodes(userId);
    },
    enabled: Boolean(userId && token),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (permissionQuery.data) {
      setPermissions(permissionQuery.data);
    }
  }, [permissionQuery.data, setPermissions]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      accountRoles: accountQuery.data?.accountRoles ?? [],
      isPending: Boolean(userId && token) && accountQuery.isPending,
      isPermissionsPending:
        Boolean(userId && token) && permissionQuery.isPending,
      isError: accountQuery.isError || permissionQuery.isError,
      error:
        (accountQuery.error instanceof Error ? accountQuery.error : null) ??
        (permissionQuery.error instanceof Error ? permissionQuery.error : null),
      refetch: async () => {
        await Promise.all([accountQuery.refetch(), permissionQuery.refetch()]);
      },
    }),
    [
      accountQuery.data,
      accountQuery.error,
      accountQuery.isError,
      accountQuery.isPending,
      accountQuery.refetch,
      permissionQuery.data,
      permissionQuery.error,
      permissionQuery.isError,
      permissionQuery.isPending,
      permissionQuery.refetch,
      token,
      userId,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error(
      'useWorkspace phải được sử dụng bên trong WorkspaceProvider.',
    );
  }
  return context;
}
