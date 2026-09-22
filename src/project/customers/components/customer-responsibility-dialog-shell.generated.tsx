/**
 * Scaffolded by dialog-builder from `src/project/customers/components/customer-responsibility.dialog.fixture.ts`. Run `npm run gen:dialog` — do NOT hand-write this file.
 * You own this file now — keep dialog state and content composition in the feature.
 * To change title, description, footer actions or dialog width, edit the spec and re-gen to a scratch path first.
 */
import { type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface CustomerResponsibilityDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  dialogTitle: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  isSaving?: boolean;
  canConfirm?: boolean;
}
export function CustomerResponsibilityDialogShell({
  open,
  onOpenChange,
  children,
  dialogTitle,
  onCancel,
  onConfirm,
  isSaving = false,
  canConfirm = false,
}: CustomerResponsibilityDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 pe-14 text-start">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </DialogBody>
        <DialogFooter className="shrink-0 px-6 py-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            loading={isSaving}
            loadingText="Đang lưu..."
            disabled={!canConfirm}
          >
            <Check />
            Lưu phân công
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
