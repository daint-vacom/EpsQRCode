import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type { Contract, ContractStatus } from '../../contracts/model/contract';
import {
  mapContractChargeBalanceRow,
  type ContractChargeBalance,
  type ContractChargeBalanceRow,
} from '../../contracts/model/receivable';
import {
  buildCustomerOverviewData,
  type CustomerOverviewData,
} from '../model/customer-overview';

interface CustomerOverviewContractRow {
  id: string;
  contract_code: string;
  name: string;
  currency_code: string;
  status: ContractStatus;
}

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadCustomerOverview(
  tenantId: string,
  customerId: string,
  signal?: AbortSignal,
): Promise<CustomerOverviewData> {
  assertSupabaseConfigured();

  const [contractRows, balanceRows] = await Promise.all([
    request<CustomerOverviewContractRow[]>(
      supabaseApi.get(
        '/contracts',
        queryParams({
          select: 'id,contract_code,name,currency_code,status',
          tenant_id: `eq.${tenantId}`,
          customer_id: `eq.${customerId}`,
          order: 'name.asc,contract_code.asc',
        }),
        { signal },
      ),
    ),
    request<ContractChargeBalanceRow[]>(
      supabaseApi.get(
        '/contract_charge_balances',
        queryParams({
          select: '*',
          tenant_id: `eq.${tenantId}`,
          customer_id: `eq.${customerId}`,
          direction: 'eq.receivable',
          status: 'neq.voided',
          order: 'due_date.asc,contract_id.asc',
        }),
        { signal },
      ),
    ),
  ]);

  const contracts: Array<
    Pick<Contract, 'id' | 'contractCode' | 'name' | 'currencyCode' | 'status'>
  > = contractRows.map((row) => ({
    id: row.id,
    contractCode: row.contract_code,
    name: row.name,
    currencyCode: row.currency_code,
    status: row.status,
  }));
  const charges: ContractChargeBalance[] = balanceRows.map(
    mapContractChargeBalanceRow,
  );

  return buildCustomerOverviewData(contracts, charges);
}
