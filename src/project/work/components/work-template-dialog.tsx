import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  FileText,
  ListChecks,
  Paperclip,
  Tag,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SectionLoading } from '@/components/ui/loading';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  SelectWithAvatar,
  type SelectWithAvatarOption,
} from '@/components/ui/select-with-avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  type WorkEmployeeOption,
  type WorkLabel,
  type WorkTemplateFormValues,
} from '../model/work';
import { WorkLabelPicker } from './work-detail-dialog';
import {
  WorkEditorDialogFrame,
  WorkEditorDialogGrid,
} from './work-editor-dialog-layout';

type WorkTemplateTab = 'details' | 'children' | 'attachments';

interface WorkTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<WorkTemplateFormValues>;
  onSubmit: (values: WorkTemplateFormValues) => void;
  isSaving?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  title: string;
  priorityOptions: SelectOption[];
  assigneeOptions: SelectWithAvatarOption<WorkEmployeeOption>[];
  labelOptions: WorkLabel[];
  onCreateLabel: (name: string) => Promise<WorkLabel>;
  childCount: number;
  attachmentCount: number;
  allowChildren?: boolean;
  preserveTabOnOpen?: boolean;
  childrenEditor: ReactNode;
  attachmentsEditor: ReactNode;
}

export function WorkTemplateDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  isLoading = false,
  errorMessage,
  onRetry,
  title,
  priorityOptions,
  assigneeOptions,
  labelOptions,
  onCreateLabel,
  childCount,
  attachmentCount,
  allowChildren = true,
  preserveTabOnOpen = false,
  childrenEditor,
  attachmentsEditor,
}: WorkTemplateDialogProps) {
  const [activeTab, setActiveTab] = useState<WorkTemplateTab>('details');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const formId = useId();
  const entityCode = form.watch('code');

  useEffect(() => {
    if (open && !preserveTabOnOpen) setActiveTab('details');
  }, [open, preserveTabOnOpen]);

  const requestClose = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (isSaving) return;
    if (isLoading || errorMessage) {
      onOpenChange(false);
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

  const loadStateContent =
    isLoading || errorMessage ? (
      <>
        <div className="flex min-h-[28rem] flex-1 items-center justify-center px-6 py-8">
          {isLoading ? (
            <SectionLoading
              className="min-h-64 w-full max-w-xl"
              label="Đang tải thông tin mẫu công việc..."
            />
          ) : (
            <div className="flex max-w-xl flex-col items-center gap-3 text-center">
              <TriangleAlert className="size-8 text-destructive" />
              <p className="text-sm text-destructive" role="alert">
                Không tải được thông tin mẫu công việc: {errorMessage}
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => requestClose(false)}
          >
            Đóng
          </Button>
          {errorMessage && onRetry ? (
            <Button type="button" variant="primary" onClick={onRetry}>
              Thử lại
            </Button>
          ) : null}
        </DialogFooter>
      </>
    ) : null;

  return (
    <>
      <WorkEditorDialogFrame
        open={open}
        onOpenChange={requestClose}
        title={title}
        description="Không gian chỉnh sửa mẫu công việc."
        entityCode={entityCode}
        closeLabel="Đóng mẫu công việc"
        isCloseDisabled={isSaving}
      >
        {loadStateContent ?? (
          <Form {...form}>
            <form
              id={formId}
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <WorkEditorDialogGrid
                main={
                  <main className="min-h-0 overflow-y-auto px-6 pb-8 pt-0">
                    <header className="pb-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="min-w-0">
                            <FormLabel className="sr-only">Tên mẫu</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={1}
                                variant="lg"
                                className="min-h-10 resize-none overflow-hidden border-0 bg-transparent px-0 py-1 text-2xl font-semibold leading-tight tracking-tight shadow-none [field-sizing:content] focus-visible:bg-transparent focus-visible:ring-0"
                                placeholder={
                                  mode === 'create'
                                    ? 'Tên mẫu công việc'
                                    : undefined
                                }
                                {...field}
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
                                  canDeselect={false}
                                  disabled={isSaving}
                                  triggerMode="chevron"
                                  className="h-7 w-auto min-w-0 border-0 bg-transparent p-0 shadow-none"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </header>

                    <Tabs
                      value={activeTab}
                      onValueChange={(value) =>
                        setActiveTab(value as WorkTemplateTab)
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
                        {allowChildren ? (
                          <TabsTrigger value="children">
                            <ListChecks /> Công việc con
                            <Badge variant="secondary" size="sm">
                              {childCount}
                            </Badge>
                          </TabsTrigger>
                        ) : null}
                        <TabsTrigger value="attachments">
                          <Paperclip /> Tệp đính kèm
                          <Badge variant="secondary" size="sm">
                            {attachmentCount}
                          </Badge>
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="details" className="mt-6">
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <RichTextEditor
                                  value={field.value}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                  disabled={isSaving}
                                  placeholder="Mô tả mục tiêu, bối cảnh hoặc kết quả cần đạt..."
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      {allowChildren ? (
                        <TabsContent value="children" className="mt-6">
                          {childrenEditor}
                        </TabsContent>
                      ) : null}

                      <TabsContent value="attachments" className="mt-6">
                        {attachmentsEditor}
                      </TabsContent>
                    </Tabs>
                  </main>
                }
                properties={
                  <div className="space-y-4 px-6 py-5">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem
                          variant="compact"
                          layout="horizontal"
                          labelWidth="md"
                          labelGap="sm"
                        >
                          <FormLabel className="flex items-center gap-2 whitespace-nowrap">
                            <FileText className="size-3.5" /> Mã mẫu
                          </FormLabel>
                          <FormControl>
                            <Input
                              variant="md"
                              {...field}
                              disabled={isSaving}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                              onChange={field.onChange}
                              options={assigneeOptions}
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
                              onChange={field.onChange}
                              onCreateLabel={onCreateLabel}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                }
                footer={
                  <DialogFooter className="shrink-0 px-6 py-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => requestClose(false)}
                      disabled={isSaving}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={isSaving}
                      loadingText="Đang lưu..."
                    >
                      Lưu
                    </Button>
                  </DialogFooter>
                }
              />
            </form>
          </Form>
        )}
      </WorkEditorDialogFrame>

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
