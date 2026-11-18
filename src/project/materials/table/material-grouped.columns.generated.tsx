/**
 * Scaffolded by table-builder from `src/project/materials/table/material-grouped.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import { MaterialIdentity } from '@/components/material-identity';
import {
  MaterialAvailabilityBadge,
  MaterialConditionBadge,
  MaterialStatusBadge,
} from '../components/material-value-badges';
import type { MaterialGrouped } from '../model/material';

export function useMaterialGroupedColumns(
  onOpenGroup: (groupKey: string) => void,
  groupNameById: ReadonlyMap<string, string>,
  receiptColumnHeader?: string,
): ColumnDef<MaterialGrouped>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialGrouped>();
    const value = (row: MaterialGrouped, key: string) => row.common[key] ?? '—';

    return [
      col.custom({
        id: 'model',
        header: intl.formatMessage({ id: 'project.materials.grouping.model' }),
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <MaterialIdentity
            name={row.modelName}
            code={row.modelCode}
            imageUrl={row.modelImageUrl}
          />
        ),
      }),
      col.custom({
        id: 'owner',
        header: intl.formatMessage({ id: 'project.materials.grouping.owner' }),
        size: 240,
        enableSorting: false,
        cell: (row) => value(row, 'ownerName'),
      }),
      col.custom({
        id: 'quantity',
        header: intl.formatMessage({
          id: 'project.materials.grouping.quantity',
        }),
        size: 140,
        enableSorting: false,
        cell: (row) => (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            aria-label={intl.formatMessage({
              id: 'project.materials.grouping.openDetails',
            })}
            onClick={() => onOpenGroup(row.groupKey)}
          >
            {row.quantity.toLocaleString()}
          </Button>
        ),
      }),
      col.custom({
        id: 'condition',
        header: intl.formatMessage({
          id: 'project.materials.grouping.condition',
        }),
        size: 180,
        enableSorting: false,
        cell: (row) => (
          <MaterialConditionBadge
            value={row.common.condition ?? row.condition}
          />
        ),
      }),
      col.custom({
        id: 'group',
        header: intl.formatMessage({ id: 'materialGroups.columns.groupShort' }),
        size: 220,
        enableSorting: false,
        cell: (row) => {
          const id = row.common.groupId;
          if (id === '…') return id;
          return id ? (groupNameById.get(id) ?? '—') : (id ?? '—');
        },
      }),
      col.custom({
        id: 'code',
        header: intl.formatMessage({ id: 'project.materials.fields.code' }),
        size: 180,
        enableSorting: false,
        cell: (row) => value(row, 'code'),
      }),
      ...(receiptColumnHeader
        ? [
            col.custom({
              id: 'receiptCode',
              header: receiptColumnHeader,
              size: 190,
              enableSorting: false,
              cell: (row) => value(row, 'receiptCode'),
            }),
          ]
        : []),
      col.custom({
        id: 'holder',
        header: intl.formatMessage({ id: 'project.materials.fields.holder' }),
        size: 220,
        enableSorting: false,
        cell: (row) => value(row, 'holder'),
      }),
      col.custom({
        id: 'status',
        header: intl.formatMessage({ id: 'project.materials.fields.status' }),
        size: 160,
        enableSorting: false,
        cell: (row) => <MaterialStatusBadge value={row.common.status} />,
      }),
      col.custom({
        id: 'availability',
        header: intl.formatMessage({
          id: 'materialModels.fields.availability',
        }),
        size: 120,
        enableSorting: false,
        cell: (row) => {
          const availability = row.common.availability;
          if (availability !== 'true' && availability !== 'false')
            return availability ?? '—';
          return <MaterialAvailabilityBadge value={availability === 'true'} />;
        },
      }),
    ];
  }, [groupNameById, intl, onOpenGroup, receiptColumnHeader]);
}
