import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadCustodianAccountOptions,
  loadCustodians,
  loadFakeEpsParties,
  loadHandoverCounterpartyOptions,
  saveCustodian,
} from '../api/custodians.api';
import type { SaveCustodianValues } from '../model/custodian';

export const custodianKeys = {
  all: ['project', 'custodians'] as const,
  list: (includeInactive = false) =>
    [...custodianKeys.all, 'list', includeInactive] as const,
  fakeEpsParties: () => [...custodianKeys.all, 'fake-eps-parties'] as const,
  accountOptions: () => [...custodianKeys.all, 'account-options'] as const,
  counterpartyOptions: (partyId: string) =>
    [...custodianKeys.all, 'counterparty-options', partyId] as const,
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
      values: SaveCustodianValues;
    }) => saveCustodian(id, values),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: custodianKeys.all }),
  });
}

export function useCustodianAccountOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: custodianKeys.accountOptions(),
    queryFn: ({ signal }) => loadCustodianAccountOptions(signal),
    enabled,
    retry: 0,
  });
}

export function useFakeEpsPartiesQuery(enabled = true) {
  return useQuery({
    queryKey: custodianKeys.fakeEpsParties(),
    queryFn: ({ signal }) => loadFakeEpsParties(signal),
    enabled,
    retry: 0,
  });
}

export function useHandoverCounterpartyOptionsQuery(
  partyId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: custodianKeys.counterpartyOptions(partyId),
    queryFn: ({ signal }) => loadHandoverCounterpartyOptions(partyId, signal),
    enabled: Boolean(partyId) && enabled,
    retry: 0,
  });
}
