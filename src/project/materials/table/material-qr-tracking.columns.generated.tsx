/**
 * Scaffolded by table-builder from `src/project/materials/table/material-qr-tracking.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { ExternalLink, Eye, Link2, QrCode } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNumberFormat } from '@/providers/number-format-provider';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { MaterialIdentity } from '@/components/material-identity';
import { MaterialAvailabilityCell } from '../components/material-availability-cell';
import { MaterialQrCodeButton } from '../components/material-qr-code-button';
import type { Material } from '../model/material';
import type { MaterialQrTrackingRow } from '../model/material-qr-tracking';

export const MATERIAL_QR_TRACKING_ROW_COLUMN_PINNING: ColumnPinningState = {
  left: ['select'],
  right: ['actions'],
};

export interface UseMaterialQrTrackingColumnsParams {
  canManage: boolean;
  pendingAvailabilityIds: ReadonlySet<string>;
  onAvailabilityChange: (material: Material, isActive: boolean) => void;
  onOpenQr: (material: Material) => void;
  onViewQr: (row: MaterialQrTrackingRow) => void;
  onOpen: (row: MaterialQrTrackingRow) => void;
  onCopyLink: (row: MaterialQrTrackingRow) => void;
}

export function useMaterialQrTrackingColumns(
  params: UseMaterialQrTrackingColumnsParams,
): ColumnDef<MaterialQrTrackingRow>[] {
  const {
    canManage,
    pendingAvailabilityIds,
    onAvailabilityChange,
    onOpenQr,
    onViewQr,
    onOpen,
    onCopyLink,
  } = params;
  const { formatNumber, formatCurrency, formatPercent } = useNumberFormat();

  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialQrTrackingRow>({
      formatNumber,
      formatCurrency,
      formatPercent,
    });

    return [
      col.select(),
      col.custom({
        id: 'availability',
        header: intl.formatMessage({
          id: 'materialModels.fields.availability',
        }),
        size: 80,
        enableSorting: false,
        cell: (row) => (
          <MaterialAvailabilityCell
            material={row}
            canManage={canManage}
            isPending={pendingAvailabilityIds.has(row.id)}
            onChange={onAvailabilityChange}
          />
        ),
      }),
      col.custom({
        id: 'qrCode',
        header: intl.formatMessage({ id: 'project.materials.fields.qrCode' }),
        size: 80,
        enableSorting: false,
        cell: (row) => (
          <MaterialQrCodeButton material={row} onOpen={onOpenQr} />
        ),
      }),
      col.custom({
        id: 'identity',
        header: intl.formatMessage({ id: 'project.materials.fields.identity' }),
        headerClassName: 'min-w-[260px]',
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <MaterialIdentity
            name={row.nameOverride?.trim() || row.modelSnapshot.name}
            code={row.code}
            imageUrl={row.images.find((image) => image.isCover)?.url}
          />
        ),
      }),
      col.custom({
        id: 'scanCount',
        header: intl.formatMessage({
          id: 'project.materialQrTracking.columns.scanCount',
        }),
        size: 120,
        enableSorting: false,
        cellClassName: 'text-right tabular-nums',
        cell: (row) => (
          <span className="flex items-center justify-end gap-2">
            <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>{formatNumber(row.scanCount)}</span>
          </span>
        ),
      }),
      col.date({
        id: 'lastPrintedAt',
        header: intl.formatMessage({
          id: 'project.materialQrTracking.columns.lastPrintedAt',
        }),
        get: (row) => row.lastPrintedAt,
        mode: 'date',
        size: 150,
        enableSorting: false,
      }),
      col.actions({
        header: '',
        cellClassName: 'text-right',
        size: getDataGridActionsColumnSize(3),
        enableSorting: false,
        cell: (row) => (
          <div className="flex justify-end gap-1">
            <DataGridActionButton
              action="view"
              tooltip={intl.formatMessage({
                id: 'project.materialQrTracking.actions.viewQr',
              })}
              aria-label={intl.formatMessage({
                id: 'project.materialQrTracking.actions.viewQr',
              })}
              type="button"
              mode="icon"
              size="sm"
              onClick={() => onViewQr(row)}
            >
              <QrCode className="size-4" />
            </DataGridActionButton>
            <DataGridActionButton
              action="primary"
              tooltip={intl.formatMessage({
                id: 'project.materialQrTracking.actions.open',
              })}
              aria-label={intl.formatMessage({
                id: 'project.materialQrTracking.actions.open',
              })}
              type="button"
              mode="icon"
              size="sm"
              onClick={() => onOpen(row)}
            >
              <ExternalLink className="size-4" />
            </DataGridActionButton>
            <DataGridActionButton
              action="copy"
              tooltip={intl.formatMessage({
                id: 'project.materialQrTracking.actions.copyLink',
              })}
              aria-label={intl.formatMessage({
                id: 'project.materialQrTracking.actions.copyLink',
              })}
              type="button"
              mode="icon"
              size="sm"
              onClick={() => onCopyLink(row)}
            >
              <Link2 className="size-4" />
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [
    formatNumber,
    formatCurrency,
    formatPercent,
    intl,
    canManage,
    pendingAvailabilityIds,
    onAvailabilityChange,
    onOpenQr,
    onViewQr,
    onOpen,
    onCopyLink,
  ]);
}
