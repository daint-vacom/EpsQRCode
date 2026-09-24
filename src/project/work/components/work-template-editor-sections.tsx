import { useRef } from 'react';
import type { FileAttachment } from '@/project/files/model/file';
import { FileText, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColorInput } from '@/components/ui/color-input';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { Textarea } from '@/components/ui/textarea';
import {
  WORK_PRIORITIES,
  WORK_PRIORITY_LABELS,
  type WorkEmployeeOption,
  type WorkTemplateChildFormValues,
} from '../model/work';

interface WorkTemplateEditorSectionsProps {
  section?: 'children' | 'attachments' | 'all';
  children: WorkTemplateChildFormValues[];
  onChildrenChange: (children: WorkTemplateChildFormValues[]) => void;
  employeeOptions: WorkEmployeeOption[];
  labelOptions: MultiSelectOption[];
  attachments: FileAttachment[];
  pendingFiles: File[];
  deletedAttachmentIds: string[];
  onPendingFilesChange: (files: File[]) => void;
  onDeletedAttachmentIdsChange: (attachmentIds: string[]) => void;
}

const priorityOptions: SelectOption[] = WORK_PRIORITIES.map((value) => ({
  value,
  label: WORK_PRIORITY_LABELS[value],
}));

const emptyChild = (): WorkTemplateChildFormValues => ({
  title: '',
  description: '',
  priority: 'normal',
  assigneeEmployeeId: '',
  color: '#2563eb',
  labelIds: [],
});

export function WorkTemplateEditorSections({
  section = 'all',
  children,
  onChildrenChange,
  employeeOptions,
  labelOptions,
  attachments,
  pendingFiles,
  deletedAttachmentIds,
  onPendingFilesChange,
  onDeletedAttachmentIdsChange,
}: WorkTemplateEditorSectionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assigneeOptions = employeeOptions.map((employee) => ({
    value: employee.id,
    label: employee.label,
    searchableText: `${employee.label} ${employee.employeeCode}`,
  }));

  const updateChild = (
    index: number,
    patch: Partial<WorkTemplateChildFormValues>,
  ) => {
    onChildrenChange(
      children.map((child, childIndex) =>
        childIndex === index ? { ...child, ...patch } : child,
      ),
    );
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    onPendingFilesChange([...pendingFiles, ...Array.from(fileList)]);
  };

  const toggleAttachmentDelete = (attachmentId: string) => {
    onDeletedAttachmentIdsChange(
      deletedAttachmentIds.includes(attachmentId)
        ? deletedAttachmentIds.filter((id) => id !== attachmentId)
        : [...deletedAttachmentIds, attachmentId],
    );
  };

  return (
    <>
      {section !== 'attachments' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Công việc con</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Các đầu mục này sẽ được tạo cùng công việc khi dùng mẫu.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChildrenChange([...children, emptyChild()])}
            >
              <Plus /> Thêm công việc con
            </Button>
          </div>

          {children.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Mẫu chưa có công việc con.
            </div>
          ) : (
            <div className="space-y-3">
              {children.map((child, index) => (
                <div key={index} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <span className="text-sm font-medium">
                        {child.title.trim() || 'Công việc con mới'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      mode="icon"
                      size="sm"
                      aria-label={`Xóa công việc con ${index + 1}`}
                      onClick={() =>
                        onChildrenChange(
                          children.filter(
                            (_, childIndex) => childIndex !== index,
                          ),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm md:col-span-2">
                      <span>Tên công việc con *</span>
                      <Input
                        value={child.title}
                        onChange={(event) =>
                          updateChild(index, { title: event.target.value })
                        }
                        placeholder="Nhập tên công việc con"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm md:col-span-2">
                      <span>Mô tả</span>
                      <Textarea
                        rows={2}
                        value={child.description}
                        onChange={(event) =>
                          updateChild(index, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Mô tả công việc con"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm">
                      <span>Mức độ ưu tiên</span>
                      <OptionSelect
                        value={child.priority}
                        onChange={(value) =>
                          updateChild(index, {
                            priority:
                              value as WorkTemplateChildFormValues['priority'],
                          })
                        }
                        options={priorityOptions}
                        searchable={false}
                      />
                    </label>
                    <label className="space-y-1.5 text-sm md:col-span-2">
                      <span>Nhân viên phụ trách</span>
                      <OptionSelect
                        value={child.assigneeEmployeeId}
                        onChange={(value) =>
                          updateChild(index, { assigneeEmployeeId: value })
                        }
                        options={assigneeOptions}
                        placeholder="Chọn nhân viên"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm">
                      <span>Màu công việc</span>
                      <ColorInput
                        value={child.color}
                        onValueChange={(value) =>
                          updateChild(index, { color: value })
                        }
                        expanded
                      />
                    </label>
                    <label className="space-y-1.5 text-sm md:col-span-2">
                      <span>Nhãn công việc</span>
                      <MultiSelect
                        value={child.labelIds}
                        onChange={(value) =>
                          updateChild(index, { labelIds: value })
                        }
                        options={labelOptions}
                        searchPlaceholder="Tìm nhãn..."
                        emptyMessage="Không có nhãn phù hợp"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {section !== 'children' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip className="size-4" /> Tệp đính kèm
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Công việc được tạo sẽ tham chiếu đến cùng tệp của mẫu.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.currentTarget.value = '';
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload /> Chọn tệp
            </Button>
          </div>

          {attachments.length === 0 && pendingFiles.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Mẫu chưa có tệp đính kèm.
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {attachments.map((attachment) => {
                const markedForDelete = deletedAttachmentIds.includes(
                  attachment.id,
                );
                return (
                  <div
                    key={attachment.id}
                    className="flex min-w-0 items-center gap-3 px-3 py-2.5"
                  >
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {attachment.fileName}
                    </span>
                    {markedForDelete ? (
                      <Badge variant="outline">Xóa khi lưu</Badge>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      mode="icon"
                      size="sm"
                      aria-label={`${markedForDelete ? 'Giữ lại' : 'Xóa'} tệp ${attachment.fileName}`}
                      onClick={() => toggleAttachmentDelete(attachment.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
              {pendingFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex min-w-0 items-center gap-3 px-3 py-2.5"
                >
                  <FileText className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {file.name}
                  </span>
                  <Badge variant="secondary">Tải lên khi lưu</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    size="sm"
                    aria-label={`Bỏ tệp ${file.name}`}
                    onClick={() =>
                      onPendingFilesChange(
                        pendingFiles.filter(
                          (_, fileIndex) => fileIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
