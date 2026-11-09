/**
 * Scaffolded by dialog-builder from `src/project/materials/components/material-spreadsheet-export.dialog.fixture.ts`. Run `npm run gen:dialog` — do NOT hand-write this file.
 * You own this file now — keep dialog state and content composition in the feature.
 * To change title, description, footer actions or dialog width, edit the spec and re-gen to a scratch path first.
 */
import { type ReactNode } from 'react';
import { Download } from 'lucide-react';
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

export interface MaterialSpreadsheetExportDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  onExport: () => void;
  isExporting?: boolean;
  exportDisabled?: boolean;
}
export function MaterialSpreadsheetExportDialogShell({
  open,
  onOpenChange,
  children,
  onExport,
  isExporting = false,
  exportDisabled = false,
}: MaterialSpreadsheetExportDialogShellProps) {
  const intl = useIntl();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 pe-14 text-start">
          <DialogTitle>
            {intl.formatMessage({
              id: 'project.materials.spreadsheet.exportTitle',
            })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </DialogBody>
        <DialogFooter className="shrink-0 px-6 py-4">
          <Button
            type="button"
            variant="primary"
            onClick={onExport}
            loading={isExporting}
            loadingText={intl.formatMessage({
              id: 'project.materials.spreadsheet.exporting',
            })}
            disabled={exportDisabled}
          >
            <Download />
            {intl.formatMessage({
              id: 'project.materials.spreadsheet.exportNow',
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
