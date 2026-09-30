import { useRef } from 'react';
import type { FileAttachment } from '@/project/files/model/file';
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WorkEmployeeOption, WorkTemplateSummary } from '../model/work';
import {
  WorkChildrenPanel,
  type WorkChildrenPanelItem,
} from './work-detail-dialog';

interface WorkTemplateEditorSectionsProps {
  section?: 'children' | 'attachments' | 'all';
  children: WorkTemplateSummary[];
  onAddChild?: () => void;
  onEditChild?: (templateId: string) => void;
  onDeleteChild?: (child: WorkTemplateSummary) => void;
  employeeOptions: WorkEmployeeOption[];
  attachments: FileAttachment[];
  pendingFiles: File[];
  deletedAttachmentIds: string[];
  onPendingFilesChange: (files: File[]) => void;
  onDeletedAttachmentIdsChange: (attachmentIds: string[]) => void;
}

export function WorkTemplateEditorSections({
  section = 'all',
  children,
  onAddChild,
  onEditChild,
  onDeleteChild,
  employeeOptions,
  attachments,
  pendingFiles,
  deletedAttachmentIds,
  onPendingFilesChange,
  onDeletedAttachmentIdsChange,
}: WorkTemplateEditorSectionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const employeeNamesById = Object.fromEntries(
    employeeOptions.map((employee) => [employee.id, employee.label]),
  );
  const panelChildren: WorkChildrenPanelItem[] = children.map((child) => ({
    id: child.id,
    title: child.name,
    status: 'todo',
    plannedEndDate: null,
    plannedEndTime: null,
    assigneeName: employeeNamesById[child.assigneeEmployeeId ?? ''] ?? '',
  }));
  const childrenById = new Map(children.map((child) => [child.id, child]));

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
        <WorkChildrenPanel
          count={`0/${children.length}`}
          progress={0}
          children={panelChildren}
          isLoading={false}
          onCreateChild={onAddChild}
          onEditChild={(child) => onEditChild?.(child.id)}
          onDeleteChild={(child) => {
            const template = childrenById.get(child.id);
            if (template) onDeleteChild?.(template);
          }}
        />
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
