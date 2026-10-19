import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadCustodianAccountOptions,
  loadCustodians,
  saveCustodian,
} from '../api/custodians.api';
import type { CustodianFormValues } from '../model/custodian';

export const custodianKeys = {
  all: ['project', 'custodians'] as const,
  list: (includeInactive = false) =>
    [...custodianKeys.all, 'list', includeInactive] as const,
};

export function useCustodiansQuery(includeInactive = false, enabled = true) {
  return useQuery({
    queryKey: custodianKeys.list(includeInactive),
    queryFn: ({ signal }) => loadCustodians(includeInactive, signal),
    enabled,
    retry: 0,
  });
}

export function useSaveCustodianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string | null;
      values: CustodianFormValues;
    }) => saveCustodian(id, values),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: custodianKeys.all }),
  });
}

export function useCustodianAccountOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: [...custodianKeys.all, 'account-options'],
    queryFn: ({ signal }) => loadCustodianAccountOptions(signal),
    enabled,
    retry: 0,
  });
}
