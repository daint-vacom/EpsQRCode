/**
 * Scaffolded by dialog-builder from `src/project/materials/components/material-spreadsheet-import.dialog.fixture.ts`. Run `npm run gen:dialog` — do NOT hand-write this file.
 * You own this file now — keep dialog state and content composition in the feature.
 * To change title, description, footer actions or dialog width, edit the spec and re-gen to a scratch path first.
 */
import { type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface MaterialSpreadsheetImportDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
  fullScreen?: boolean;
}
export function MaterialSpreadsheetImportDialogShell({
  open,
  onOpenChange,
  children,
  footer,
  fullScreen = false,
}: MaterialSpreadsheetImportDialogShellProps) {
  const intl = useIntl();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        variant={fullScreen ? 'fullscreen' : undefined}
        className={`flex flex-col gap-0 overflow-hidden p-0 ${fullScreen ? 'max-w-none' : 'max-w-5xl'}`}
      >
        <DialogHeader className="shrink-0 space-y-1.5 px-6 pt-5 pb-2 pe-14 text-start">
          <DialogTitle>
            {intl.formatMessage({
              id: 'project.materials.spreadsheet.importTitle',
            })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody
          className={`min-h-0 flex-1 px-6 pt-2 pb-5 ${fullScreen ? 'overflow-hidden' : 'overflow-y-auto'}`}
        >
          {children}
        </DialogBody>
        {footer ? (
          <DialogFooter className="shrink-0 px-6 py-4">{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
