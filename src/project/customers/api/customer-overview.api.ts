import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type { Contract, ContractStatus } from '../../contracts/model/contract';
import {
  loadCustomerFinanceSummaryAsOf,
  loadFinanceObligationsAsOf,
} from '../../finance/api/finance.api';
import {
  buildCustomerOverviewData,
  type CustomerOverviewData,
  type CustomerPaymentPlanSource,
} from '../model/customer-overview';

interface CustomerOverviewContractRow {
  id: string;
  contract_code: string;
  name: string;
  currency_code: string;
  status: ContractStatus;
}

interface CustomerOverviewChargeRow {
  contract_id: string;
  due_date: string;
  paid_amount: number | string;
  outstanding_amount: number | string;
  direction: 'receivable' | 'payable';
  status: string;
}

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

function numberValue(value: number | string | null | undefined) {
  return value == null ? 0 : typeof value === 'number' ? value : Number(value);
}

export async function loadCustomerOverview(
  tenantId: string,
  customerId: string,
  signal?: AbortSignal,
): Promise<CustomerOverviewData> {
  assertSupabaseConfigured();
  const asOfDate = new Date().toISOString().slice(0, 10);

  const [contractRows, obligations, contractChargeRows, financeSummary] =
    await Promise.all([
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
      loadFinanceObligationsAsOf(tenantId, asOfDate, {
        direction: 'receivable',
        customerId,
        currencyCode: 'VND',
      }),
      request<CustomerOverviewChargeRow[]>(
        supabaseApi.get(
          '/contract_charge_balances',
          queryParams({
            select:
              'contract_id,due_date,paid_amount,outstanding_amount,direction,status',
            tenant_id: `eq.${tenantId}`,
            customer_id: `eq.${customerId}`,
            direction: 'eq.receivable',
            status: 'neq.voided',
          }),
          { signal },
        ),
      ),
      loadCustomerFinanceSummaryAsOf(tenantId, customerId, asOfDate, 'VND'),
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
  const paymentPlanSources: CustomerPaymentPlanSource[] = contractChargeRows
    .filter((row) => row.direction === 'receivable' && row.status !== 'voided')
    .map((row) => ({
      dueDate: row.due_date,
      paidAmount: numberValue(row.paid_amount),
      outstandingAmount: numberValue(row.outstanding_amount),
    }));

  return buildCustomerOverviewData(
    contracts,
    obligations,
    obligations,
    paymentPlanSources,
    financeSummary,
  );
}
