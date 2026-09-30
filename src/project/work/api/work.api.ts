import {
  deleteFileLink,
  listFilesForSubject,
  uploadFilesForSubject,
} from '@/project/files/api/files.api';
import type { FileAttachment } from '@/project/files/model/file';
import { WORK_TAG_GROUP_CODE } from '@/project/tags/model/tag';
import { removeStorageObjects, WORK_ATTACHMENTS_BUCKET } from '@/lib/storage';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  WorkEmployeeOption,
  WorkFormValues,
  WorkItem,
  WorkLabel,
  WorkListFilters,
  WorkTemplate,
  WorkTemplateFormValues,
  WorkTemplateSummary,
} from '../model/work';
import { getWorkLabelColor, mapWorkRpcRow } from '../model/work';

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

interface WorkLabelRow {
  id: string;
  name: string;
  color: string | null;
}

function mapWorkLabel(row: WorkLabelRow): WorkLabel {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? getWorkLabelColor(row.name),
  };
}

export async function loadWorkLabels(tenantId: string): Promise<WorkLabel[]> {
  assertSupabaseConfigured();
  const groups = await request<Array<{ id: string }>>(
    supabaseApi.get('/tag_groups', {
      params: {
        select: 'id',
        tenant_id: `eq.${tenantId}`,
        code: `eq.${WORK_TAG_GROUP_CODE}`,
        kind: 'eq.tag',
        is_active: 'eq.true',
        limit: '1',
      },
    }),
  );
  const groupId = groups[0]?.id;
  if (!groupId) return [];

  const rows = await request<WorkLabelRow[]>(
    supabaseApi.get('/tags', {
      params: {
        select: 'id,name,color',
        tenant_id: `eq.${tenantId}`,
        group_id: `eq.${groupId}`,
        is_active: 'eq.true',
        order: 'name.asc',
      },
    }),
  );
  return rows.map(mapWorkLabel);
}

export async function createWorkLabel(
  tenantId: string,
  name: string,
  color?: string,
): Promise<WorkLabel> {
  assertSupabaseConfigured();
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Vui lòng nhập tên nhãn.');
  const normalizedColor = color?.trim() || getWorkLabelColor(normalizedName);
  if (!/^#[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    throw new Error('Màu nhãn phải có dạng #RRGGBB.');
  }

  const existing = (await loadWorkLabels(tenantId)).find(
    (label) =>
      label.name.toLocaleLowerCase('vi') ===
      normalizedName.toLocaleLowerCase('vi'),
  );
  if (existing) return existing;

  const groups = await request<Array<{ id: string }>>(
    supabaseApi.get('/tag_groups', {
      params: {
        select: 'id',
        tenant_id: `eq.${tenantId}`,
        code: `eq.${WORK_TAG_GROUP_CODE}`,
        kind: 'eq.tag',
        is_active: 'eq.true',
        limit: '1',
      },
    }),
  );
  const groupId = groups[0]?.id;
  if (!groupId) throw new Error('Không tìm thấy nhóm nhãn công việc.');

  try {
    const rows = await request<WorkLabelRow[]>(
      supabaseApi.post(
        '/tags',
        {
          tenant_id: tenantId,
          group_id: groupId,
          code: `work-label-${crypto.randomUUID()}`,
          name: normalizedName,
          description: '',
          color: normalizedColor,
          sort_order: 0,
        },
        { headers: { Prefer: 'return=representation' } },
      ),
    );
    if (!rows[0]) throw new Error('Không thể tạo nhãn công việc.');
    return mapWorkLabel(rows[0]);
  } catch (error) {
    const existingLabel = (await loadWorkLabels(tenantId).catch(() => [])).find(
      (label) =>
        label.name.toLocaleLowerCase('vi') ===
        normalizedName.toLocaleLowerCase('vi'),
    );
    if (existingLabel) return existingLabel;
    throw error;
  }
}

