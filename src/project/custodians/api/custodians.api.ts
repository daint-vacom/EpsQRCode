import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  Custodian,
  EpsEmployeeListFilters,
  EpsEmployeeListResult,
  EpsOrganization,
  HandoverCounterpartyOption,
  HandoverCustomParty,
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

export async function loadEpsOwnerEmployees(
  filters: EpsEmployeeListFilters,
  signal?: AbortSignal,
): Promise<EpsEmployeeListResult> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_material_party_employees',
      {
        p_search: filters.search ?? '',
        p_department_id: filters.departmentId ?? null,
        p_team_id: filters.teamId ?? null,
        p_page: filters.page ?? 1,
        p_page_size: filters.pageSize ?? 30,
      },
      { signal },
    ),
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

export async function loadEpsOrganizations(
  signal?: AbortSignal,
): Promise<EpsOrganization[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/list_eps_organizations', {}, { signal }),
  );
}

export async function replaceCustodianRepresentatives(
  custodianId: string,
  userIds: string[],
): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.post('/rpc/replace_material_custodian_representatives', {
      p_custodian_id: custodianId,
      p_user_ids: userIds,
    }),
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

export async function loadHandoverCustomParties(
  signal?: AbortSignal,
): Promise<HandoverCustomParty[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/list_handover_custom_parties', {}, { signal }),
  );
}
