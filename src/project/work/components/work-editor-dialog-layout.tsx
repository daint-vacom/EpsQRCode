import type { ReactNode } from 'react';
import { ChevronRight, Copy, Ellipsis, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WorkEditorDialogFrameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  entityCode?: string | null;
  closeLabel?: string;
  isCloseDisabled?: boolean;
  children: ReactNode;
}

export function WorkEditorDialogFrame({
  open,
  onOpenChange,
  title,
  description = 'Không gian chỉnh sửa thông tin công việc.',
  entityCode,
  closeLabel = 'Đóng chỉnh sửa',
  isCloseDisabled = false,
  children,
}: WorkEditorDialogFrameProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex min-h-0 flex-col gap-0 overflow-hidden p-0"
        size="large"
        showCloseButton={false}
        aria-labelledby="work-editor-dialog-title"
      >
        <DialogHeader className="shrink-0 px-6 py-4 text-start">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{title}</span>
              {entityCode ? (
                <>
                  <ChevronRight className="size-3.5 shrink-0" />
                  <Badge variant="secondary" className="text-sm font-normal">
                    {entityCode}
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
                aria-label={closeLabel}
                onClick={() => onOpenChange(false)}
                disabled={isCloseDisabled}
              >
                <X />
              </Button>
            </div>
          </div>
          <DialogTitle id="work-editor-dialog-title" className="sr-only">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

interface WorkEditorDialogGridProps {
  main: ReactNode;
  properties: ReactNode;
  footer?: ReactNode;
}

export function WorkEditorDialogGrid({
  main,
  properties,
  footer,
}: WorkEditorDialogGridProps) {
  return (
    <>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_28rem]">
        {main}
        <aside className="min-h-0 overflow-y-auto border-t border-border lg:border-s lg:border-t-0">
          {properties}
        </aside>
      </div>
      {footer}
    </>
  );
}
