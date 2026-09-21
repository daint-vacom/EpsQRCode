import { useEffect, useState, type ReactNode } from 'react';
import {
  FileText,
  Link2,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SectionLoading } from '@/components/ui/loading';
import type { SelectOption } from '@/components/ui/option-select';
import { RichTextContent } from '@/components/ui/rich-text-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  WORK_PRIORITY_LABELS,
  workProgress,
  type WorkItem,
} from '../model/work';
import { WorkPriorityIcon } from './work-priority-icon';
import { WorkStatusBadge } from './work-status-badge';

type WorkDetailTab = 'description' | 'children' | 'details';

interface WorkDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  work: WorkItem | null;
  parentWork?: WorkItem | null;
  children: WorkItem[];
  isLoading?: boolean;
  errorMessage?: string;
  assigneeEmployeeOptions?: SelectOption[];
  parentOptions?: SelectOption[];
  templateOptions?: SelectOption[];
  onEdit?: (work: WorkItem) => void;
  onCreateChild?: (work: WorkItem) => void;
}

function formatPlannedDate(date: string | null, time: string | null) {
  if (!date) return '—';
  return time ? `${formatDate(date)} · ${time}` : formatDate(date);
}

function optionLabel(
  options: SelectOption[] | undefined,
  value: string | null,
) {
  if (!value) return '—';
  const option = options?.find((item) => item.value === value);
  if (!option) return 'Đã liên kết';
  return typeof option.label === 'string' ? option.label : 'Đã liên kết';
}

function formatParentLabel(work: WorkItem) {
  return work.code ? `${work.code} - ${work.title}` : work.title;
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid items-center grid-cols-[8.75rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg px-3 py-2',
        className,
      )}
    >
      <p className="text-sm font-normal text-foreground">{label}</p>
      <div className="min-w-0 text-sm text-foreground">{children}</div>
    </div>
  );
}

function DetailValue({ children }: { children: ReactNode }) {
  return <div className="font-medium">{children}</div>;
}

function WorkLinks({ work }: { work: WorkItem }) {
  const links = [
    ...work.customers.map((item) => ({ ...item, prefix: 'KH' })),
    ...work.contracts.map((item) => ({ ...item, prefix: 'HĐ' })),
  ];

  if (!links.length) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((item) => (
        <Badge key={`${item.prefix}-${item.id}`} variant="secondary">
          {item.prefix}: {item.label}
        </Badge>
      ))}
    </div>
  );
}

