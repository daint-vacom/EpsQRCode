/**
 * Scaffolded by table-builder from `src/project/material-models/table/material-model.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import {
  createColumnHelpers,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { Switch } from '@/components/ui/switch';
import { MaterialIdentity } from '@/components/material-identity';
import type { MaterialModel } from '../model/material-model';

export const MATERIAL_MODEL_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseMaterialModelColumnsParams {
  onView: (row: MaterialModel) => void;
  onEdit: (row: MaterialModel) => void;
  onDelete: (row: MaterialModel) => void;
  canManage: boolean;
  pendingAvailabilityIds: ReadonlySet<string>;
  onAvailabilityChange: (row: MaterialModel, isActive: boolean) => void;
}

export function useMaterialModelColumns({
  onView,
  onEdit,
  onDelete,
  canManage,
  pendingAvailabilityIds,
  onAvailabilityChange,
}: UseMaterialModelColumnsParams): ColumnDef<MaterialModel>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialModel>();

    return [
      col.custom({
        id: 'availability',
        header: intl.formatMessage({
          id: 'materialModels.fields.availability',
        }),
        size: 110,
        enableSorting: false,
        cell: (row) => (
          <Switch
            checked={row.isActive}
            disabled={!canManage || pendingAvailabilityIds.has(row.id)}
            onCheckedChange={(checked) => onAvailabilityChange(row, checked)}
            aria-label={intl.formatMessage(
              {
                id: row.isActive
                  ? 'materialModels.columns.disable'
                  : 'materialModels.columns.enable',
              },
              { name: row.name },
            )}
          />
        ),
      }),
      col.custom({
        id: 'identity',
        header: intl.formatMessage({ id: 'materialModels.columns.identity' }),
        headerClassName: 'min-w-[260px]',
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <MaterialIdentity
            name={row.name}
            code={row.code}
            imageUrl={row.imageUrl}
          />
        ),
      }),
      col.date({
        id: 'createdAt',
        header: intl.formatMessage({ id: 'materialModels.columns.createdAt' }),
        get: (row) => row.createdAt,
        size: 150,
        enableSorting: false,
      }),
      col.date({
        id: 'updatedAt',
        header: intl.formatMessage({ id: 'materialModels.columns.updatedAt' }),
        get: (row) => row.updatedAt,
        size: 170,
        enableSorting: false,
      }),
      col.actions({
        header: intl.formatMessage({ id: 'materialModels.columns.actions' }),
        size: getDataGridActionsColumnSize(3),
        enableSorting: false,
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              mode="icon"
              aria-label={intl.formatMessage(
                { id: 'materialModels.columns.view' },
                { name: row.name },
              )}
              onClick={() => onView(row)}
            >
              <Eye />
            </Button>
            {canManage ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  aria-label={intl.formatMessage(
                    { id: 'materialModels.columns.edit' },
                    { name: row.name },
                  )}
                  onClick={() => onEdit(row)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  aria-label={intl.formatMessage(
                    { id: 'materialModels.columns.delete' },
                    { name: row.name },
                  )}
                  className="text-muted-foreground"
                  onClick={() => onDelete(row)}
                >
                  <Trash2 />
                </Button>
              </>
            ) : null}
          </div>
        ),
      }),
    ];
  }, [
    intl,
    onView,
    onEdit,
    onDelete,
    canManage,
    pendingAvailabilityIds,
    onAvailabilityChange,
  ]);
}
