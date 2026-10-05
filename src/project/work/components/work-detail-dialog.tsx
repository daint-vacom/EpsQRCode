import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AtSign,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  ListChecks,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Smile,
  Tag,
  Trash2,
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
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  EntityMultiSelect,
  type EntityMultiSelectOption,
  type EntityMultiSelectSize,
} from '@/components/ui/entity-multi-select';
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
import {
  SelectWithAvatar,
  type SelectWithAvatarOption,
} from '@/components/ui/select-with-avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { formatIdentityTooltip } from '@/components/common/avatar-identity';
import { CustomerAvatar } from '../../customers/components/customer-avatar';
import type { FileAttachment } from '../../files/model/file';
import {
  toWorkFormValues,
  workProgress,
  type WorkEmployeeOption,
  type WorkFormValues,
  type WorkItem,
  type WorkLabel,
} from '../model/work';
import {
  WorkEditorDialogFrame,
  WorkEditorDialogGrid,
} from './work-editor-dialog-layout';
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
  assigneeEmployeeOptions: SelectWithAvatarOption<WorkEmployeeOption>[];
  customerOptions: MultiSelectOption[];
  contractOptions: MultiSelectOption[];
  labelOptions: WorkLabel[];
  additionalProperties?: ReactNode;
  attachments: FileAttachment[];
  isAttachmentsLoading?: boolean;
  isUploadingAttachments?: boolean;
  attachmentErrorMessage?: string;
  onCreateLabel: (name: string) => Promise<WorkLabel>;
  onUploadAttachments: (files: File[]) => Promise<unknown>;
  onDeleteAttachment: (attachmentId: string) => Promise<unknown>;
  onSave: (
    values: WorkFormValues,
    attachments?: File[],
  ) => Promise<unknown> | void;
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

export interface WorkChildrenPanelItem {
  id: string;
  title: string;
  status: WorkItem['status'];
  plannedEndDate: string | null;
  plannedEndTime: string | null;
  assigneeName: string;
}

