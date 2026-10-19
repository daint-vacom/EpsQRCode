import { ImagePlus, Upload } from 'lucide-react';
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const IMAGE_DROPZONE_ACCEPT: Accept = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

export interface ImageDropzoneProps {
  title: string;
  instruction: string;
  activeInstruction: string;
  buttonLabel: string;
  onFilesDropped: (files: File[], rejections: FileRejection[]) => void;
  accept?: Accept;
  disabled?: boolean;
  className?: string;
}

export function ImageDropzone({
  title,
  instruction,
  activeInstruction,
  buttonLabel,
  onFilesDropped,
  accept = IMAGE_DROPZONE_ACCEPT,
  disabled = false,
  className,
}: ImageDropzoneProps) {
  const { getInputProps, getRootProps, isDragActive, open } = useDropzone({
    accept,
    disabled,
    multiple: true,
    noClick: true,
    onDrop: onFilesDropped,
  });

  return (
    <div
      {...getRootProps({
        className: cn(
          'group flex h-full min-h-[250px] w-full flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-5 py-8 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-primary/35 hover:border-primary/70 hover:bg-primary/[0.02]',
          disabled && 'cursor-not-allowed opacity-60',
          className,
        ),
        'aria-label': title,
      })}
    >
      <input {...getInputProps()} />
      <div className="relative flex size-20 items-center justify-center rounded-2xl bg-primary/5 text-primary transition-colors group-hover:bg-primary/10">
        <ImagePlus className="size-11 stroke-[1.5]" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm">
          <Upload className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">
          {isDragActive ? activeInstruction : instruction}
        </p>
      </div>
      <Button
        type="button"
        variant="outline-primary"
        size="md"
        disabled={disabled}
        className="gap-2 border-primary/60 px-4"
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
      >
        <ImagePlus className="size-4" aria-hidden="true" />
        {buttonLabel}
      </Button>
    </div>
  );
}
