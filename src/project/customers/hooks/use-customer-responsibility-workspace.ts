import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadCustomerResponsibilityWorkspace,
  replaceCustomerResponsibilities,
} from '../api/customers.api';
import type { CustomerResponsibilityAssignmentInput } from '../model/customer-responsibility';

export function useCustomerResponsibilityWorkspace({
  tenantId,
  customerId,
  enabled,
}: {
  tenantId: string;
  customerId: string;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'responsibility-workspace',
      tenantId,
      customerId,
    ],
    queryFn: () => loadCustomerResponsibilityWorkspace(tenantId, customerId),
    enabled,
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (assignments: CustomerResponsibilityAssignmentInput[]) =>
      replaceCustomerResponsibilities(tenantId, customerId, assignments),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            'project',
            'customers',
            'responsibility-workspace',
            tenantId,
            customerId,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'customers', 'list'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'customers', 'responsibility-filter-options'],
        }),
      ]);
    },
  });

  return { workspaceQuery, saveMutation };
}
