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
import { FileText, ListChecks, MoreHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { ColorInput } from '@/components/ui/color-input';
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
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { MultiSelect } from '@/components/ui/multi-select';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkStatusBadge } from '../components/work-status-badge';
import { workFormSchema, type WorkFormValues } from '../model/work';
// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
import type { WorkItem, WorkStatus } from '../model/work';

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

type WorkFormSource = WorkItem;
type WorkFormTab = 'description' | 'children' | 'details';

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

interface WorkFormProps {
  form: UseFormReturn<WorkFormValues>;
  onSubmit: (values: WorkFormValues) => void;
  id?: string;
  activeTab: WorkFormTab;
  onActiveTabChange: (value: WorkFormTab) => void;
  statusOptions: SelectOption[];
  priorityOptions: SelectOption[];
  assigneeEmployeeIdOptions: SelectOption[];
  parentIdOptions: SelectOption[];
  templateIdOptions: SelectOption[];
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
  parentIdOptions,
  templateIdOptions,
  customerIdsOptions,
  contractIdsOptions,
}: WorkFormProps) {
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-7">
          <div className="sticky top-0 z-10 -mx-6 bg-background px-6 pb-3 pt-4">
            <div className="flex items-start gap-3 pe-10">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem className="shrink-0 space-y-1 pt-1">
                    <FormLabel className="sr-only">Màu công việc</FormLabel>
                    <FormControl>
                      <ColorInput
                        defaultValue="#2563eb"
                        variant="md"
                        triggerVariant="ghost"
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        className="size-8 rounded-md p-1"
                      />
                    </FormControl>
                    <FormMessage className="sr-only" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="min-w-0 flex-1 space-y-1">
                    <FormLabel className="sr-only">
                      Tên công việc<span className="text-destructive"> *</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        variant="lg"
                        className="h-auto border-0 bg-transparent px-0 py-1 text-lg font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/60 focus-visible:bg-transparent focus-visible:ring-0"
                        placeholder="Tên công việc"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-sm" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-2 lg:grid-cols-2 lg:gap-x-8">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem
                    layout="horizontal"
                    labelWidth="md"
                    labelGap="md"
                    className="rounded-lg px-3 py-2 transition-colors has-[[data-invalid=true]]:bg-destructive/5"
                  >
                    <FormLabel>Trạng thái</FormLabel>
                    <FormControl>
                      <OptionSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={statusOptions}
                        searchable={false}
                        placeholder="Chọn trạng thái"
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem
                    layout="horizontal"
                    labelWidth="md"
                    labelGap="md"
                    className="rounded-lg px-3 py-2 transition-colors has-[[data-invalid=true]]:bg-destructive/5"
                  >
                    <FormLabel>Mức độ ưu tiên</FormLabel>
                    <FormControl>
                      <OptionSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={priorityOptions}
                        searchable={false}
                        placeholder="Chọn mức độ"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid items-start gap-2 lg:grid-cols-2 lg:gap-x-8">
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="assigneeEmployeeId"
                  render={({ field }) => (
                    <FormItem
                      layout="horizontal"
                      labelWidth="md"
                      labelGap="md"
                      className="rounded-lg px-3 py-2 transition-colors has-[[data-invalid=true]]:bg-destructive/5"
                    >
                      <FormLabel>Nhân viên phụ trách</FormLabel>
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
              </div>

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="plannedStartDate"
                  render={({ field }) => (
                    <FormItem
                      layout="horizontal"
                      labelWidth="md"
                      labelGap="md"
                      className="rounded-lg px-3 py-2 transition-colors has-[[data-invalid=true]]:bg-destructive/5"
                    >
                      <FormLabel>Ngày bắt đầu</FormLabel>
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
                          onTimeBlur={() =>
                            void form.trigger('plannedStartTime')
                          }
                        />
                      </FormControl>
                      <FormMessage />
                      {form.formState.errors.plannedStartTime?.message ? (
                        <p className="col-start-2 -mt-0.5 text-xs font-normal text-destructive">
                          {String(
                            form.formState.errors.plannedStartTime.message,
                          )}
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
                      layout="horizontal"
                      labelWidth="md"
                      labelGap="md"
                      className="rounded-lg px-3 py-2 transition-colors has-[[data-invalid=true]]:bg-destructive/5"
                    >
                      <FormLabel>Ngày kết thúc</FormLabel>
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
                        <p className="col-start-2 -mt-0.5 text-xs font-normal text-destructive">
                          {String(form.formState.errors.plannedEndTime.message)}
                        </p>
                      ) : null}
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value) => onActiveTabChange(value as WorkFormTab)}
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
            </TabsContent>

            <TabsContent value="children" className="mt-5">
              <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ListChecks className="size-5" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  Quản lý các đầu mục con
                </p>
                <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  Sau khi lưu, bạn có thể thêm đầu mục con, giao cho nhân viên
                  khác và theo dõi tiến độ độc lập từ trang chi tiết công việc.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="details" className="mt-5 space-y-6">
              <section className="space-y-3">
                <p className="text-sm font-semibold text-foreground">
                  Bối cảnh nghiệp vụ
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="parentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thuộc công việc</FormLabel>
                        <FormControl>
                          <OptionSelect
                            value={field.value}
                            onChange={field.onChange}
                            options={parentIdOptions}
                            searchable={false}
                            placeholder="Công việc cha (nếu có)"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="templateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mẫu công việc</FormLabel>
                        <FormControl>
                          <OptionSelect
                            value={field.value}
                            onChange={field.onChange}
                            options={templateIdOptions}
                            searchable={false}
                            placeholder="Áp dụng mẫu công việc (nếu có)"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-sm font-semibold text-foreground">
                  Liên kết nghiệp vụ
                </p>
                <div className="grid gap-4 md:grid-cols-2">
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
          </Tabs>
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
  parentIdOptions: SelectOption[];
  templateIdOptions: SelectOption[];
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
  parentIdOptions,
  templateIdOptions,
  customerIdsOptions,
  contractIdsOptions,
}: WorkFormDialogProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkFormTab>('description');
  useEffect(() => {
    if (open) setActiveTab('description');
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
          className="flex max-h-[90dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0"
          onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="sr-only">
            <DialogTitle className="sr-only">
              {title ?? 'Thêm công việc'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Giao việc, gắn bối cảnh nghiệp vụ và theo dõi tiến độ thực hiện.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
            <WorkForm
              form={form}
              onSubmit={onSubmit}
              id="work-form"
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              statusOptions={statusOptions}
              priorityOptions={priorityOptions}
              assigneeEmployeeIdOptions={assigneeEmployeeIdOptions}
              parentIdOptions={parentIdOptions}
              templateIdOptions={templateIdOptions}
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
