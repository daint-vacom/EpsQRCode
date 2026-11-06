/**
 * Scaffolded by dialog-builder from `src/project/materials/components/material-qr-code-dialog.fixture.ts`. Run `npm run gen:dialog` — do NOT hand-write this file.
 * You own this file now — keep dialog state and content composition in the feature.
 * To change title, description, footer actions or dialog width, edit the spec and re-gen to a scratch path first.
 */
import { type ReactNode } from 'react';
import { Copy, Download, ExternalLink } from 'lucide-react';
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

export interface MaterialQrCodeDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  onCopyLink: () => void;
  onOpenLink: () => void;
  onDownloadPng: () => void;
}
export function MaterialQrCodeDialogShell({
  open,
  onOpenChange,
  children,
  onCopyLink,
  onOpenLink,
  onDownloadPng,
}: MaterialQrCodeDialogShellProps) {
  const intl = useIntl();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 pe-14 text-start">
          <DialogTitle>
            {intl.formatMessage({
              id: 'project.materialQrTracking.qrDialog.title',
            })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </DialogBody>
        <DialogFooter className="shrink-0 flex-col gap-3 px-6 py-4 sm:flex-row sm:justify-between sm:space-x-0">
          <div className="flex flex-wrap gap-2.5">
            <Button type="button" variant="outline" onClick={onCopyLink}>
              <Copy />
              {intl.formatMessage({
                id: 'project.materialQrTracking.qrDialog.actions.copyLink',
              })}
            </Button>
            <Button type="button" variant="outline" onClick={onDownloadPng}>
              <Download />
              {intl.formatMessage({
                id: 'project.materialQrTracking.qrDialog.actions.downloadPng',
              })}
            </Button>
          </div>
          <Button type="button" variant="primary" onClick={onOpenLink}>
            <ExternalLink />
            {intl.formatMessage({
              id: 'project.materialQrTracking.qrDialog.actions.open',
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
