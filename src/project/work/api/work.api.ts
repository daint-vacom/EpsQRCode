import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  WorkEmployeeOption,
  WorkFormValues,
  WorkItem,
  WorkListFilters,
  WorkTemplate,
  WorkTemplateFormValues,
} from '../model/work';
import { mapWorkRpcRow } from '../model/work';

async function request<T>(requestPromise: Promise<unknown>): Promise<T> {
  return (await requestPromise) as T;
}

export async function loadCurrentWorkEmployeeId(
  tenantId: string,
  userId: string,
): Promise<string | null> {
  assertSupabaseConfigured();
  const rows = await request<Array<{ id: string }>>(
    supabaseApi.get('/employees', {
      params: {
        select: 'id',
        tenant_id: `eq.${tenantId}`,
        user_id: `eq.${userId}`,
        limit: '1',
      },
    }),
  );
  return rows[0]?.id ?? null;
}

export interface WorkListResult {
  items: WorkItem[];
  total: number;
}

function toPayload(values: WorkFormValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status,
    priority: values.priority,
    assigneeEmployeeId: values.assigneeEmployeeId || null,
    parentId: values.parentId || null,
    templateId: values.templateId || null,
    plannedStartDate: values.plannedStartDate || null,
    plannedEndDate: values.plannedEndDate || null,
    customerIds: values.customerIds,
    contractIds: values.contractIds,
  };
}

export async function loadWorkItems(
  tenantId: string,
  filters: WorkListFilters,
  signal?: AbortSignal,
): Promise<WorkListResult> {
  assertSupabaseConfigured();
  const response = await request<{
    items: Record<string, unknown>[];
    total: number;
  }>(
    supabaseApi.post(
      '/rpc/list_work_items',
      {
        p_tenant_id: tenantId,
        p_assignee_employee_id:
          filters.scope === 'mine'
            ? filters.assigneeEmployeeId || null
            : filters.assigneeEmployeeId || null,
        p_search: filters.search.trim() || null,
        p_statuses: filters.statuses,
        p_priority: filters.priority || null,
        p_page: filters.page,
        p_page_size: filters.pageSize,
      },
      { signal },
    ),
  );
  return {
    items: (response.items ?? []).map(mapWorkRpcRow),
    total: Number(response.total ?? 0),
  };
}

export async function loadWorkTree(tenantId: string, workItemId: string) {
  const result = await loadWorkItems(tenantId, {
    search: '',
    statuses: [],
    priority: '',
    assigneeEmployeeId: '',
    scope: 'all',
    page: 1,
    pageSize: 200,
  });
  const root = result.items.find((item) => item.id === workItemId) ?? null;
  return {
    root,
    children: root
      ? result.items.filter((item) => item.parentId === root.id)
      : [],
  };
}

export async function createWorkItem(tenantId: string, values: WorkFormValues) {
  assertSupabaseConfigured();
  return request<string>(
    supabaseApi.post('/rpc/create_work_item', {
      p_tenant_id: tenantId,
      p_payload: toPayload(values),
    }),
  );
}

export async function updateWorkItem(
  tenantId: string,
  workItemId: string,
  values: WorkFormValues,
) {
  assertSupabaseConfigured();
  await request(
    supabaseApi.patch(
      '/work_items',
      {
        title: values.title.trim(),
        description: values.description.trim(),
        status: values.status,
        priority: values.priority,
        assignee_employee_id: values.assigneeEmployeeId || null,
        parent_id: values.parentId || null,
        template_id: values.templateId || null,
        planned_start_date: values.plannedStartDate || null,
        planned_end_date: values.plannedEndDate || null,
      },
      { params: { id: `eq.${workItemId}`, tenant_id: `eq.${tenantId}` } },
    ),
  );
  await replaceWorkLinks(
    tenantId,
    workItemId,
    values.customerIds,
    values.contractIds,
  );
}

async function replaceWorkLinks(
  tenantId: string,
  workItemId: string,
  customerIds: string[],
  contractIds: string[],
) {
  await Promise.all([
    supabaseApi.delete('/work_item_customers', {
      params: { tenant_id: `eq.${tenantId}`, work_item_id: `eq.${workItemId}` },
    }),
    supabaseApi.delete('/work_item_contracts', {
      params: { tenant_id: `eq.${tenantId}`, work_item_id: `eq.${workItemId}` },
    }),
  ]);
  const rows = [
    ...customerIds.map((customerId) => ({
      tenant_id: tenantId,
      work_item_id: workItemId,
      customer_id: customerId,
    })),
  ];
  const contractRows = contractIds.map((contractId) => ({
    tenant_id: tenantId,
    work_item_id: workItemId,
    contract_id: contractId,
  }));
  await Promise.all([
    rows.length
      ? supabaseApi.post('/work_item_customers', rows)
      : Promise.resolve(),
    contractRows.length
      ? supabaseApi.post('/work_item_contracts', contractRows)
      : Promise.resolve(),
  ]);
}

