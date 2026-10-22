import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  Custodian,
  EpsCustodianSourceType,
  FakeEpsParty,
  HandoverCounterpartyOption,
  SaveCustodianValues,
} from '../model/custodian';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadCustodians(
  includeInactive = false,
  signal?: AbortSignal,
): Promise<Custodian[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_custodians',
      { p_include_inactive: includeInactive },
      { signal },
    ),
  );
}

export async function saveCustodian(
  id: string | null,
  values: SaveCustodianValues,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/save_custodian', { p_id: id, p_values: values }),
  );
}

export interface CustodianAccountOption {
  id: string;
  username: string | null;
  displayName: string;
}

export async function loadCustodianAccountOptions(
  signal?: AbortSignal,
): Promise<CustodianAccountOption[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/list_custodian_account_options', {}, { signal }),
  );
}

export async function loadFakeEpsParties(
  signal?: AbortSignal,
): Promise<FakeEpsParty[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/list_fake_eps_parties', {}, { signal }),
  );
}

export async function loadHandoverCounterpartyOptions(
  partyId: string,
  signal?: AbortSignal,
): Promise<HandoverCounterpartyOption[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_handover_counterparty_options',
      { p_party_id: partyId },
      { signal },
    ),
  );
}

export function custodianTypeFromSourceType(
  sourceType: EpsCustodianSourceType,
): SaveCustodianValues['type'] {
  switch (sourceType) {
    case 'eps_department':
      return 'department' as const;
    case 'eps_team':
      return 'team' as const;
    case 'eps_person':
      return 'person' as const;
  }
}
