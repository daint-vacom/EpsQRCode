import { Download, LoaderCircle, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileIcon } from '@/components/ui/files/file-icon';
import { Input, InputAddon, InputGroup } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export interface SingleFileUploadFieldProps {
  id: string;
  fileName?: string | null;
  accept?: string;
  canEdit?: boolean;
  disabled?: boolean;
  isUploading?: boolean;
  isDownloading?: boolean;
  chooseLabel: string;
  replaceLabel: string;
  downloadLabel: string;
  uploadingLabel: string;
  downloadingLabel: string;
  onFileSelected: (file: File) => void;
  onDownload: () => void;
}

export function SingleFileUploadField({
  id,
  fileName,
  accept,
  canEdit = true,
  disabled = false,
  isUploading = false,
  isDownloading = false,
  chooseLabel,
  replaceLabel,
  downloadLabel,
  uploadingLabel,
  downloadingLabel,
  onFileSelected,
  onDownload,
}: SingleFileUploadFieldProps) {
  const isBusy = disabled || isUploading || isDownloading;

  return (
    <div className="min-w-0">
      <InputGroup className="w-full min-w-0">
        <InputAddon className="min-w-0 grow justify-start gap-2 overflow-hidden rounded-s-md rounded-e-none border-e-0 bg-background px-3 text-foreground">
          <FileIcon
            fileType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            fileName={fileName}
            alt=""
            aria-hidden="true"
            className="size-4 shrink-0"
          />
          {fileName ? (
            <span className="min-w-0 truncate" title={fileName}>
              {fileName}
            </span>
          ) : null}
        </InputAddon>

        {fileName || canEdit ? (
          <div className="flex h-8.5 shrink-0 items-center gap-0.5 rounded-e-md border border-s-0 border-input bg-muted px-1 shadow-xs shadow-black/5">
            {fileName ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={onDownload}
              >
                {isDownloading ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {isDownloading ? downloadingLabel : downloadLabel}
              </Button>
            ) : null}

            {fileName && canEdit ? (
              <Separator
                orientation="vertical"
                className="mx-1 h-5 bg-border"
              />
            ) : null}

            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={() => {
                  const input = document.getElementById(id);
                  if (input instanceof HTMLInputElement) input.click();
                }}
              >
                {isUploading ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : fileName ? (
                  <RefreshCw aria-hidden="true" />
                ) : (
                  <Upload aria-hidden="true" />
                )}
                {isUploading
                  ? uploadingLabel
                  : fileName
                    ? replaceLabel
                    : chooseLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </InputGroup>

      {canEdit ? (
        <Input
          id={id}
          className="sr-only"
          type="file"
          accept={accept}
          disabled={isBusy}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) onFileSelected(file);
          }}
        />
      ) : null}

      {isUploading ? (
        <span className="sr-only" role="status">
          {uploadingLabel}
        </span>
      ) : null}
    </div>
  );
}