export function WorkChildrenPanel({
  count,
  progress,
  children,
  isLoading,
  onCreateChild,
  onEditChild,
  onDeleteChild,
}: {
  count: string;
  progress: number;
  children: WorkChildrenPanelItem[];
  isLoading: boolean;
  onCreateChild?: () => void;
  onEditChild?: (child: WorkChildrenPanelItem) => void;
  onDeleteChild?: (child: WorkChildrenPanelItem) => void;
}) {
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
        count={count}
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
              {onEditChild || onDeleteChild ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      mode="icon"
                      size="sm"
                      aria-label={`Thao tác với ${child.title}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEditChild ? (
                      <DropdownMenuItem onSelect={() => onEditChild(child)}>
                        <Pencil /> Sửa công việc con
                      </DropdownMenuItem>
                    ) : null}
                    {onEditChild && onDeleteChild ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {onDeleteChild ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDeleteChild(child)}
                      >
                        <Trash2 /> Xóa công việc con
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
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
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
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
  return (
    <WorkChildrenPanel
      count={`${work.completedChildCount}/${work.childCount}`}
      progress={work.childCount ? workProgress(work) : 0}
      children={children}
      isLoading={isLoading}
      onCreateChild={onCreateChild}
    />
  );
}

function WorkLabelPill({
  label,
  onRemove,
  disabled,
}: {
  label: WorkLabel;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <span
      className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium"
      style={{
        color: label.color,
        borderColor: `${label.color}66`,
        backgroundColor: `${label.color}1a`,
      }}
    >
      {label.name}
      {onRemove ? (
        <button
          type="button"
          className="rounded-sm opacity-70 hover:opacity-100 disabled:cursor-not-allowed"
          aria-label={`Bỏ nhãn ${label.name}`}
          title={`Bỏ nhãn ${label.name}`}
          onClick={onRemove}
          disabled={disabled}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

export function WorkLabelPicker({
  value,
  options,
  disabled,
  onChange,
  onCreateLabel,
}: {
  value: string[];
  options: WorkLabel[];
  disabled: boolean;
  onChange: (value: string[]) => void;
  onCreateLabel: (name: string) => Promise<WorkLabel>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const selected = value
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is WorkLabel => Boolean(option));
  const normalizedSearch = search.trim();
  const matchingLabelExists = options.some(
    (option) =>
      option.name.toLocaleLowerCase('vi') ===
      normalizedSearch.toLocaleLowerCase('vi'),
  );

  const createLabel = async () => {
    if (!normalizedSearch || isCreating) return;
    setIsCreating(true);
    try {
      const label = await onCreateLabel(normalizedSearch);
      if (!value.includes(label.id)) onChange([...value, label.id]);
      setSearch('');
      setOpen(false);
    } catch {
      // The page mutation displays the normalized API error.
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((label) => (
            <WorkLabelPill
              key={label.id}
              label={label}
              disabled={disabled}
              onRemove={() => onChange(value.filter((id) => id !== label.id))}
            />
          ))}
        </div>
      ) : null}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2 text-muted-foreground"
            disabled={disabled}
          >
            <Plus /> Thêm
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command shouldFilter>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              maxLength={40}
              placeholder="Tìm hoặc tạo nhãn..."
            />
            <CommandList>
              <CommandEmpty>Không có nhãn phù hợp</CommandEmpty>
              {options.map((label) => {
                const isSelected = value.includes(label.id);
                return (
                  <CommandItem
                    key={label.id}
                    value={label.name}
                    onSelect={() =>
                      onChange(
                        isSelected
                          ? value.filter((id) => id !== label.id)
                          : [...value, label.id],
                      )
                    }
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {label.name}
                    </span>
                    <Check
                      className={cn(
                        'size-4',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandList>
            {normalizedSearch && !matchingLabelExists ? (
              <div className="border-t border-border p-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => void createLabel()}
                  disabled={disabled || isCreating}
                  loading={isCreating}
                  loadingText="Đang tạo..."
                >
                  <Plus /> Tạo nhãn “{normalizedSearch}”
                </Button>
              </div>
            ) : null}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function WorkAttachments({
  mode,
  attachments,
  pendingFiles,
  isLoading,
  isUploading,
  disabled,
  errorMessage,
  onAddFiles,
  onRemovePendingFile,
  onDeleteAttachment,
}: {
  mode: 'create' | 'edit';
  attachments: FileAttachment[];
  pendingFiles: File[];
  isLoading: boolean;
  isUploading: boolean;
  disabled: boolean;
  errorMessage?: string;
  onAddFiles: (files: File[]) => void;
  onRemovePendingFile: (index: number) => void;
  onDeleteAttachment: (attachmentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const attachmentCount =
    mode === 'edit' ? attachments.length : pendingFiles.length;

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Tệp đính kèm"
        count={String(attachmentCount)}
        action={
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              aria-label="Chọn tệp đính kèm"
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = '';
                if (files.length) onAddFiles(files);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              loading={isUploading}
              loadingText="Đang tải lên..."
            >
              <Upload /> Thêm tệp
            </Button>
          </>
        }
      />
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isLoading ? (
        <SectionLoading
          className="min-h-32 bg-transparent"
          label="Đang tải tệp..."
        />
      ) : null}
      {!isLoading && mode === 'edit' ? (
        <div className="divide-y divide-border rounded-md border border-border">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex min-w-0 items-center gap-3 px-3 py-2.5"
            >
              <FileText className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                {attachment.isDeleted ? (
                  <span
                    className="block truncate text-sm font-medium text-muted-foreground"
                    title={attachment.fileName}
                  >
                    {attachment.fileName}
                  </span>
                ) : (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium hover:text-primary hover:underline"
                    title={attachment.fileName}
                  >
                    {attachment.fileName}
                  </a>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatFileSize(attachment.sizeBytes)} ·{' '}
                  {formatDateTime(attachment.createdAt)}
                </p>
              </div>
              {attachment.isDeleted ? (
                <Badge variant="outline" className="shrink-0 text-xs">
                  Đã xóa
                </Badge>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                aria-label={`Xóa tệp ${attachment.fileName}`}
                title={`Xóa tệp ${attachment.fileName}`}
                onClick={() => onDeleteAttachment(attachment.id)}
                disabled={disabled}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {attachments.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Chưa có tệp đính kèm.
            </p>
          ) : null}
        </div>
      ) : null}
      {mode === 'create' && pendingFiles.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          Chưa có tệp đính kèm.
        </p>
      ) : null}
      {mode === 'create'
        ? pendingFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex min-w-0 items-center gap-3 rounded-md border border-border px-3 py-2.5"
            >
              <FileText className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatFileSize(file.size)} · Chờ lưu công việc
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                aria-label={`Bỏ tệp ${file.name}`}
                onClick={() => onRemovePendingFile(index)}
              >
                <X />
              </Button>
            </div>
          ))
        : null}
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

function getWorkLinkPickerOptions(
  options: MultiSelectOption[],
  kind: WorkLinkPickerKind,
  size: EntityMultiSelectSize,
): EntityMultiSelectOption[] {
  return options.map((option) => {
    const title = getWorkLinkOptionLabel(option);
    const description = getWorkLinkOptionCode(option);
    const avatarSize = size === 'lg' ? 'size-9' : 'size-6';

    return {
      value: option.value,
      title,
      description: description || null,
      tooltip: formatIdentityTooltip(description, title),
      avatar:
        kind === 'customer' ? (
          <CustomerAvatar
            customer={{ name: title, imageUrl: null }}
            className={avatarSize}
          />
        ) : (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
              avatarSize,
            )}
          >
            <FileText className={size === 'lg' ? 'size-4' : 'size-3.5'} />
          </span>
        ),
      searchText: [title, description, option.searchableText]
        .filter(Boolean)
        .join(' '),
      disabled: option.disabled,
    };
  });
}

function WorkProperties({
  work,
  form,
  isSaving,
  onDirty,
  assigneeEmployeeOptions,
  customerOptions,
  contractOptions,
  labelOptions,
  onCreateLabel,
  additionalFields,
}: {
  work: WorkItem | null;
  form: UseFormReturn<WorkFormValues>;
  isSaving: boolean;
  onDirty: () => void;
  assigneeEmployeeOptions: SelectWithAvatarOption<WorkEmployeeOption>[];
  customerOptions: MultiSelectOption[];
  contractOptions: MultiSelectOption[];
  labelOptions: WorkLabel[];
  onCreateLabel: (name: string) => Promise<WorkLabel>;
  additionalFields?: ReactNode;
}) {
  return (
    <div className="space-y-4 px-6 py-5">
      {additionalFields}
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
              <SelectWithAvatar
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  onDirty();
                }}
                options={assigneeEmployeeOptions}
                placeholder="Chọn nhân viên"
                searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
                emptyMessage="Không tìm thấy nhân viên phù hợp"
                variant="normal"
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

      <FormField
        control={form.control}
        name="labelIds"
        render={({ field }) => (
          <FormItem
            variant="compact"
            layout="horizontal"
            labelWidth="md"
            labelGap="sm"
          >
            <FormLabel className="flex items-center gap-2 whitespace-nowrap">
              <Tag className="size-3.5" /> Nhãn công việc
            </FormLabel>
            <FormControl>
              <WorkLabelPicker
                value={field.value ?? []}
                options={labelOptions}
                disabled={isSaving}
                onChange={(value) => {
                  field.onChange(value);
                  onDirty();
                }}
                onCreateLabel={onCreateLabel}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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
              <EntityMultiSelect
                value={field.value}
                options={getWorkLinkPickerOptions(
                  customerOptions,
                  'customer',
                  'md',
                )}
                onChange={(value) => {
                  field.onChange(value);
                  onDirty();
                }}
                size="md"
                searchPlaceholder="Tìm khách hàng..."
                emptyMessage="Không có khách hàng phù hợp"
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
              <EntityMultiSelect
                value={field.value}
                options={getWorkLinkPickerOptions(
                  contractOptions,
                  'contract',
                  'md',
                )}
                onChange={(value) => {
                  field.onChange(value);
                  onDirty();
                }}
                size="md"
                searchPlaceholder="Tìm hợp đồng..."
                emptyMessage="Không có hợp đồng phù hợp"
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
  labelOptions,
  additionalProperties,
  attachments,
  isAttachmentsLoading = false,
  isUploadingAttachments = false,
  attachmentErrorMessage,
  onCreateLabel,
  onUploadAttachments,
  onDeleteAttachment,
  onSave,
  onCreateChild,
}: WorkDetailDialogProps) {
  const isCreateMode = mode === 'create';
  const dialogTitle =
    title ?? (isCreateMode ? 'Thêm công việc' : 'Chi tiết công việc');
  const childCountLabel = work
    ? `${work.completedChildCount}/${work.childCount}`
    : '0/0';
  const commentCount = 0;
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>(
    [],
  );
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
    await onSave(values, isCreateMode ? pendingAttachmentFiles : undefined);
    if (isCreateMode) setPendingAttachmentFiles([]);
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
    <>
      <WorkEditorDialogFrame
        open={open}
        onOpenChange={requestClose}
        title={dialogTitle}
        entityCode={work?.code}
        closeLabel={
          isCreateMode ? 'Đóng tạo công việc' : 'Đóng chi tiết công việc'
        }
        isCloseDisabled={isSaving || isConfirming}
      >
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
              <WorkEditorDialogGrid
                main={
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
                                      status={
                                        option.value as WorkItem['status']
                                      }
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
                              {isCreateMode
                                ? pendingAttachmentFiles.length
                                : attachments.length}
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
                          <WorkAttachments
                            mode={isCreateMode ? 'create' : 'edit'}
                            attachments={attachments}
                            pendingFiles={pendingAttachmentFiles}
                            isLoading={isAttachmentsLoading}
                            isUploading={isUploadingAttachments}
                            disabled={isUploadingAttachments || isSaving}
                            errorMessage={attachmentErrorMessage}
                            onAddFiles={(files) => {
                              if (isCreateMode) {
                                setPendingAttachmentFiles((current) => [
                                  ...current,
                                  ...files,
                                ]);
                              } else {
                                void onUploadAttachments(files).catch(
                                  () => undefined,
                                );
                              }
                            }}
                            onRemovePendingFile={(index) =>
                              setPendingAttachmentFiles((current) =>
                                current.filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              )
                            }
                            onDeleteAttachment={(attachmentId) =>
                              void onDeleteAttachment(attachmentId).catch(
                                () => undefined,
                              )
                            }
                          />
                        </TabsContent>

                        <TabsContent value="comments" className="mt-6">
                          <WorkComments />
                        </TabsContent>
                      </Tabs>
                    </div>
                  </main>
                }
                properties={
                  <WorkProperties
                    work={work}
                    form={form}
                    isSaving={isSaving}
                    onDirty={markDirty}
                    assigneeEmployeeOptions={assigneeEmployeeOptions}
                    customerOptions={customerOptions}
                    contractOptions={contractOptions}
                    labelOptions={labelOptions}
                    onCreateLabel={onCreateLabel}
                    additionalFields={additionalProperties}
                  />
                }
                footer={
                  showFooter ? (
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
                  ) : null
                }
              />
            </form>
          </Form>
        )}
      </WorkEditorDialogFrame>
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
    </>
  );
}
