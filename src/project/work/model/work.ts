import { z } from 'zod';

export const WORK_STATUSES = [
  'draft',
  'todo',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type WorkPriority = (typeof WORK_PRIORITIES)[number];

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  draft: 'Bản nháp',
  todo: 'Chưa thực hiện',
  in_progress: 'Đang thực hiện',
  paused: 'Tạm dừng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export const WORK_PRIORITY_LABELS: Record<WorkPriority, string> = {
  low: 'Thấp',
  normal: 'Bình thường',
  high: 'Cao',
  urgent: 'Khẩn cấp',
};

const optionalUuid = z.string().uuid('Giá trị không hợp lệ').or(z.literal(''));
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ')
  .or(z.literal(''));
const optionalTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ không hợp lệ')
  .or(z.literal(''));
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Màu không hợp lệ.');

export const workFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Vui lòng nhập tên công việc.'),
    description: z.string().trim().max(5000, 'Mô tả không quá 5.000 ký tự.'),
    status: z.enum(WORK_STATUSES),
    priority: z.enum(WORK_PRIORITIES),
    assigneeEmployeeId: optionalUuid,
    parentId: optionalUuid,
    templateId: optionalUuid,
    plannedStartDate: optionalDate,
    plannedEndDate: optionalDate,
    plannedStartTime: optionalTime,
    plannedEndTime: optionalTime,
    color: hexColor,
    customerIds: z.array(z.string().uuid()),
    contractIds: z.array(z.string().uuid()),
  })
  .superRefine((value, ctx) => {
    if (
      value.plannedStartDate &&
      value.plannedEndDate &&
      value.plannedEndDate < value.plannedStartDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plannedEndDate'],
        message: 'Ngày hoàn thành dự kiến phải sau hoặc bằng ngày bắt đầu.',
      });
    }

    if (
      value.plannedStartDate &&
      value.plannedEndDate &&
      value.plannedStartDate === value.plannedEndDate &&
      value.plannedStartTime &&
      value.plannedEndTime &&
      value.plannedEndTime < value.plannedStartTime
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plannedEndTime'],
        message: 'Giờ hoàn thành dự kiến phải sau hoặc bằng giờ bắt đầu.',
      });
    }
  });

export type WorkFormValues = z.infer<typeof workFormSchema>;

export const workTemplateFormSchema = z.object({
  code: z.string().trim().min(1, 'Vui lòng nhập mã mẫu.'),
  name: z.string().trim().min(1, 'Vui lòng nhập tên mẫu.'),
  description: z.string().trim().max(5000, 'Mô tả không quá 5.000 ký tự.'),
  stepTitles: z.string().trim(),
});
export type WorkTemplateFormValues = z.infer<typeof workTemplateFormSchema>;

export interface WorkLinkOption {
  id: string;
  label: string;
  secondaryLabel?: string;
}