async function loadWorkItemLabels(
  tenantId: string,
  workItemIds: string[],
): Promise<Map<string, WorkLabel[]>> {
  if (workItemIds.length === 0) return new Map();
  const assignments = await request<
    Array<{ subject_id: string; tag_id: string }>
  >(
    supabaseApi.get('/tag_assignments', {
      params: {
        select: 'subject_id,tag_id',
        tenant_id: `eq.${tenantId}`,
        subject_type: 'eq.work_item',
        subject_id: `in.(${workItemIds.join(',')})`,
      },
    }),
  );
  if (assignments.length === 0) return new Map();

  const labels = await loadWorkLabels(tenantId);
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const labelsByWorkItemId = new Map<string, WorkLabel[]>();
  for (const assignment of assignments) {
    const label = labelsById.get(assignment.tag_id);
    if (!label) continue;
    labelsByWorkItemId.set(assignment.subject_id, [
      ...(labelsByWorkItemId.get(assignment.subject_id) ?? []),
      label,
    ]);
  }
  return labelsByWorkItemId;
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
    plannedStartTime: values.plannedStartTime || '00:00',
    plannedEndTime: values.plannedEndTime || '00:00',
    color: values.color,
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
  const labelIdsByWorkItemId = await loadWorkItemLabels(
    tenantId,
    (response.items ?? []).map((row) => String(row.id)),
  );
  return {
    items: (response.items ?? []).map((row) => {
      const item = mapWorkRpcRow(row);
      return {
        ...item,
        labels: labelIdsByWorkItemId.get(item.id) ?? [],
      };
    }),
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
    parent: root?.parentId
      ? (result.items.find((item) => item.id === root.parentId) ?? null)
      : null,
    children: root
      ? result.items.filter((item) => item.parentId === root.id)
      : [],
  };
}

export async function createWorkItem(
  tenantId: string,
  userId: string,
  values: WorkFormValues,
  attachments: File[] = [],
) {
  assertSupabaseConfigured();
  const workItemId = await request<string>(
    supabaseApi.post('/rpc/create_work_item', {
      p_tenant_id: tenantId,
      p_payload: toPayload(values),
    }),
  );
  try {
    await replaceWorkItemLabels(tenantId, workItemId, values.labelIds);
    await uploadWorkItemAttachments(tenantId, workItemId, userId, attachments);
  } catch (error) {
    await supabaseApi
      .delete('/file_links', {
        params: {
          tenant_id: `eq.${tenantId}`,
          subject_type: 'eq.work_item',
          subject_id: `eq.${workItemId}`,
        },
      })
      .catch(() => undefined);
    await supabaseApi
      .delete('/work_items', {
        params: { id: `eq.${workItemId}`, tenant_id: `eq.${tenantId}` },
      })
      .catch(() => undefined);
    throw error;
  }
  return workItemId;
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
        planned_start_time: values.plannedStartTime || '00:00',
        planned_end_time: values.plannedEndTime || '00:00',
        color: values.color,
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
  await replaceWorkItemLabels(tenantId, workItemId, values.labelIds);
}

async function replaceWorkItemLabels(
  tenantId: string,
  workItemId: string,
  labelIds: string[],
) {
  await request(
    supabaseApi.post('/rpc/replace_work_item_labels', {
      p_tenant_id: tenantId,
      p_work_item_id: workItemId,
      p_label_ids: labelIds,
    }),
  );
}

export function loadWorkItemAttachments(
  tenantId: string,
  workItemId: string,
): Promise<FileAttachment[]> {
  return listFilesForSubject(tenantId, 'work_item', workItemId);
}

export function uploadWorkItemAttachments(
  tenantId: string,
  workItemId: string,
  userId: string,
  files: File[],
) {
  return uploadFilesForSubject(
    tenantId,
    'work_item',
    workItemId,
    userId,
    files,
    {
      storageBucket: WORK_ATTACHMENTS_BUCKET,
      storagePathPrefix: workItemId,
    },
  );
}