function WorkChildren({
  children,
  isLoading,
  onCreateChild,
}: {
  children: WorkItem[];
  isLoading: boolean;
  onCreateChild?: () => void;
}) {
  if (isLoading) {
    return (
      <SectionLoading
        className="min-h-56 bg-transparent"
        label="Đang tải đầu mục con..."
      />
    );
  }

  if (!children.length) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ListChecks className="size-5" />
        </span>
        <p className="text-sm font-semibold text-foreground">
          Chưa có công việc con
        </p>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Bạn có thể thêm đầu mục con để theo dõi các phần việc độc lập.
        </p>
        {onCreateChild ? (
          <Button
            type="button"
            size="sm"
            className="mt-4"
            onClick={onCreateChild}
          >
            <Plus /> Thêm công việc
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {children.map((child) => (
        <div
          key={child.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {child.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {child.assigneeName || 'Chưa giao'} ·{' '}
              {child.plannedEndDate
                ? formatPlannedDate(child.plannedEndDate, child.plannedEndTime)
                : 'Chưa có hạn'}
            </p>
          </div>
          <WorkStatusBadge status={child.status} size="sm" />
        </div>
      ))}
    </div>
  );
}

export function WorkDetailDialog({
  open,
  onOpenChange,
  work,
  parentWork,
  children,
  isLoading = false,
  errorMessage,
  assigneeEmployeeOptions,
  parentOptions,
  templateOptions,
  onEdit,
  onCreateChild,
}: WorkDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<WorkDetailTab>('description');

  useEffect(() => {
    if (open) setActiveTab('description');
  }, [open, work?.id]);

  const assigneeOption = assigneeEmployeeOptions?.find(
    (option) => option.value === work?.assigneeEmployeeId,
  );
  const parentLabel = parentWork
    ? formatParentLabel(parentWork)
    : work?.parentId
      ? optionLabel(parentOptions, work.parentId)
      : 'Công việc gốc';
  const parentName = parentWork?.title ?? parentLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0"
        aria-labelledby="work-detail-dialog-title"
      >
        <DialogHeader className="sr-only">
          <DialogTitle id="work-detail-dialog-title">
            {work?.title ?? 'Chi tiết công việc'}
          </DialogTitle>
          <DialogDescription>
            Xem thông tin chi tiết, mô tả và các đầu mục con của công việc.
          </DialogDescription>
        </DialogHeader>

        {!work ? (
          <SectionLoading
            className="min-h-80 flex-1 rounded-none bg-transparent"
            label="Đang tải công việc..."
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
            <div className="space-y-7">
              <div className="sticky top-0 z-10 -mx-6 bg-background px-6 pb-3 pt-4">
                <div className="flex items-start gap-3 pe-10">
                  <span
                    aria-label={`Màu công việc ${work.color}`}
                    className="mt-1 size-8 shrink-0 rounded-md"
                    style={{ backgroundColor: work.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {work.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {work.code}
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    'mt-3 flex items-center gap-4',
                    work.parentId ? 'justify-between' : 'justify-end',
                  )}
                >
                  {work.parentId ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="primary"
                          mode="link"
                          className="min-w-0 max-w-full justify-start gap-1.5 text-sm"
                        >
                          <Link2 className="size-3.5" />
                          <span className="truncate">{parentLabel}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Công việc cha: {parentName}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                  {onEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 shrink-0 gap-1 px-2 text-xs [&_svg:not([class*=size-])]:size-3"
                      onClick={() => onEdit(work)}
                    >
                      <Pencil /> Chỉnh sửa
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid gap-2 lg:grid-cols-2 lg:gap-x-8">
                  <DetailField label="Trạng thái">
                    <WorkStatusBadge status={work.status} size="sm" />
                  </DetailField>
                  <DetailField label="Mức độ ưu tiên">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <WorkPriorityIcon priority={work.priority} />
                      {WORK_PRIORITY_LABELS[work.priority]}
                    </span>
                  </DetailField>
                </div>

                <div className="grid items-start gap-2 lg:grid-cols-2 lg:gap-x-8">
                  <div className="space-y-2">
                    <DetailField
                      label="Nhân viên phụ trách"
                      className="items-start"
                    >
                      <div>
                        <DetailValue>
                          {assigneeOption?.label ??
                            (work.assigneeName || 'Chưa giao')}
                        </DetailValue>
                        {!assigneeOption?.label && work.assigneeCode ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {work.assigneeCode}
                          </span>
                        ) : null}
                      </div>
                    </DetailField>
                  </div>

                  <div className="space-y-2">
                    <DetailField label="Ngày bắt đầu">
                      <DetailValue>
                        {formatPlannedDate(
                          work.plannedStartDate,
                          work.plannedStartTime,
                        )}
                      </DetailValue>
                    </DetailField>
                    <DetailField label="Ngày kết thúc">
                      <DetailValue>
                        {formatPlannedDate(
                          work.plannedEndDate,
                          work.plannedEndTime,
                        )}
                      </DetailValue>
                    </DetailField>
                  </div>
                </div>
              </div>

              {errorMessage ? (
                <p className="text-sm text-destructive" role="alert">
                  Không tải được dữ liệu mới nhất: {errorMessage}
                </p>
              ) : null}

              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as WorkDetailTab)}
                className="flex flex-col"
              >
                <TabsList
                  variant="line"
                  size="md"
                  className="w-full justify-start gap-5 overflow-x-auto"
                >
                  <TabsTrigger value="description">
                    <FileText /> Mô tả
                  </TabsTrigger>
                  <TabsTrigger value="children">
                    <ListChecks /> Công việc con
                  </TabsTrigger>
                  <TabsTrigger value="details">
                    <MoreHorizontal /> Thông tin khác
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="description" className="mt-5">
                  {work.description ? (
                    <RichTextContent content={work.description} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                      Chưa có mô tả.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="children" className="mt-5">
                  <WorkChildren
                    children={children}
                    isLoading={isLoading}
                    onCreateChild={
                      onCreateChild ? () => onCreateChild(work) : undefined
                    }
                  />
                </TabsContent>

                <TabsContent value="details" className="mt-5 space-y-6">
                  <section className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">
                      Bối cảnh nghiệp vụ
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailField label="Thuộc công việc">
                        <DetailValue>
                          {optionLabel(parentOptions, work.parentId)}
                        </DetailValue>
                      </DetailField>
                      <DetailField label="Mẫu công việc">
                        <DetailValue>
                          {optionLabel(templateOptions, work.templateId)}
                        </DetailValue>
                      </DetailField>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">
                      Liên kết nghiệp vụ
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailField label="Khách hàng liên quan">
                        <WorkLinks work={{ ...work, contracts: [] }} />
                      </DetailField>
                      <DetailField label="Hợp đồng liên quan">
                        <WorkLinks work={{ ...work, customers: [] }} />
                      </DetailField>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">
                      Tiến độ thực tế
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailField label="Bắt đầu thực tế">
                        <DetailValue>
                          {work.actualStartedAt
                            ? formatDateTime(work.actualStartedAt)
                            : '—'}
                        </DetailValue>
                      </DetailField>
                      <DetailField label="Hoàn thành thực tế">
                        <DetailValue>
                          {work.actualCompletedAt
                            ? formatDateTime(work.actualCompletedAt)
                            : '—'}
                        </DetailValue>
                      </DetailField>
                      <DetailField label="Tiến độ">
                        <DetailValue>{workProgress(work)}%</DetailValue>
                      </DetailField>
                      <DetailField label="Đầu mục con">
                        <DetailValue>
                          {work.completedChildCount}/{work.childCount}
                        </DetailValue>
                      </DetailField>
                    </div>
                  </section>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
