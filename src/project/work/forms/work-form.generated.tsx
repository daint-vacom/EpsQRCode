/**
 * Scaffolded by form-builder from `src/project/work/forms/work.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useEffect, useState, type KeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarDays,
  FileText,
  ListChecks,
  MessageCircle,
  Paperclip,
  Upload,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
import { MultiSelect } from '@/components/ui/multi-select';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { WorkStatusBadge } from '../components/work-status-badge';
import { workFormSchema, type WorkFormValues } from '../model/work';
import type { WorkItem, WorkStatus } from '../model/work';

export const workDefaultValues: WorkFormValues = {
  title: '',
  description:
    '<p>Nhập mô tả công việc tại đây...</p><p><strong>Nội dung cần hoàn thành:</strong></p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Nội dung 1</p></li><li data-type="taskItem" data-checked="false"><p>Nội dung 2</p></li><li data-type="taskItem" data-checked="false"><p>Nội dung 3</p></li></ul>',
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

type WorkFormSource = WorkItem;
type WorkFormTab = 'details' | 'children' | 'attachments' | 'comments';

export function useWorkForm(
  options?: Omit<UseFormProps<WorkFormValues>, 'resolver'>,
) {
  return useForm<WorkFormValues>({
    resolver: zodResolver(workFormSchema),
    defaultValues: workDefaultValues,
    ...options,
  });
}

export function mapWorkToFormValues(entity: WorkFormSource): WorkFormValues {
  return {
    title: entity.title,
    description: entity.description,
    status: entity.status,
    priority: entity.priority,
    assigneeEmployeeId: entity.assigneeEmployeeId ?? '',
    parentId: entity.parentId ?? '',
    templateId: entity.templateId ?? '',
    plannedStartDate: entity.plannedStartDate ?? '',
    plannedEndDate: entity.plannedEndDate ?? '',
    plannedStartTime: entity.plannedStartTime ?? '00:00',
    plannedEndTime: entity.plannedEndTime ?? '00:00',
    color: entity.color || '#2563eb',
    customerIds: entity.customers.map((item) => item.id),
    contractIds: entity.contracts.map((item) => item.id),
  };
}

function FormPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 px-6 py-10 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4.5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

interface WorkFormProps {
  form: UseFormReturn<WorkFormValues>;
  onSubmit: (values: WorkFormValues) => void;
  id?: string;
  activeTab: WorkFormTab;
  onActiveTabChange: (value: WorkFormTab) => void;
  statusOptions: SelectOption[];
  priorityOptions: SelectOption[];
  assigneeEmployeeIdOptions: SelectOption[];
  customerIdsOptions: MultiSelectOption[];
  contractIdsOptions: MultiSelectOption[];
}

export function WorkForm({
  form,
  onSubmit,
  id = 'work-form',
  activeTab,
  onActiveTabChange,
  statusOptions,
  priorityOptions,
  assigneeEmployeeIdOptions,
  customerIdsOptions,
  contractIdsOptions,
}: WorkFormProps) {
  return (
    <Form {...form}>
      <form
        id={id}
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-h-0 overflow-y-auto px-6 pb-8 pt-5">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Công việc <span className="px-1">›</span> Thông tin chung
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1 space-y-1">
                        <FormLabel className="sr-only">
                          Tên công việc
                          <span className="text-destructive"> *</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            rows={1}
                            variant="lg"
                            className="min-h-10 resize-none overflow-hidden border-0 bg-transparent px-0 py-1 text-2xl font-semibold leading-tight tracking-tight shadow-none [field-sizing:content] placeholder:text-muted-foreground/60 focus-visible:bg-transparent focus-visible:ring-0"
                            placeholder="Tên công việc"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Trạng thái</FormLabel>
                        <FormControl>
                          <OptionSelect
                            value={field.value}
                            onChange={field.onChange}
                            options={statusOptions}
                            searchable={false}
                            placeholder="Chọn trạng thái"
                            triggerMode="chevron"
                            className="h-7 w-auto min-w-0 border-0 bg-transparent p-0 shadow-none"
                            renderOption={(option) => (
                              <WorkStatusBadge
                                status={option.value as WorkStatus}
                                size="sm"
                              />
                            )}
                            triggerContent={(option) =>
                              option ? (
                                <WorkStatusBadge
                                  status={option.value as WorkStatus}
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
                            onChange={field.onChange}
                            options={priorityOptions}
                            searchable={false}
                            placeholder="Chọn mức độ"
                            triggerMode="chevron"
                            className="h-7 w-auto min-w-0 border-0 bg-transparent p-0 shadow-none"
                          />
                        </FormControl>
                        <FormMessage className="sr-only" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(value) =>
                  onActiveTabChange(value as WorkFormTab)
                }
                className="flex flex-col"
              >
                <TabsList
                  variant="line"
                  size="md"
                  className="w-full justify-start gap-5 overflow-x-auto"
                >
                  <TabsTrigger value="details">
                    <FileText /> Chi tiết
                  </TabsTrigger>
                  <TabsTrigger value="children">
                    <ListChecks /> Công việc con
                  </TabsTrigger>
                  <TabsTrigger value="attachments">
                    <Paperclip /> Tệp đính kèm
                  </TabsTrigger>
                  <TabsTrigger value="comments">
                    <MessageCircle /> Bình luận
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-6 space-y-5">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        Mô tả
                      </h3>
                    </div>
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Mô tả</FormLabel>
                          <FormControl>
                            <RichTextEditor
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={() => field.onBlur()}
                              placeholder="Mô tả mục tiêu, bối cảnh hoặc kết quả cần đạt..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="customerIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Khách hàng liên quan</FormLabel>
                            <FormControl>
                              <MultiSelect
                                value={field.value}
                                onChange={field.onChange}
                                options={customerIdsOptions}
                                searchPlaceholder="Tìm khách hàng..."
                                emptyMessage="Không có khách hàng phù hợp"
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
                          <FormItem>
                            <FormLabel>Hợp đồng liên quan</FormLabel>
                            <FormControl>
                              <MultiSelect
                                value={field.value}
                                onChange={field.onChange}
                                options={contractIdsOptions}
                                searchPlaceholder="Tìm hợp đồng..."
                                emptyMessage="Không có hợp đồng phù hợp"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </section>
                </TabsContent>

                {/* TODO(work-form): connect checklist editor after the backend contract is available. */}
                <TabsContent value="children" className="mt-6">
                  <FormPlaceholder
                    icon={ListChecks}
                    title="Công việc con"
                    description="Công việc con sẽ được thêm và theo dõi sau khi backend hỗ trợ dữ liệu đầu mục."
                  />
                </TabsContent>

                {/* TODO(work-form): connect upload state after the backend file contract is available. */}
                <TabsContent value="attachments" className="mt-6">
                  <FormPlaceholder
                    icon={Upload}
                    title="Tệp đính kèm"
                    description="Bạn sẽ có thể thêm tài liệu liên quan đến công việc tại đây."
                  />
                </TabsContent>

                {/* TODO(work-form): connect comment composer after the backend comment contract is available. */}
                <TabsContent value="comments" className="mt-6">
                  <FormPlaceholder
                    icon={MessageCircle}
                    title="Bình luận"
                    description="Trao đổi của nhóm sẽ được hiển thị sau khi backend hỗ trợ bình luận."
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto border-t border-border px-6 py-5 lg:border-s lg:border-t-0">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="assigneeEmployeeId"
                render={({ field }) => (
                  <FormItem
                    variant="compact"
                    layout="horizontal"
                    labelWidth="md"
                    labelGap="md"
                  >
                    <FormLabel className="flex items-center gap-2">
                      <UserRound className="size-3.5" /> Người phụ trách
                    </FormLabel>
                    <FormControl>
                      <OptionSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={assigneeEmployeeIdOptions}
                        placeholder="Chọn nhân viên"
                        searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
                        emptyMessage="Không tìm thấy nhân viên phù hợp"
                        renderOption={(option) => option.label}
                        className="h-auto min-h-14 border-transparent bg-transparent py-2 shadow-none hover:bg-accent data-[state=open]:bg-accent"
                      />
                    </FormControl>
                    <FormMessage />
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
                    labelGap="md"
                  >
                    <FormLabel className="flex items-center gap-2">
                      <CalendarDays className="size-3.5" /> Ngày kết thúc
                    </FormLabel>
                    <FormControl>
                      <DatePickerInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        calendarLabel="Chọn ngày kết thúc dự kiến"
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

              <FormField
                control={form.control}
                name="plannedStartDate"
                render={({ field }) => (
                  <FormItem
                    variant="compact"
                    layout="horizontal"
                    labelWidth="md"
                    labelGap="md"
                  >
                    <FormLabel className="flex items-center gap-2">
                      <CalendarDays className="size-3.5" /> Ngày bắt đầu
                    </FormLabel>
                    <FormControl>
                      <DatePickerInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        calendarLabel="Chọn ngày bắt đầu dự kiến"
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
            </div>
          </aside>
        </div>
      </form>
    </Form>
  );
}

interface WorkFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<WorkFormValues>;
  onSubmit: (values: WorkFormValues) => void;
  isSaving?: boolean;
  title?: string;
  statusOptions: SelectOption[];
  priorityOptions: SelectOption[];
  assigneeEmployeeIdOptions: SelectOption[];
  customerIdsOptions: MultiSelectOption[];
  contractIdsOptions: MultiSelectOption[];
}

export function WorkFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  statusOptions,
  priorityOptions,
  assigneeEmployeeIdOptions,
  customerIdsOptions,
  contractIdsOptions,
}: WorkFormDialogProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkFormTab>('details');

  useEffect(() => {
    if (open) setActiveTab('details');
  }, [open]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isSaving || !(event.ctrlKey || event.metaKey)) return;

    const key = event.key.toLowerCase();
    if (key !== 's' && key !== 'enter') return;

    event.preventDefault();
    void form.handleSubmit(onSubmit)();
  };

  const requestClose = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (mode === 'edit') {
      setConfirmCloseOpen(true);
      return;
    }

    onOpenChange(false);
  };

  const confirmClose = () => {
    setConfirmCloseOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          className="flex flex-col gap-0 overflow-hidden p-0"
          size="large"
          onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{title ?? 'Thêm công việc'}</DialogTitle>
            <DialogDescription>
              Giao việc và theo dõi tiến độ thực hiện.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden">
            <WorkForm
              form={form}
              onSubmit={onSubmit}
              id="work-form"
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              statusOptions={statusOptions}
              priorityOptions={priorityOptions}
              assigneeEmployeeIdOptions={assigneeEmployeeIdOptions}
              customerIdsOptions={customerIdsOptions}
              contractIdsOptions={contractIdsOptions}
            />
          </div>

          <DialogFooter className="shrink-0 px-6 py-4">
            <ShortcutTooltip label="Hủy" shortcut="Esc">
              <Button
                type="button"
                variant="outline"
                onClick={() => requestClose(false)}
                disabled={isSaving}
              >
                Hủy
              </Button>
            </ShortcutTooltip>
            <ShortcutTooltip label="Lưu" shortcut="Ctrl/Cmd + S">
              <Button
                type="submit"
                variant="primary"
                form="work-form"
                loading={isSaving}
                loadingText="Đang lưu..."
              >
                Lưu
              </Button>
            </ShortcutTooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title="Đóng chỉnh sửa?"
        description="Bạn có thay đổi chưa lưu. Nếu đóng, các thay đổi hiện tại sẽ bị mất."
        confirmLabel="Đóng"
        confirmVariant="destructive"
        onConfirm={confirmClose}
      />
    </>
  );
}
