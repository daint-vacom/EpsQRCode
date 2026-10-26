/**
 * Scaffolded by dialog-builder from `src/project/handover/components/handover-party.dialog.fixture.ts`. Run `npm run gen:dialog` — do NOT hand-write this file.
 * You own this file now — keep dialog state and content composition in the feature.
 * To change title, description, footer actions or dialog width, edit the spec and re-gen to a scratch path first.
 */
import { type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface HandoverPartyDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  onSave: () => void;
  isInvalid?: boolean;
}
export function HandoverPartyDialogShell({
  open,
  onOpenChange,
  children,
  onSave,
  isInvalid = false,
}: HandoverPartyDialogShellProps) {
  const intl = useIntl();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 pe-14 text-start">
          <DialogTitle>
            {intl.formatMessage({ id: 'project.handover.partyDialog.title' })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </DialogBody>
        <DialogFooter className="shrink-0 px-6 py-4">
          <Button
            type="button"
            variant="primary"
            onClick={onSave}
            disabled={isInvalid}
          >
            {intl.formatMessage({ id: 'project.handover.partyDialog.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
