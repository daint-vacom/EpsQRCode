/**
 * Scaffolded by table-builder from `src/project/materials/table/material.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye, Pencil } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import type { Material } from '../model/material';

export interface UseMaterialColumnsParams {
  partyNameById: ReadonlyMap<string, string>;
  canManage: boolean;
  onView: (material: Material) => void;
  onEdit: (material: Material) => void;
}

export const MATERIAL_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export function useMaterialColumns({
  partyNameById,
  canManage,
  onView,
  onEdit,
}: UseMaterialColumnsParams): ColumnDef<Material>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<Material>();

    return [
      col.custom({
        id: 'identity',
        header: intl.formatMessage({ id: 'project.materials.fields.code' }),
        headerClassName: 'min-w-[260px]',
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <button
              type="button"
              className="truncate text-left font-semibold text-primary hover:underline"
              onClick={() => onView(row)}
            >
              {row.nameOverride?.trim() || row.modelSnapshot.name}
            </button>
            <span className="truncate text-xs text-muted-foreground">
              {row.code}
            </span>
          </div>
        ),
      }),
      col.custom({
        id: 'model',
        header: intl.formatMessage({ id: 'project.materials.fields.model' }),
        size: 280,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">
              {row.modelSnapshot.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {row.modelSnapshot.code}
            </span>
          </div>
        ),
      }),
      col.custom({
        id: 'owner',
        header: intl.formatMessage({ id: 'project.materials.fields.owner' }),
        size: 240,
        enableSorting: false,
        cell: (row) => partyNameById.get(row.ownerPartyId) ?? row.ownerPartyId,
      }),
      col.custom({
        id: 'borrower',
        header: intl.formatMessage({ id: 'project.materials.fields.borrower' }),
        size: 240,
        enableSorting: false,
        cell: (row) =>
          row.borrowerPartyId
            ? (partyNameById.get(row.borrowerPartyId) ?? row.borrowerPartyId)
            : null,
      }),
      col.text({
        id: 'serialNumber',
        header: intl.formatMessage({
          id: 'project.materials.fields.serialNumber',
        }),
        get: (row) => row.serialNumber,
        size: 180,
        enableSorting: false,
      }),
      col.custom({
        id: 'condition',
        header: intl.formatMessage({
          id: 'project.materials.fields.condition',
        }),
        size: 150,
        enableSorting: false,
        cell: (row) => (
          <Badge
            variant={row.condition === 'damaged' ? 'destructive' : 'success'}
          >
            {intl.formatMessage({
              id: `project.materials.condition.${row.condition}`,
            })}
          </Badge>
        ),
      }),
      col.custom({
        id: 'status',
        header: intl.formatMessage({ id: 'project.materials.fields.status' }),
        size: 150,
        enableSorting: false,
        cell: (row) => (
          <Badge variant={row.status === 'loaned' ? 'warning' : 'secondary'}>
            {intl.formatMessage({
              id: `project.materials.status.${row.status}`,
            })}
          </Badge>
        ),
      }),
      col.actions({
        header: '',
        size: getDataGridActionsColumnSize(2),
        enableSorting: false,
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            <DataGridActionButton
              action="view"
              tooltip={intl.formatMessage({
                id: 'project.materials.actions.view',
              })}
              aria-label={intl.formatMessage({
                id: 'project.materials.actions.view',
              })}
              type="button"
              onClick={() => onView(row)}
            >
              <Eye />
            </DataGridActionButton>
            {canManage && !row.reservedHandoverId ? (
              <DataGridActionButton
                action="edit"
                tooltip={intl.formatMessage({
                  id: 'project.materials.actions.edit',
                })}
                aria-label={intl.formatMessage({
                  id: 'project.materials.actions.edit',
                })}
                type="button"
                onClick={() => onEdit(row)}
              >
                <Pencil />
              </DataGridActionButton>
            ) : null}
          </div>
        ),
      }),
    ];
  }, [canManage, intl, onEdit, onView, partyNameById]);
}
