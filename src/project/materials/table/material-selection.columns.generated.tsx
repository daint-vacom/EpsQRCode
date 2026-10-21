/**
 * Scaffolded by table-builder from `src/project/materials/table/material-selection.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import { MaterialIdentity } from '@/components/material-identity';
import type { Material } from '../model/material';

export const MATERIAL_COLUMN_PINNING: ColumnPinningState = {
  left: ['select'],
};

export function useMaterialColumns(): ColumnDef<Material>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<Material>();

    return [
      col.select(),
      col.custom({
        id: 'identity',
        header: intl.formatMessage({ id: 'project.materials.fields.identity' }),
        headerClassName: 'min-w-[260px]',
        size: 340,
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
        id: 'condition',
        header: intl.formatMessage({
          id: 'project.materials.fields.condition',
        }),
        size: 140,
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
          <Badge variant={row.status === 'loaned' ? 'secondary' : 'outline'}>
            {intl.formatMessage({
              id: `project.materials.status.${row.status}`,
            })}
          </Badge>
        ),
      }),
    ];
  }, [intl]);
}
