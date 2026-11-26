import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { FileIcon } from '@/components/ui/files/file-icon';
import type { HandoverAttachment } from '../model/handover';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function HandoverAttachmentsField({
  attachments,
  files,
  onFilesChange,
  onRemove,
  disabled = false,
  isUploading = false,
  readOnly = false,
}: {
  attachments: HandoverAttachment[];
  files: File[];
  onFilesChange: (files: File[]) => void;
  onRemove: (fileId: string) => void;
  disabled?: boolean;
  isUploading?: boolean;
  readOnly?: boolean;
}) {
  const intl = useIntl();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (selectedFiles: File[]) => {
    const oversized = selectedFiles.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setError(
        intl.formatMessage(
          { id: 'project.handover.errors.fileTooLarge' },
          { fileName: oversized.name },
        ),
      );
      return;
    }
    setError(null);
    onFilesChange([...files, ...selectedFiles]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {intl.formatMessage({ id: 'project.handover.fields.attachments' })}
          </p>
          {!readOnly ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {intl.formatMessage({
                id: 'project.handover.labels.attachmentHint',
              })}
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isUploading}
              loading={isUploading}
              loadingText={intl.formatMessage({
                id: 'project.handover.labels.uploading',
              })}
              onClick={() => inputRef.current?.click()}
            >
              <Upload />
              {intl.formatMessage({ id: 'project.handover.actions.upload' })}
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
              onChange={(event) =>
                handleFiles(Array.from(event.target.files ?? []))
              }
            />
          </>
        ) : null}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {attachments.length === 0 && files.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          {intl.formatMessage({ id: 'project.handover.empty.attachments' })}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {attachments.map((attachment) => (
            <div
              key={attachment.fileId}
              className="flex items-center gap-3 px-3 py-2.5 text-sm"
            >
              <FileIcon
                fileType={attachment.mimeType}
                fileName={attachment.fileName}
                alt=""
                className="size-5 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-foreground">
                {attachment.fileName}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(attachment.sizeBytes)}
              </span>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  disabled={disabled || isUploading}
                  aria-label={intl.formatMessage(
                    { id: 'project.handover.labels.removeAttachment' },
                    { fileName: attachment.fileName },
                  )}
                  onClick={() => onRemove(attachment.fileId)}
                >
                  <X />
                </Button>
              ) : null}
            </div>
          ))}
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex items-center gap-3 px-3 py-2.5 text-sm"
            >
              <FileIcon
                fileType={file.type || 'application/octet-stream'}
                fileName={file.name}
                alt=""
                className="size-5 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-foreground">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  disabled={disabled || isUploading}
                  aria-label={intl.formatMessage(
                    { id: 'project.handover.labels.removeAttachment' },
                    { fileName: file.name },
                  )}
                  onClick={() =>
                    onFilesChange(
                      files.filter((_, fileIndex) => fileIndex !== index),
                    )
                  }
                >
                  <X />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
