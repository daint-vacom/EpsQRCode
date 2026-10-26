import { useQuery } from '@tanstack/react-query';
import {
  loadCustodianAccountOptions,
  loadCustodians,
  loadEpsOrganizations,
  loadHandoverCounterpartyOptions,
  loadHandoverCustomParties,
} from '../api/custodians.api';

export const custodianKeys = {
  all: ['project', 'custodians'] as const,
  list: (includeInactive = false) =>
    [...custodianKeys.all, 'list', includeInactive] as const,
  accountOptions: () => [...custodianKeys.all, 'account-options'] as const,
  counterpartyOptions: (partyId: string) =>
    [...custodianKeys.all, 'counterparty-options', partyId] as const,
  handoverCustomParties: () =>
    [...custodianKeys.all, 'handover-custom-parties'] as const,
  epsOrganizations: () => [...custodianKeys.all, 'eps-organizations'] as const,
};

export function useCustodiansQuery(includeInactive = false, enabled = true) {
  return useQuery({
    queryKey: custodianKeys.list(includeInactive),
    queryFn: ({ signal }) => loadCustodians(includeInactive, signal),
    enabled,
    retry: 0,
  });
}

export function useHandoverCustomPartiesQuery(enabled = true) {
  return useQuery({
    queryKey: custodianKeys.handoverCustomParties(),
    queryFn: ({ signal }) => loadHandoverCustomParties(signal),
    enabled,
    retry: 0,
  });
}

export function useEpsOrganizationsQuery(enabled = true) {
  return useQuery({
    queryKey: custodianKeys.epsOrganizations(),
    queryFn: ({ signal }) => loadEpsOrganizations(signal),
    enabled,
    retry: 0,
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
