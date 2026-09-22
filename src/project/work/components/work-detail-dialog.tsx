import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AtSign,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Copy,
  Ellipsis,
  FileText,
  ListChecks,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Smile,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { formatDate, formatDateTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorInput } from '@/components/ui/color-input';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { SectionLoading } from '@/components/ui/loading';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import {
  RichTextContent,
  RichTextEditor,
} from '@/components/ui/rich-text-editor';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CustomerIdentity } from '../../customers/components/customer-identity';
import {
  toWorkFormValues,
  workProgress,
  type WorkFormValues,
  type WorkItem,
} from '../model/work';
import { WorkStatusBadge } from './work-status-badge';

type WorkDetailTab = 'details' | 'children' | 'attachments' | 'comments';
type ConfirmAction = 'close' | 'create-child' | null;

interface WorkDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'create' | 'edit';
  title?: string;
  work: WorkItem | null;
  children: WorkItem[];
  isLoading?: boolean;
  errorMessage?: string;
  form: UseFormReturn<WorkFormValues>;
  isSaving?: boolean;
  statusOptions: SelectOption[];
  priorityOptions: SelectOption[];
  assigneeEmployeeOptions: SelectOption[];
  customerOptions: MultiSelectOption[];
  contractOptions: MultiSelectOption[];
  onSave: (values: WorkFormValues) => Promise<unknown> | void;
  onCreateChild?: (work: WorkItem) => void;
}

