/**
 * Scaffolded by table-builder from `src/project/material-models/table/material-model.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MaterialIdentity } from '@/components/material-identity';
import type { MaterialModel } from '../model/material-model';

export const MATERIAL_MODEL_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseMaterialModelColumnsParams {
  onEdit: (row: MaterialModel) => void;
  onDelete: (row: MaterialModel) => void;
  canManage: boolean;
  pendingAvailabilityIds: ReadonlySet<string>;
  onAvailabilityChange: (row: MaterialModel, isActive: boolean) => void;
}

export function useMaterialModelColumns({
  onEdit,
  onDelete,
  canManage,
  pendingAvailabilityIds,
  onAvailabilityChange,
}: UseMaterialModelColumnsParams): ColumnDef<MaterialModel>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialModel>();
    const actionCount = canManage ? 2 : 0;

    const columns: ColumnDef<MaterialModel>[] = [
      col.custom({
        id: 'availability',
        header: intl.formatMessage({
          id: 'materialModels.fields.availability',
        }),
        size: 80,
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
      col.custom({
        id: 'description',
        header: intl.formatMessage({ id: 'materialModels.fields.description' }),
        cellClassName: 'align-top',
        size: 280,
        enableSorting: false,
        cell: (row) => {
          const description = row.description ?? '';
          if (!description) return null;

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="line-clamp-3 whitespace-normal">
                  {description}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-lg whitespace-normal break-words">
                {description}
              </TooltipContent>
            </Tooltip>
          );
        },
      }),
    ];

    if (actionCount > 0) {
      columns.push(
        col.actions({
          id: 'actions',
          header: '',
          cellClassName: 'text-right',
          size: getDataGridActionsColumnSize(actionCount),
          enableSorting: false,
          cell: (row) => (
            <div className="flex justify-end gap-1">
              <DataGridActionButton
                action="edit"
                tooltip={intl.formatMessage({
                  id: 'materialModels.columns.edit',
                })}
                aria-label={intl.formatMessage(
                  { id: 'materialModels.columns.editAria' },
                  { name: row.name },
                )}
                type="button"
                mode="icon"
                size="sm"
                onClick={() => onEdit(row)}
              >
                <Pencil className="size-4" />
              </DataGridActionButton>
              <DataGridActionButton
                action="delete"
                tooltip={intl.formatMessage({
                  id: 'materialModels.columns.delete',
                })}
                aria-label={intl.formatMessage(
                  { id: 'materialModels.columns.deleteAria' },
                  { name: row.name },
                )}
                type="button"
                mode="icon"
                size="sm"
                onClick={() => onDelete(row)}
              >
                <Trash2 className="size-4" />
              </DataGridActionButton>
            </div>
          ),
        }),
      );
    }

    return columns;
  }, [
    intl,
    onEdit,
    onDelete,
    canManage,
    pendingAvailabilityIds,
    onAvailabilityChange,
  ]);
}
