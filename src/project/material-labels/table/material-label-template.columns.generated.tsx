/**
 * Scaffolded by table-builder from `src/project/material-labels/table/material-label-template.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import type { MaterialLabelTemplate } from '../model/material-label-template';

export const MATERIAL_LABEL_TEMPLATE_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseMaterialLabelTemplateColumnsParams {
  onEdit: (row: MaterialLabelTemplate) => void;
  onDelete: (row: MaterialLabelTemplate) => void;
}

export function useMaterialLabelTemplateColumns(
  params: UseMaterialLabelTemplateColumnsParams,
): ColumnDef<MaterialLabelTemplate>[] {
  const intl = useIntl();
  const { onEdit, onDelete } = params;

  return useMemo(() => {
    const col = createColumnHelpers<MaterialLabelTemplate>();

    return [
      col.text({
        id: 'name',
        header: intl.formatMessage({
          id: 'project.materialLabels.fields.name',
        }),
        get: (row) => row.name,
        size: 300,
        enableSorting: false,
      }),
      col.custom({
        id: 'dimensions',
        header: intl.formatMessage({
          id: 'project.materialLabels.fields.size',
        }),
        size: 160,
        enableSorting: false,
        cell: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.widthMm} × {row.heightMm} mm
          </span>
        ),
      }),
      col.custom({
        id: 'default',
        header: intl.formatMessage({
          id: 'project.materialLabels.fields.default',
        }),
        size: 150,
        enableSorting: false,
        cell: (row) =>
          row.isDefault ? (
            <Badge variant="success">
              {intl.formatMessage({
                id: 'project.materialLabels.states.default',
              })}
            </Badge>
          ) : null,
      }),
      col.custom({
        id: 'status',
        header: intl.formatMessage({
          id: 'project.materialLabels.fields.status',
        }),
        size: 160,
        enableSorting: false,
        cell: (row) => (
          <Badge variant={row.isActive ? 'success' : 'secondary'}>
            {intl.formatMessage({
              id: row.isActive
                ? 'project.materialLabels.states.active'
                : 'project.materialLabels.states.inactive',
            })}
          </Badge>
        ),
      }),
      col.actions({
        header: '',
        size: getDataGridActionsColumnSize(2),
        enableSorting: false,
        cell: (row) => (
          <div className="flex justify-end gap-1">
            <DataGridActionButton
              action="edit"
              tooltip={intl.formatMessage({
                id: 'project.materialLabels.actions.edit',
              })}
              aria-label={intl.formatMessage({
                id: 'project.materialLabels.actions.edit',
              })}
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
                id: 'project.materialLabels.actions.deactivate',
              })}
              aria-label={intl.formatMessage({
                id: 'project.materialLabels.actions.deactivate',
              })}
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
    ];
  }, [intl, onEdit, onDelete]);
}