export interface WorkItem {
  id: string;
  tenantId: string;
  code: string;
  parentId: string | null;
  templateId: string | null;
  title: string;
  description: string;
  status: WorkStatus;
  priority: WorkPriority;
  assigneeEmployeeId: string | null;
  assigneeName: string;
  assigneeCode: string;
  sortOrder: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  color: string;
  actualStartedAt: string | null;
  actualCompletedAt: string | null;
  childCount: number;
  completedChildCount: number;
  customers: WorkLinkOption[];
  contracts: WorkLinkOption[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkTemplateStep {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  plannedDays: number | null;
  isRequired: boolean;
}

export interface WorkTemplate {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  steps: WorkTemplateStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkEmployeeOption extends WorkLinkOption {
  userId: string | null;
  employeeCode: string;
  avatarUrl: string | null;
}

export interface WorkListFilters {
  search: string;
  statuses: WorkStatus[];
  priority: WorkPriority | '';
  assigneeEmployeeId: string;
  scope: 'all' | 'mine';
  page: number;
  pageSize: number;
}

export const workDefaultValues: WorkFormValues = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'normal',
  assigneeEmployeeId: '',
  parentId: '',
  templateId: '',
  plannedStartDate: '',
  plannedEndDate: '',
  plannedStartTime: '00:00',
  plannedEndTime: '00:00',
  color: '#2563eb',
  customerIds: [],
  contractIds: [],
};

export const workTemplateDefaultValues: WorkTemplateFormValues = {
  code: '',
  name: '',
  description: '',
  stepTitles: '',
};

export function mapWorkRpcRow(row: Record<string, unknown>): WorkItem {
  const toNumber = (value: unknown) => Number(value ?? 0);
  const toLinks = (value: unknown): WorkLinkOption[] =>
    Array.isArray(value)
      ? value.map((item) => {
          const link = item as Record<string, unknown>;
          return {
            id: String(link.id),
            label: String(link.label ?? link.name ?? ''),
            secondaryLabel:
              link.secondaryLabel !== undefined || link.code !== undefined
                ? String(link.secondaryLabel ?? link.code)
                : undefined,
          };
        })
      : [];

  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    code: String(row.code ?? ''),
    parentId: row.parentId ? String(row.parentId) : null,
    templateId: row.templateId ? String(row.templateId) : null,
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    status: row.status as WorkStatus,
    priority: row.priority as WorkPriority,
    assigneeEmployeeId: row.assigneeEmployeeId
      ? String(row.assigneeEmployeeId)
      : null,
    assigneeName: String(row.assigneeName ?? ''),
    assigneeCode: String(row.assigneeCode ?? row.assigneeEmployeeCode ?? ''),
    sortOrder: toNumber(row.sortOrder),
    plannedStartDate: row.plannedStartDate
      ? String(row.plannedStartDate)
      : null,
    plannedEndDate: row.plannedEndDate ? String(row.plannedEndDate) : null,
    plannedStartTime: row.plannedStartTime
      ? String(row.plannedStartTime).slice(0, 5)
      : '00:00',
    plannedEndTime: row.plannedEndTime
      ? String(row.plannedEndTime).slice(0, 5)
      : '00:00',
    color: String(row.color ?? '#2563eb'),
    actualStartedAt: row.actualStartedAt ? String(row.actualStartedAt) : null,
    actualCompletedAt: row.actualCompletedAt
      ? String(row.actualCompletedAt)
      : null,
    childCount: toNumber(row.childCount),
    completedChildCount: toNumber(row.completedChildCount),
    customers: toLinks(row.customers),
    contracts: toLinks(row.contracts),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  };
}

export function workProgress(work: WorkItem): number {
  if (work.status === 'completed') return 100;
  if (work.childCount === 0) return work.status === 'in_progress' ? 50 : 0;
  return Math.round((work.completedChildCount / work.childCount) * 100);
}

export function isWorkOverdue(work: WorkItem, today = new Date()): boolean {
  if (
    !work.plannedEndDate ||
    ['completed', 'cancelled'].includes(work.status)
  ) {
    return false;
  }
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  const end = new Date(`${work.plannedEndDate}T23:59:59`);
  return end < current;
}

export function toWorkFormValues(work: WorkItem): WorkFormValues {
  return {
    title: work.title,
    description: work.description,
    status: work.status,
    priority: work.priority,
    assigneeEmployeeId: work.assigneeEmployeeId ?? '',
    parentId: work.parentId ?? '',
    templateId: work.templateId ?? '',
    plannedStartDate: work.plannedStartDate ?? '',
    plannedEndDate: work.plannedEndDate ?? '',
    plannedStartTime: work.plannedStartTime ?? '00:00',
    plannedEndTime: work.plannedEndTime ?? '00:00',
    color: work.color || '#2563eb',
    customerIds: work.customers.map((item) => item.id),
    contractIds: work.contracts.map((item) => item.id),
  };
}
