/**
 * Scaffolded by table-builder from `src/project/receipts/table/material-receipt-line.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNumberFormat } from '@/providers/number-format-provider';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import type { MaterialReceiptLine } from '../model/material-receipt';

export const MATERIAL_RECEIPT_LINE_COLUMN_PINNING: ColumnPinningState = {
  left: ['select'],
  right: ['actions'],
};

export function useMaterialReceiptLineColumns({
  canEdit,
  onEditMaterial,
}: {
  canEdit: boolean;
  onEditMaterial: (line: MaterialReceiptLine) => void;
}): ColumnDef<MaterialReceiptLine>[] {
  const { formatNumber, formatCurrency, formatPercent } = useNumberFormat();

  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialReceiptLine>({
      formatNumber,
      formatCurrency,
      formatPercent,
    });

    return [
      col.select(),
      col.custom({
        id: 'material',
        header: intl.formatMessage({ id: 'receipts.items.columns.model' }),
        size: 300,
        enableSorting: false,
        cell: (row) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{row.model.name}</div>
            {row.model.code ? (
              <div className="truncate text-xs text-muted-foreground">
                {row.model.code}
              </div>
            ) : null}
          </div>
        ),
      }),
      col.number({
        id: 'quantity',
        header: intl.formatMessage({ id: 'receipts.fields.quantity' }),
        get: (row) => row.quantity,
        size: 150,
        enableSorting: false,
      }),
      col.custom({
        id: 'condition',
        header: intl.formatMessage({ id: 'receipts.fields.unitCondition' }),
        size: 180,
        enableSorting: false,
        cell: (row) => {
          const activeItems = row.items.filter(
            (item) => item.status === 'active',
          );
          const damaged = activeItems.filter(
            (item) => item.condition === 'damaged',
          ).length;
          const good = activeItems.length - damaged;
          return (
            <span className="text-sm">
              {damaged === 0
                ? intl.formatMessage(
                    { id: 'receipts.conditions.goodCount' },
                    { count: good },
                  )
                : good === 0
                  ? intl.formatMessage(
                      { id: 'receipts.conditions.damagedCount' },
                      { count: damaged },
                    )
                  : intl.formatMessage(
                      { id: 'receipts.conditions.mixedCount' },
                      { good, damaged },
                    )}
            </span>
          );
        },
      }),
      col.custom({
        id: 'specifications',
        header: intl.formatMessage({ id: 'receipts.fields.specifications' }),
        size: 320,
        enableSorting: false,
        cell: (row) => {
          const unitSpecificationOverrides = row.items
            .filter((item) => item.status === 'active')
            .map((item) => {
              const overrides =
                item.currentSpecificationOverrides ??
                item.material?.specificationOverrides;
              return overrides && typeof overrides === 'object'
                ? (overrides as Record<string, string[]>)
                : {};
            });
          const unitSpecificationLabels = row.items
            .filter((item) => item.status === 'active')
            .map((item) => {
              const labels =
                item.currentSpecificationOverrideLabels ??
                item.material?.specificationOverrideLabels;
              return labels && typeof labels === 'object'
                ? (labels as Record<string, string[]>)
                : {};
            });
          const specificationMismatch =
            new Set(
              unitSpecificationOverrides.map((value, index) =>
                JSON.stringify({
                  values: value,
                  labels: unitSpecificationLabels[index] ?? {},
                }),
              ),
            ).size > 1;
          if (specificationMismatch) {
            return (
              <Badge variant="warning">
                {intl.formatMessage({
                  id: 'receipts.items.specificationMismatch',
                })}
              </Badge>
            );
          }
          const specificationOverrides =
            unitSpecificationOverrides[0] ?? row.specificationOverrides;
          const specificationOverrideLabels =
            unitSpecificationLabels[0] ?? row.specificationOverrideLabels;
          const summary = (row.model.specifications ?? [])
            .map((specification) => {
              const values =
                specificationOverrides[specification.id] ??
                (specification.values.length === 1
                  ? [specification.values[0]]
                  : []);
              if (!values.length) return null;
              const labels =
                specificationOverrideLabels[specification.id] ?? [];
              const displayValues = values.map((value, index) => {
                const defaultValueIndex = specification.values.indexOf(value);
                return (
                  labels[index]?.trim() ||
                  (defaultValueIndex >= 0
                    ? specification.valueLabels[defaultValueIndex]
                    : '') ||
                  value
                );
              });
              return `${specification.name}: ${displayValues.join(', ')}`;
            })
            .filter((value): value is string => Boolean(value));
          return summary.length ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              {summary.map((value) => (
                <div key={value} className="truncate">
                  {value}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          );
        },
      }),
      col.actions({
        header: '',
        size: getDataGridActionsColumnSize(canEdit ? 1 : 0),
        enableSorting: false,
        cell: (row) =>
          canEdit ? (
            <DataGridActionButton
              type="button"
              action="edit"
              mode="icon"
              size="sm"
              aria-label={intl.formatMessage({
                id: 'receipts.actions.editMaterial',
              })}
              tooltip={intl.formatMessage({
                id: 'receipts.actions.editMaterial',
              })}
              onClick={() => onEditMaterial(row)}
            >
              <Pencil className="size-4" />
            </DataGridActionButton>
          ) : null,
      }),
    ];
  }, [
    canEdit,
    formatNumber,
    formatCurrency,
    formatPercent,
    intl,
    onEditMaterial,
  ]);
}
