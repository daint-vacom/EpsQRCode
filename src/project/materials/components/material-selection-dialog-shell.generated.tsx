/**
 * Scaffolded by dialog-builder from `src/project/materials/components/material-selection.dialog.fixture.ts`. Run `npm run gen:dialog` — do NOT hand-write this file.
 * You own this file now — keep dialog state and content composition in the feature.
 * To change title, description, footer actions or dialog width, edit the spec and re-gen to a scratch path first.
 */
import { type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface MaterialSelectionDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  onConfirm: () => void;
  confirmLabel?: ReactNode;
  confirmDisabled?: boolean;
  footerLeading?: ReactNode;
  contentClassName?: string;
  title?: ReactNode;
}
export function MaterialSelectionDialogShell({
  open,
  onOpenChange,
  children,
  onConfirm,
  confirmLabel,
  confirmDisabled = false,
  footerLeading,
  contentClassName,
  title,
}: MaterialSelectionDialogShellProps) {
  const intl = useIntl();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-w-2xl flex-col gap-0 overflow-hidden p-0',
          contentClassName,
        )}
      >
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-border px-6 py-5 pe-14 text-start">
          <DialogTitle>
            {title ??
              intl.formatMessage({ id: 'project.materials.selection.title' })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto p-0">
          {children}
        </DialogBody>
        <DialogFooter className="shrink-0 items-center justify-between border-t border-border px-6 py-4">
          {footerLeading}
          <Button
            type="button"
            variant="primary"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel ??
              intl.formatMessage({ id: 'project.materials.selection.confirm' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