export async function deleteWorkItem(tenantId: string, workItemId: string) {
  assertSupabaseConfigured();
  await supabaseApi.delete('/work_items', {
    params: { id: `eq.${workItemId}`, tenant_id: `eq.${tenantId}` },
  });
}

export async function updateWorkItemStatus(
  tenantId: string,
  workItemId: string,
  status: WorkItem['status'],
) {
  assertSupabaseConfigured();
  await supabaseApi.patch(
    '/work_items',
    { status },
    { params: { id: `eq.${workItemId}`, tenant_id: `eq.${tenantId}` } },
  );
}

export async function loadWorkEmployeeOptions(
  tenantId: string,
): Promise<WorkEmployeeOption[]> {
  assertSupabaseConfigured();
  const rows = await request<
    Array<{
      id: string;
      employee_code: string;
      first_name: string;
      last_name: string;
    }>
  >(
    supabaseApi.get('/employees', {
      params: {
        select: 'id,employee_code,first_name,last_name',
        tenant_id: `eq.${tenantId}`,
        status: 'eq.active',
        order: 'last_name.asc,first_name.asc',
      },
    }),
  );
  return rows.map((row) => ({
    id: row.id,
    label: `${row.last_name} ${row.first_name}`.trim(),
    secondaryLabel: row.employee_code,
    employeeCode: row.employee_code,
  }));
}

export async function loadWorkLinkOptions(tenantId: string) {
  assertSupabaseConfigured();
  const [customers, contracts] = await Promise.all([
    request<Array<{ id: string; customer_code: string; name: string }>>(
      supabaseApi.get('/customers', {
        params: {
          select: 'id,customer_code,name',
          tenant_id: `eq.${tenantId}`,
          order: 'name.asc',
        },
      }),
    ),
    request<Array<{ id: string; contract_code: string; name: string }>>(
      supabaseApi.get('/contracts', {
        params: {
          select: 'id,contract_code,name',
          tenant_id: `eq.${tenantId}`,
          order: 'name.asc',
        },
      }),
    ),
  ]);
  return {
    customers: customers.map((row) => ({
      id: row.id,
      label: row.name,
      secondaryLabel: row.customer_code,
    })),
    contracts: contracts.map((row) => ({
      id: row.id,
      label: row.name,
      secondaryLabel: row.contract_code,
    })),
  };
}

export async function loadWorkTemplates(
  tenantId: string,
): Promise<WorkTemplate[]> {
  assertSupabaseConfigured();
  const [templates, steps] = await Promise.all([
    request<Array<Record<string, unknown>>>(
      supabaseApi.get('/work_templates', {
        params: { select: '*', tenant_id: `eq.${tenantId}`, order: 'name.asc' },
      }),
    ),
    request<Array<Record<string, unknown>>>(
      supabaseApi.get('/work_template_steps', {
        params: {
          select: '*',
          tenant_id: `eq.${tenantId}`,
          order: 'sort_order.asc',
        },
      }),
    ),
  ]);
  return templates.map((row) => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    code: String(row.code),
    name: String(row.name),
    description: String(row.description ?? ''),
    isActive: Boolean(row.is_active),
    steps: steps
      .filter((step) => step.template_id === row.id)
      .map((step) => ({
        id: String(step.id),
        title: String(step.title),
        description: String(step.description ?? ''),
        sortOrder: Number(step.sort_order ?? 0),
        plannedDays:
          step.planned_days == null ? null : Number(step.planned_days),
        isRequired: Boolean(step.is_required),
      })),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function createWorkTemplate(
  tenantId: string,
  values: WorkTemplateFormValues,
) {
  assertSupabaseConfigured();
  const steps = values.stepTitles
    .split('\n')
    .map((title) => title.trim())
    .filter(Boolean)
    .map((title, index) => ({
      title,
      description: '',
      plannedDays: null,
      isRequired: true,
      sortOrder: index,
    }));
  return request<string>(
    supabaseApi.post('/rpc/create_work_template', {
      p_tenant_id: tenantId,
      p_payload: {
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description.trim(),
        isActive: true,
      },
      p_steps: steps,
    }),
  );
}