export function deleteWorkItemAttachment(
  tenantId: string,
  workItemId: string,
  attachmentId: string,
) {
  return deleteFileLink(tenantId, attachmentId, 'work_item', workItemId);
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
  const children = await request<Array<{ id: string }>>(
    supabaseApi.get('/work_items', {
      params: {
        select: 'id',
        tenant_id: `eq.${tenantId}`,
        parent_id: `eq.${workItemId}`,
      },
    }),
  );
  const attachmentsByWorkItem = await Promise.all(
    [workItemId, ...children.map((child) => child.id)].map(
      async (subjectId) => ({
        workItemId: subjectId,
        attachments: await loadWorkItemAttachments(tenantId, subjectId),
      }),
    ),
  );
  await Promise.all(
    attachmentsByWorkItem.flatMap(({ workItemId: subjectId, attachments }) =>
      attachments.map((attachment) =>
        deleteWorkItemAttachment(tenantId, subjectId, attachment.id),
      ),
    ),
  );
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
      user_id: string | null;
      employee_code: string;
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    }>
  >(
    supabaseApi.get('/employees', {
      params: {
        select: 'id,user_id,employee_code,first_name,last_name,avatar_url',
        tenant_id: `eq.${tenantId}`,
        status: 'eq.active',
        order: 'last_name.asc,first_name.asc',
      },
    }),
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    label: `${row.last_name} ${row.first_name}`.trim(),
    secondaryLabel: row.employee_code,
    employeeCode: row.employee_code,
    avatarUrl: row.avatar_url,
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
  options: { activeOnly?: boolean } = {},
): Promise<WorkTemplateSummary[]> {
  assertSupabaseConfigured();
  const [templates, templatesWithParents, assignments, labels] =
    await Promise.all([
      request<Array<Record<string, unknown>>>(
        supabaseApi.get('/work_templates', {
          params: {
            select:
              'id,tenant_id,parent_id,sort_order,code,name,description,priority,assignee_employee_id,color,is_active,created_at,updated_at',
            tenant_id: `eq.${tenantId}`,
            parent_id: 'is.null',
            ...(options.activeOnly ? { is_active: 'eq.true' } : {}),
            order: 'name.asc',
          },
        }),
      ),
      request<Array<Record<string, unknown>>>(
        supabaseApi.get('/work_templates', {
          params: {
            select: 'id,parent_id',
            tenant_id: `eq.${tenantId}`,
          },
        }),
      ),
      request<Array<{ subject_id: string; tag_id: string }>>(
        supabaseApi.get('/tag_assignments', {
          params: {
            select: 'subject_id,tag_id',
            tenant_id: `eq.${tenantId}`,
            subject_type: 'eq.work_template',
          },
        }),
      ),
      loadWorkLabels(tenantId),
    ]);
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  return templates.map((row) => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    code: String(row.code),
    name: String(row.name),
    description: String(row.description ?? ''),
    priority: String(
      row.priority ?? 'normal',
    ) as WorkTemplateSummary['priority'],
    assigneeEmployeeId: row.assignee_employee_id
      ? String(row.assignee_employee_id)
      : null,
    color: String(row.color ?? '#2563eb'),
    parentId: row.parent_id ? String(row.parent_id) : null,
    sortOrder: Number(row.sort_order ?? 0),
    labels: assignments
      .filter((assignment) => assignment.subject_id === row.id)
      .flatMap((assignment) => {
        const label = labelsById.get(assignment.tag_id);
        return label ? [label] : [];
      }),
    childCount: templatesWithParents.filter(
      (child) => child.parent_id === row.id,
    ).length,
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function loadWorkTemplate(
  tenantId: string,
  templateId: string,
): Promise<WorkTemplate> {
  assertSupabaseConfigured();
  const templates = await request<Array<Record<string, unknown>>>(
    supabaseApi.get('/work_templates', {
      params: {
        select:
          'id,tenant_id,parent_id,sort_order,code,name,description,priority,assignee_employee_id,color,is_active,created_at,updated_at',
        tenant_id: `eq.${tenantId}`,
        id: `eq.${templateId}`,
        limit: '1',
      },
    }),
  );
  const row = templates[0];
  if (!row) throw new Error('Không tìm thấy mẫu công việc.');

  const childRows = await request<Array<Record<string, unknown>>>(
    supabaseApi.get('/work_templates', {
      params: {
        select:
          'id,tenant_id,parent_id,sort_order,code,name,description,priority,assignee_employee_id,color,is_active,created_at,updated_at',
        tenant_id: `eq.${tenantId}`,
        parent_id: `eq.${templateId}`,
        order: 'sort_order.asc,id.asc',
      },
    }),
  );
  const childIds = childRows.map((child) => String(child.id));
  const subjectIds = [templateId, ...childIds];
  const [assignments, labels] = await Promise.all([
    request<
      Array<{ subject_type: string; subject_id: string; tag_id: string }>
    >(
      supabaseApi.get('/tag_assignments', {
        params: {
          select: 'subject_type,subject_id,tag_id',
          tenant_id: `eq.${tenantId}`,
          subject_type: 'eq.work_template',
          subject_id: `in.(${subjectIds.join(',')})`,
        },
      }),
    ),
    loadWorkLabels(tenantId),
  ]);
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const labelsFor = (subjectType: string, subjectId: string) =>
    assignments
      .filter(
        (assignment) =>
          assignment.subject_type === subjectType &&
          assignment.subject_id === subjectId,
      )
      .flatMap((assignment) => {
        const label = labelsById.get(assignment.tag_id);
        return label ? [label] : [];
      });

  const toSummary = (
    templateRow: Record<string, unknown>,
    templateChildren: number,
  ): WorkTemplateSummary => {
    const id = String(templateRow.id);
    return {
      id,
      tenantId: String(templateRow.tenant_id),
      parentId: templateRow.parent_id ? String(templateRow.parent_id) : null,
      sortOrder: Number(templateRow.sort_order ?? 0),
      code: String(templateRow.code),
      name: String(templateRow.name),
      description: String(templateRow.description ?? ''),
      priority: String(
        templateRow.priority ?? 'normal',
      ) as WorkTemplate['priority'],
      assigneeEmployeeId: templateRow.assignee_employee_id
        ? String(templateRow.assignee_employee_id)
        : null,
      color: String(templateRow.color ?? '#2563eb'),
      labels: labelsFor('work_template', id),
      childCount: templateChildren,
      isActive: Boolean(templateRow.is_active),
      createdAt: String(templateRow.created_at),
      updatedAt: String(templateRow.updated_at),
    };
  };

  return {
    ...toSummary(row, childRows.length),
    children: childRows.map((child) => toSummary(child, 0)),
  };
}

export async function saveWorkTemplate(
  tenantId: string,
  templateId: string | null,
  parentId: string | null,
  sortOrder: number,
  values: WorkTemplateFormValues,
) {
  assertSupabaseConfigured();
  return request<string>(
    supabaseApi.post('/rpc/save_work_template', {
      p_tenant_id: tenantId,
      p_template_id: templateId,
      p_parent_id: parentId,
      p_sort_order: sortOrder,
      p_payload: {
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description.trim(),
        priority: values.priority,
        assigneeEmployeeId: values.assigneeEmployeeId || null,
        color: values.color,
      },
      p_label_ids: values.labelIds,
    }),
  );
}

export async function updateWorkTemplatesAvailability(
  tenantId: string,
  templateIds: string[],
  isActive: boolean,
) {
  assertSupabaseConfigured();
  if (templateIds.length === 0) return;
  await supabaseApi.patch(
    '/work_templates',
    { is_active: isActive },
    {
      params: {
        id: `in.(${templateIds.join(',')})`,
        tenant_id: `eq.${tenantId}`,
      },
    },
  );
}

export async function deleteWorkTemplates(
  tenantId: string,
  templateIds: string[],
): Promise<{ storageCleanupFailed: boolean }> {
  assertSupabaseConfigured();
  const uniqueTemplateIds = Array.from(new Set(templateIds));
  if (uniqueTemplateIds.length === 0) {
    return { storageCleanupFailed: false };
  }

  const templateData = await Promise.all(
    uniqueTemplateIds.map(async (templateId) => {
      const template = await loadWorkTemplate(tenantId, templateId);
      const attachmentsByTemplate = await Promise.all(
        [template, ...template.children].map(async (item) => ({
          templateId: item.id,
          attachments: await loadWorkTemplateAttachments(tenantId, item.id),
        })),
      );
      return attachmentsByTemplate;
    }),
  );

  let storageCleanupFailed = false;
  for (const templates of templateData) {
    for (const { templateId, attachments } of templates) {
      for (const attachment of attachments) {
        const result = await deleteWorkTemplateAttachment(
          tenantId,
          templateId,
          attachment.id,
        );
        storageCleanupFailed ||= result.storageCleanupFailed;
      }
    }
  }

  await request(
    supabaseApi.post('/rpc/delete_work_templates', {
      p_tenant_id: tenantId,
      p_template_ids: uniqueTemplateIds,
    }),
  );

  return { storageCleanupFailed };
}

export function loadWorkTemplateAttachments(
  tenantId: string,
  templateId: string,
): Promise<FileAttachment[]> {
  return listFilesForSubject(tenantId, 'work_template', templateId);
}

export function uploadWorkTemplateAttachments(
  tenantId: string,
  templateId: string,
  userId: string,
  files: File[],
) {
  return uploadFilesForSubject(
    tenantId,
    'work_template',
    templateId,
    userId,
    files,
    {
      storageBucket: WORK_ATTACHMENTS_BUCKET,
      storagePathPrefix: templateId,
    },
  );
}

export async function deleteWorkTemplateAttachment(
  tenantId: string,
  templateId: string,
  attachmentId: string,
): Promise<{ storageCleanupFailed: boolean }> {
  assertSupabaseConfigured();
  const response = await request<{
    storageBucket: string | null;
    storagePath: string | null;
    removeStorageObject: boolean;
  }>(
    supabaseApi.post('/rpc/delete_work_template_attachment', {
      p_tenant_id: tenantId,
      p_template_id: templateId,
      p_attachment_id: attachmentId,
    }),
  );
  if (
    !response.removeStorageObject ||
    !response.storageBucket ||
    !response.storagePath
  ) {
    return { storageCleanupFailed: false };
  }
  try {
    await removeStorageObjects(response.storageBucket, [response.storagePath]);
    return { storageCleanupFailed: false };
  } catch {
    // The database has already detached the template and tombstoned work refs.
    return { storageCleanupFailed: true };
  }
}
