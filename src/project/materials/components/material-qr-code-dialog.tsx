import { Printer } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Material } from '../model/material';
import {
  copyMaterialQrUrl,
  downloadMaterialQrPngs,
  getMaterialDetailUrl,
  getMaterialQrUrl,
} from '../utils/material-qr';
import { MaterialQrCode } from './material-qr-code';
import { MaterialQrCodeDialogShell } from './material-qr-code-dialog-shell.generated';
import { MaterialAvailabilityBadge } from './material-value-badges';

export function MaterialQrCodeDialog({
  material,
  onOpenChange,
  onPrint,
}: {
  material: Material | null;
  onOpenChange: (open: boolean) => void;
  onPrint: (material: Material) => void;
}) {
  const intl = useIntl();

  if (!material) return null;

  const name = material.nameOverride?.trim() || material.modelSnapshot.name;
  const qrUrl = getMaterialQrUrl(material.id);

  const handleCopyLink = async () => {
    try {
      await copyMaterialQrUrl(material.id);
      toast.success(
        intl.formatMessage({
          id: 'project.materialQrTracking.toasts.linkCopied',
        }),
      );
    } catch {
      toast.error(
        intl.formatMessage({
          id: 'project.materialQrTracking.errors.copyLink',
        }),
      );
    }
  };

  const handleOpenLink = () =>
    window.open(
      getMaterialDetailUrl(material.id),
      '_blank',
      'noopener,noreferrer',
    );

  const handleDownloadPng = async () => {
    try {
      await downloadMaterialQrPngs([material]);
      toast.success(
        intl.formatMessage({
          id: 'project.materialQrTracking.toasts.pngDownloaded',
        }),
      );
    } catch {
      toast.error(
        intl.formatMessage({
          id: 'project.materialQrTracking.errors.downloadPng',
        }),
      );
    }
  };

  return (
    <MaterialQrCodeDialogShell
      open
      onOpenChange={onOpenChange}
      onCopyLink={() => void handleCopyLink()}
      onOpenLink={handleOpenLink}
      onDownloadPng={() => void handleDownloadPng()}
    >
      <div className="space-y-5">
        <div className="mx-auto flex w-fit items-center justify-center rounded-xl border border-border bg-white p-3">
          <MaterialQrCode
            materialId={material.id}
            materialCode={material.code}
            size={224}
            className="block"
          />
        </div>

        <div className="space-y-2 text-center">
          <p className="text-base font-semibold text-foreground">{name}</p>
          <p className="text-sm font-mono text-muted-foreground">
            {material.code}
          </p>
          <MaterialAvailabilityBadge value={material.isActive} />
        </div>

        <div className="space-y-1.5 rounded-xl border border-border bg-muted/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {intl.formatMessage({
              id: 'project.materialQrTracking.qrDialog.linkLabel',
            })}
          </p>
          <p className="break-all font-mono text-xs text-foreground">{qrUrl}</p>
        </div>

        <Button
          type="button"
          variant="dashed"
          size="md"
          className="w-full"
          onClick={() => onPrint(material)}
        >
          <Printer />
          {intl.formatMessage({
            id: 'project.materialQrTracking.qrDialog.actions.printByTemplate',
          })}
        </Button>
      </div>
    </MaterialQrCodeDialogShell>
  );
}