function formatPlannedDate(date: string | null, time: string | null) {
  if (!date) return '—';
  return time ? `${formatDate(date)} · ${time}` : formatDate(date);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function SectionHeading({
  title,
  count,
  action,
}: {
  title: string;
  count?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        {title}
        {count ? (
          <span className="ms-1 font-normal text-muted-foreground">
            ({count})
          </span>
        ) : null}
      </h3>
      {action}
    </div>
  );
}

function WorkChildren({
  work,
  children,
  isLoading,
  onCreateChild,
}: {
  work: WorkItem;
  children: WorkItem[];
  isLoading: boolean;
  onCreateChild?: () => void;
}) {
  const progress = work.childCount ? workProgress(work) : 0;

  if (isLoading) {
    return (
      <SectionLoading
        className="min-h-40 bg-transparent"
        label="Đang tải công việc con..."
      />
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Công việc con"
        count={`${work.completedChildCount}/${work.childCount}`}
        action={
          onCreateChild ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCreateChild}
            >
              <Plus /> Thêm công việc con
            </Button>
          ) : null
        }
      />
      <div className="flex items-center gap-3">
        <Progress value={progress} className="h-1.5" />
        <span className="shrink-0 text-xs text-muted-foreground">
          {progress}%
        </span>
      </div>
      {children.length ? (
        <div className="divide-y divide-border border-y border-border">
          {children.map((child) => (
            <div
              key={child.id}
              className="flex min-h-11 items-center gap-3 py-2.5"
            >
              <Checkbox
                size="sm"
                checked={child.status === 'completed'}
                disabled
                aria-label={`Trạng thái ${child.title}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {child.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {child.plannedEndDate
                    ? formatPlannedDate(
                        child.plannedEndDate,
                        child.plannedEndTime,
                      )
                    : 'Chưa có hạn'}
                </p>
              </div>
              {child.assigneeName ? (
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback>
                    {getInitials(child.assigneeName)}
                  </AvatarFallback>
                </Avatar>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                disabled
                aria-label={`Thao tác với ${child.title}`}
              >
                <MoreHorizontal />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function WorkAttachments() {
  // TODO(work-detail-dialog): connect attachments query, upload, preview and
  // item actions when the backend file contract is available.
  return (
    <section className="space-y-3">
      <SectionHeading
        title="Tệp đính kèm"
        count="0"
        action={
          <Button type="button" variant="outline" size="sm" disabled>
            <Upload /> Thêm tệp
          </Button>
        }
      />
    </section>
  );
}

function WorkComments() {
  // TODO(work-detail-dialog): connect comment feed, mentions, reactions and
  // submit/edit/delete mutations when the backend supports them.
  return (
    <section className="space-y-3">
      <SectionHeading title="Bình luận" count="0" />
      <div className="flex items-start gap-3">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback>ME</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 rounded-md border border-input bg-background shadow-xs shadow-black/5">
          <div className="px-3 py-2.5 text-sm text-muted-foreground">
            Viết bình luận...
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/70 px-2 py-1.5">
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                disabled
                aria-label="Đính kèm tệp"
              >
                <Paperclip />
              </Button>
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                disabled
                aria-label="Nhắc người dùng"
              >
                <AtSign />
              </Button>
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                disabled
                aria-label="Thêm biểu tượng cảm xúc"
              >
                <Smile />
              </Button>
            </div>
            <Button type="button" size="sm" disabled>
              <Send /> Gửi
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkReadOnlyProperty({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid items-start grid-cols-[8.75rem_minmax(0,1fr)] gap-x-2">
      <span className="flex items-center gap-2 whitespace-nowrap pt-0.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </span>
      <span
        className={cn(
          'min-w-0 text-sm',
          value === '—' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

type WorkLinkPickerKind = 'customer' | 'contract';

function getWorkLinkOptionLabel(option: MultiSelectOption) {
  if (typeof option.label === 'string' || typeof option.label === 'number') {
    return String(option.label);
  }

  return option.ariaLabel ?? option.value;
}

function getWorkLinkOptionCode(option: MultiSelectOption) {
  if (!option.data || typeof option.data !== 'object') return '';

  const data = option.data as {
    code?: unknown;
    secondaryLabel?: unknown;
  };
  const code = data.secondaryLabel ?? data.code;

  return typeof code === 'string' ? code : '';
}

function WorkLinkIdentity({
  option,
  kind,
}: {
  option: MultiSelectOption;
  kind: WorkLinkPickerKind;
}) {
  const name = getWorkLinkOptionLabel(option);
  const code = getWorkLinkOptionCode(option);

  if (kind === 'customer') {
    return (
      <CustomerIdentity
        customer={{ name, customerCode: code, imageUrl: null }}
        className="min-w-0"
      />
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">
          {name}
        </span>
        {code ? (
          <span className="block truncate text-xs text-muted-foreground">
            {code}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function WorkLinkPicker({
  value,
  options,
  kind,
  onChange,
  disabled,
}: {
  value: string[];
  options: MultiSelectOption[];
  kind: WorkLinkPickerKind;
  onChange: (value: string[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedOptions = value
    .map((item) => options.find((option) => option.value === item))
    .filter((option): option is MultiSelectOption => Boolean(option));
  const availableOptions = options.filter(
    (option) => !value.includes(option.value),
  );

  return (
    <div className="min-w-0 space-y-2">
      {selectedOptions.map((option) => {
        const optionLabel = getWorkLinkOptionLabel(option);

        return (
          <div
            key={option.value}
            className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 shadow-xs shadow-black/5"
          >
            <div className="min-w-0 flex-1">
              <WorkLinkIdentity option={option} kind={kind} />
            </div>
            <Button
              type="button"
              variant="ghost"
              mode="icon"
              size="sm"
              aria-label={`Bỏ ${optionLabel}`}
              title={`Bỏ ${optionLabel}`}
              onClick={() =>
                onChange(value.filter((item) => item !== option.value))
              }
              disabled={disabled}
            >
              <X />
            </Button>
          </div>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2 text-muted-foreground"
            disabled={disabled || availableOptions.length === 0}
          >
            <Plus /> Thêm
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        >
          <Command>
            <CommandInput
              placeholder={
                kind === 'customer' ? 'Tìm khách hàng...' : 'Tìm hợp đồng...'
              }
            />
            <CommandList>
              <CommandEmpty>
                {kind === 'customer'
                  ? 'Không có khách hàng phù hợp'
                  : 'Không có hợp đồng phù hợp'}
              </CommandEmpty>
              {availableOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${getWorkLinkOptionLabel(option)} ${getWorkLinkOptionCode(option)} ${option.searchableText ?? ''}`}
                  disabled={option.disabled}
                  onSelect={() => {
                    onChange([...value, option.value]);
                    setOpen(false);
                  }}
                  className="min-h-12"
                >
                  <WorkLinkIdentity option={option} kind={kind} />
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function WorkProperties({
  work,
  form,
  isSaving,
  onDirty,
  assigneeEmployeeOptions,
  customerOptions,
  contractOptions,
}: {
  work: WorkItem | null;
  form: UseFormReturn<WorkFormValues>;
  isSaving: boolean;
  onDirty: () => void;
  assigneeEmployeeOptions: SelectOption[];
  customerOptions: MultiSelectOption[];
  contractOptions: MultiSelectOption[];
}) {
  return (
    <div className="space-y-4 px-6 py-5">
      <FormField
        control={form.control}
        name="assigneeEmployeeId"
        render={({ field }) => (
          <FormItem
            variant="compact"
            layout="horizontal"
            labelWidth="md"
            labelGap="sm"
          >
            <FormLabel className="flex items-center gap-2 whitespace-nowrap">
              <UserRound className="size-3.5" /> NV phụ trách
            </FormLabel>
            <FormControl>
              <OptionSelect
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  onDirty();
                }}
                options={assigneeEmployeeOptions}
                placeholder="Chọn nhân viên"
                searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
                emptyMessage="Không tìm thấy nhân viên phù hợp"
                renderOption={(option) => option.label}
                className="h-auto min-h-14 border-transparent bg-transparent py-2 shadow-none hover:bg-accent data-[state=open]:bg-accent"
                disabled={isSaving}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="plannedStartDate"
        render={({ field }) => (
          <FormItem
            variant="compact"
            layout="horizontal"
            labelWidth="md"
            labelGap="sm"
          >
            <FormLabel className="flex items-center gap-2 whitespace-nowrap">
              <CalendarDays className="size-3.5" /> Từ
            </FormLabel>
            <FormControl>
              <DatePickerInput
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  onDirty();
                }}
                onBlur={field.onBlur}
                calendarLabel="Chọn thời gian bắt đầu dự kiến"
                valueMode="iso-date"
                variant="md"
                showTime
                timeValue={form.watch('plannedStartTime')}
                timeLabel="Giờ bắt đầu dự kiến"
                onTimeChange={(value) =>
                  form.setValue('plannedStartTime', value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                onTimeBlur={() => void form.trigger('plannedStartTime')}
                disabled={isSaving}
              />
            </FormControl>
            <FormMessage />
            {form.formState.errors.plannedStartTime?.message ? (
              <p className="col-start-2 text-xs font-normal text-destructive">
                {String(form.formState.errors.plannedStartTime.message)}
              </p>
            ) : null}
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="plannedEndDate"
        render={({ field }) => (
          <FormItem
            variant="compact"
            layout="horizontal"
            labelWidth="md"
            labelGap="sm"
          >
            <FormLabel className="flex items-center gap-2 whitespace-nowrap">
              <CalendarDays className="size-3.5" /> Đến
            </FormLabel>
            <FormControl>
              <DatePickerInput
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  onDirty();
                }}
                onBlur={field.onBlur}
                calendarLabel="Chọn thời gian kết thúc dự kiến"
                valueMode="iso-date"
                variant="md"
                showTime
                timeValue={form.watch('plannedEndTime')}
                timeLabel="Giờ kết thúc dự kiến"
                onTimeChange={(value) =>
                  form.setValue('plannedEndTime', value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                onTimeBlur={() => void form.trigger('plannedEndTime')}
                disabled={isSaving}
              />
            </FormControl>
            <FormMessage />
            {form.formState.errors.plannedEndTime?.message ? (
              <p className="col-start-2 text-xs font-normal text-destructive">
                {String(form.formState.errors.plannedEndTime.message)}
              </p>
            ) : null}
          </FormItem>
        )}
      />

      {work ? (
        <>
          <WorkReadOnlyProperty
            icon={Clock3}
            label="Thực tế"
            value={
              work.actualStartedAt || work.actualCompletedAt ? (
                <div className="space-y-0.5">
                  <div className="truncate">
                    <span className="text-muted-foreground">Từ:</span>{' '}
                    {work.actualStartedAt
                      ? formatDateTime(work.actualStartedAt)
                      : '—'}
                  </div>
                  <div className="truncate">
                    <span className="text-muted-foreground">Đến:</span>{' '}
                    {work.actualCompletedAt
                      ? formatDateTime(work.actualCompletedAt)
                      : '—'}
                  </div>
                </div>
              ) : (
                '—'
              )
            }
          />
        </>
      ) : null}

      <Separator />

      <FormField
        control={form.control}
        name="customerIds"
        render={({ field }) => (
          <FormItem
            variant="compact"
            layout="horizontal"
            labelWidth="md"
            labelGap="sm"
          >
            <FormLabel className="flex items-center gap-2 whitespace-nowrap">
              <Building2 className="size-3.5" /> Khách hàng
            </FormLabel>
            <FormControl>
              <WorkLinkPicker
                value={field.value}
                options={customerOptions}
                kind="customer"
                onChange={(value) => {
                  field.onChange(value);
                  onDirty();
                }}
                disabled={isSaving}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contractIds"
        render={({ field }) => (
          <FormItem
            variant="compact"
            layout="horizontal"
            labelWidth="md"
            labelGap="sm"
          >
            <FormLabel className="flex items-center gap-2 whitespace-nowrap">
              <FileText className="size-3.5" /> Hợp đồng
            </FormLabel>
            <FormControl>
              <WorkLinkPicker
                value={field.value}
                options={contractOptions}
                kind="contract"
                onChange={(value) => {
                  field.onChange(value);
                  onDirty();
                }}
                disabled={isSaving}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function WorkDetailDialog({
  open,
  onOpenChange,
  mode = 'edit',
  title,
  work,
  children,
  isLoading = false,
  errorMessage,
  form,
  isSaving = false,
  statusOptions,
  priorityOptions,
  assigneeEmployeeOptions,
  customerOptions,
  contractOptions,
  onSave,
  onCreateChild,
}: WorkDetailDialogProps) {
  const isCreateMode = mode === 'create';
  const dialogTitle =
    title ?? (isCreateMode ? 'Thêm công việc' : 'Chi tiết công việc');
  const childCountLabel = work
    ? `${work.completedChildCount}/${work.childCount}`
    : '0/0';
  // TODO(work-detail-dialog): derive these counts from the attachments and
  // comment feeds when their backend contracts are available.
  const attachmentCount = 0;
  const commentCount = 0;
  const [activeTab, setActiveTab] = useState<WorkDetailTab>('details');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isDescriptionEditing, setIsDescriptionEditing] =
    useState(isCreateMode);
  const trackingKeyRef = useRef<string | null>(null);
  const dialogKey = open
    ? (work?.id ?? (isCreateMode ? 'create' : null))
    : null;
  if (trackingKeyRef.current !== dialogKey) {
    trackingKeyRef.current = null;
  }
  const isDirty = hasPendingChanges;
  const markDirty = () => {
    if (trackingKeyRef.current === dialogKey) {
      setHasPendingChanges(true);
    }
  };

  useEffect(() => {
    if (!open) return;

    setActiveTab('details');
    if (work) {
      form.reset(toWorkFormValues(work));
    }
    setHasPendingChanges(false);
    setConfirmCloseOpen(false);
    setConfirmAction(null);
    setIsConfirming(false);
    setIsDescriptionEditing(isCreateMode);
    const frameId = requestAnimationFrame(() => {
      trackingKeyRef.current = dialogKey;
    });

    return () => cancelAnimationFrame(frameId);
  }, [dialogKey, form, isCreateMode, open, work]);

  const requestClose = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (isSaving || isConfirming) return;
    if (isCreateMode) {
      onOpenChange(false);
      return;
    }
    if (isDirty) {
      setConfirmAction('close');
      setConfirmCloseOpen(true);
      return;
    }

    onOpenChange(false);
  };

  const discardChanges = () => {
    if (work) {
      const nextValues = toWorkFormValues(work);
      form.reset(nextValues);
    } else if (isCreateMode) {
      form.reset();
    }
    setHasPendingChanges(false);
    setIsDescriptionEditing(isCreateMode);
    setConfirmCloseOpen(false);
    setConfirmAction(null);
  };

  const requestCreateChild = () => {
    if (!work || !onCreateChild || isSaving || isConfirming) return;
    if (isDirty) {
      setConfirmAction('create-child');
      setConfirmCloseOpen(true);
      return;
    }
    onCreateChild(work!);
  };

  const handleSave = async (values: WorkFormValues) => {
    await onSave(values);
    setHasPendingChanges(false);
    if (!isCreateMode) {
      setIsDescriptionEditing(false);
    }
  };

  const saveBeforeCreateChild = async () => {
    if (!work || !onCreateChild) return;

    setIsConfirming(true);
    try {
      await handleSave(form.getValues());
      setConfirmCloseOpen(false);
      setConfirmAction(null);
      onOpenChange(false);
      onCreateChild(work);
    } catch {
      // The page mutation owns the error toast; keep the parent dialog open.
    } finally {
      setIsConfirming(false);
    }
  };

  const confirmDiscardChanges = () => {
    if (confirmAction !== 'close') return;
    discardChanges();
    onOpenChange(false);
  };

  const showLoading = !isCreateMode && !work;
  const showFooter = isCreateMode || isDirty;

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        className="flex min-h-0 flex-col gap-0 overflow-hidden p-0"
        size="large"
        showCloseButton={false}
        aria-labelledby="work-detail-dialog-title"
      >
        <DialogHeader className="shrink-0 px-6 py-4 text-start">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{dialogTitle}</span>
              {work ? (
                <>
                  <ChevronRight className="size-3.5 shrink-0" />
                  <Badge variant="secondary" className="text-sm font-normal">
                    {work.code}
                  </Badge>
                </>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                disabled
                aria-label="Sao chép liên kết"
              >
                <Copy />
              </Button>
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                disabled
                aria-label="Thao tác khác"
              >
                <Ellipsis />
              </Button>
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                aria-label={
                  isCreateMode
                    ? 'Đóng tạo công việc'
                    : 'Đóng chi tiết công việc'
                }
                onClick={() => requestClose(false)}
                disabled={isSaving || isConfirming}
              >
                <X />
              </Button>
            </div>
          </div>
          <DialogTitle id="work-detail-dialog-title" className="sr-only">
            {work?.title ?? dialogTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Không gian chỉnh sửa chi tiết công việc.
          </DialogDescription>
        </DialogHeader>

        {showLoading ? (
          <SectionLoading
            className="min-h-80 flex-1 rounded-none bg-transparent"
            label="Đang tải công việc..."
          />
        ) : (
          <Form {...form}>
            <form
              id="work-detail-form"
              onSubmit={form.handleSubmit(handleSave)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_28rem]">
                <main className="min-h-0 overflow-y-auto px-6 pb-8 pt-0">
                  <header className="pb-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="min-w-0">
                          <FormLabel className="sr-only">
                            Tên công việc
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              rows={1}
                              variant="lg"
                              className="min-h-10 resize-none overflow-hidden border-0 bg-transparent px-0 py-1 text-2xl font-semibold leading-tight tracking-tight shadow-none [field-sizing:content] focus-visible:bg-transparent focus-visible:ring-0"
                              placeholder={
                                isCreateMode ? 'Tên công việc' : undefined
                              }
                              {...field}
                              onChange={(event) => {
                                field.onChange(event);
                                markDirty();
                              }}
                              disabled={isSaving}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <FormField
                        control={form.control}
                        name="color"
                        render={({ field }) => (
                          <FormItem className="shrink-0 space-y-1">
                            <FormLabel className="sr-only">
                              Màu công việc
                            </FormLabel>
                            <FormControl>
                              <ColorInput
                                variant="md"
                                triggerVariant="ghost"
                                value={field.value}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  markDirty();
                                }}
                                onBlur={field.onBlur}
                                className="size-7 rounded-md p-1"
                                disabled={isSaving}
                              />
                            </FormControl>
                            <FormMessage className="sr-only" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="sr-only">
                              Trạng thái
                            </FormLabel>
                            <FormControl>
                              <OptionSelect
                                value={field.value}
                                onChange={(value) => {
                                  field.onChange(value);
                                  markDirty();
                                }}
                                options={statusOptions}
                                searchable={false}
                                canDeselect={false}
                                disabled={isSaving}
                                triggerMode="chevron"
                                className="h-7 w-auto min-w-0 border-0 bg-transparent p-0 shadow-none"
                                renderOption={(option) => (
                                  <WorkStatusBadge
                                    status={option.value as WorkItem['status']}
                                    size="sm"
                                  />
                                )}
                                triggerContent={(option) =>
                                  option ? (
                                    <WorkStatusBadge
                                      status={
                                        option.value as WorkItem['status']
                                      }
                                      size="sm"
                                    />
                                  ) : undefined
                                }
                              />
                            </FormControl>
                            <FormMessage className="sr-only" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="sr-only">
                              Mức độ ưu tiên
                            </FormLabel>
                            <FormControl>
                              <OptionSelect
                                value={field.value}
                                onChange={(value) => {
                                  field.onChange(value);
                                  markDirty();
                                }}
                                options={priorityOptions}
                                searchable={false}
                                canDeselect={false}
                                disabled={isSaving}
                                triggerMode="chevron"
                                className="h-7 w-auto min-w-0 border-0 bg-transparent p-0 shadow-none"
                              />
                            </FormControl>
                            <FormMessage className="sr-only" />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        <Plus /> Thêm nhãn
                      </Button>
                    </div>
                  </header>

                  <div className="mt-2 space-y-6">
                    {errorMessage ? (
                      <p className="text-sm text-destructive" role="alert">
                        Không tải được dữ liệu mới nhất: {errorMessage}
                      </p>
                    ) : null}

                    <Tabs
                      value={activeTab}
                      onValueChange={(value) =>
                        setActiveTab(value as WorkDetailTab)
                      }
                      className="flex flex-col"
                    >
                      <TabsList
                        variant="line"
                        size="md"
                        className="w-full justify-start gap-5 overflow-x-auto"
                      >
                        <TabsTrigger value="details">
                          <FileText /> Mô tả
                        </TabsTrigger>
                        <TabsTrigger value="children">
                          <ListChecks /> Công việc con
                          <Badge variant="secondary" size="sm">
                            {childCountLabel}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="attachments">
                          <Paperclip /> Tệp đính kèm
                          <Badge variant="secondary" size="sm">
                            {attachmentCount}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="comments">
                          <MessageCircle /> Bình luận
                          <Badge variant="secondary" size="sm">
                            {commentCount}
                          </Badge>
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="details" className="mt-6">
                        <section className="space-y-3">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                            <FormField
                              control={form.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  {isCreateMode || isDescriptionEditing ? (
                                    <FormControl>
                                      <RichTextEditor
                                        value={field.value}
                                        onChange={(value) => {
                                          field.onChange(value);
                                          markDirty();
                                        }}
                                        onBlur={() => field.onBlur()}
                                        disabled={isSaving}
                                        placeholder="Mô tả mục tiêu, bối cảnh hoặc kết quả cần đạt..."
                                      />
                                    </FormControl>
                                  ) : (
                                    <RichTextContent
                                      content={field.value}
                                      onChange={(value) => {
                                        field.onChange(value);
                                        markDirty();
                                      }}
                                    />
                                  )}
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            {!isCreateMode && !isDescriptionEditing ? (
                              <Button
                                type="button"
                                variant="ghost"
                                mode="icon"
                                size="sm"
                                aria-label="Chỉnh sửa mô tả"
                                title="Chỉnh sửa mô tả"
                                onClick={() => setIsDescriptionEditing(true)}
                                disabled={isSaving}
                              >
                                <Pencil />
                              </Button>
                            ) : null}
                          </div>
                        </section>
                      </TabsContent>

                      <TabsContent value="children" className="mt-6">
                        {work ? (
                          <WorkChildren
                            work={work}
                            children={children}
                            isLoading={isLoading}
                            onCreateChild={
                              onCreateChild ? requestCreateChild : undefined
                            }
                          />
                        ) : null}
                      </TabsContent>

                      <TabsContent value="attachments" className="mt-6">
                        <WorkAttachments />
                      </TabsContent>

                      <TabsContent value="comments" className="mt-6">
                        <WorkComments />
                      </TabsContent>
                    </Tabs>
                  </div>
                </main>

                <aside className="min-h-0 overflow-y-auto border-t border-border lg:border-s lg:border-t-0">
                  <WorkProperties
                    work={work}
                    form={form}
                    isSaving={isSaving}
                    onDirty={markDirty}
                    assigneeEmployeeOptions={assigneeEmployeeOptions}
                    customerOptions={customerOptions}
                    contractOptions={contractOptions}
                  />
                </aside>
              </div>
              {showFooter ? (
                <DialogFooter className="shrink-0 px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      isCreateMode ? onOpenChange(false) : discardChanges()
                    }
                    disabled={isSaving}
                  >
                    {isCreateMode ? 'Hủy' : 'Hủy thay đổi'}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSaving}
                    loadingText="Đang lưu..."
                  >
                    {isCreateMode ? 'Lưu' : 'Lưu thay đổi'}
                  </Button>
                </DialogFooter>
              ) : null}
            </form>
          </Form>
        )}
      </DialogContent>
      <ConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={(nextOpen) => {
          setConfirmCloseOpen(nextOpen);
          if (!nextOpen) setConfirmAction(null);
        }}
        title={
          confirmAction === 'create-child'
            ? 'Lưu công việc trước khi thêm công việc con?'
            : 'Đóng chi tiết công việc?'
        }
        description={
          confirmAction === 'create-child'
            ? 'Công việc hiện tại có thay đổi chưa lưu. Hãy lưu trước khi chuyển sang tạo công việc con.'
            : 'Bạn có thay đổi chưa lưu. Nếu đóng, các thay đổi hiện tại sẽ bị mất.'
        }
        confirmLabel={
          confirmAction === 'create-child' ? 'Lưu và tiếp tục' : 'Đóng'
        }
        cancelLabel={confirmAction === 'create-child' ? 'Ở lại' : 'Hủy'}
        confirmVariant={
          confirmAction === 'create-child' ? 'primary' : 'destructive'
        }
        isConfirming={isConfirming}
        closeOnConfirm={confirmAction !== 'create-child'}
        onConfirm={
          confirmAction === 'create-child'
            ? () => void saveBeforeCreateChild()
            : confirmDiscardChanges
        }
      />
    </Dialog>
  );
}
