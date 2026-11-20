/**
 * Scaffolded by dialog-builder from `src/project/receipts/components/material-receipt-recipient-dialog.fixture.ts`. Run `npm run gen:dialog` — do NOT hand-write this file.
 * You own this file now — keep dialog state and content composition in the feature.
 * To change title, description, footer actions or dialog width, edit the spec and re-gen to a scratch path first.
 */
import { type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface MaterialReceiptRecipientDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
}
export function MaterialReceiptRecipientDialogShell({
  open,
  onOpenChange,
  children,
  footer,
}: MaterialReceiptRecipientDialogShellProps) {
  const intl = useIntl();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 pe-14 text-start">
          <DialogTitle>
            {intl.formatMessage({ id: 'receipts.dialogs.receivingPartyTitle' })}
          </DialogTitle>
          <DialogDescription>
            {intl.formatMessage({
              id: 'receipts.dialogs.receivingPartyDescription',
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </DialogBody>
        {footer ? (
          <DialogFooter className="shrink-0 px-6 py-4">{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
