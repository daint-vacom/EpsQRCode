/**
 * Scaffolded by table-builder from `src/project/material-specifications/table/material-specification.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import {
  CalendarDays,
  CaseSensitive,
  Hash,
  Palette,
  Pencil,
  Ruler,
  Scale,
  ToggleLeft,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import {
  type MaterialSpecification,
  type MaterialSpecificationDataType,
} from '../model/material-specification';

export const MATERIAL_SPECIFICATION_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseMaterialSpecificationColumnsParams {
  canManage: boolean;
  onEdit: (row: MaterialSpecification) => void;
  onDelete: (row: MaterialSpecification) => void;
}

const DATA_TYPE_ICONS: Record<MaterialSpecificationDataType, LucideIcon> = {
  text: CaseSensitive,
  number: Hash,
  boolean: ToggleLeft,
  date: CalendarDays,
  color: Palette,
  length: Ruler,
  weight: Scale,
};

export function useMaterialSpecificationColumns({
  canManage,
  onEdit,
  onDelete,
}: UseMaterialSpecificationColumnsParams): ColumnDef<MaterialSpecification>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialSpecification>();
    const actionCount = canManage ? 2 : 0;

    const columns: ColumnDef<MaterialSpecification>[] = [
      col.custom({
        id: 'identity',
        header: intl.formatMessage({
          id: 'materialSpecifications.columns.identity',
        }),
        size: 280,
        enableSorting: false,
        cell: (row) => {
          const DataTypeIcon = DATA_TYPE_ICONS[row.dataType];
          return (
            <div className="flex min-w-0 items-center gap-2">
              <DataTypeIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-foreground">
                  {row.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {row.code}
                </span>
              </div>
            </div>
          );
        },
      }),
      col.text({
        id: 'description',
        header: intl.formatMessage({
          id: 'materialSpecifications.fields.description',
        }),
        get: (row) => row.description,
        size: 280,
        enableSorting: false,
        tooltipOnTruncate: true,
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
                tooltip={intl.formatMessage(
                  { id: 'materialSpecifications.columns.edit' },
                  { name: row.name },
                )}
                aria-label={intl.formatMessage(
                  { id: 'materialSpecifications.columns.edit' },
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
                tooltip={intl.formatMessage(
                  { id: 'materialSpecifications.columns.delete' },
                  { name: row.name },
                )}
                aria-label={intl.formatMessage(
                  { id: 'materialSpecifications.columns.delete' },
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
  }, [intl, canManage, onEdit, onDelete]);
}
