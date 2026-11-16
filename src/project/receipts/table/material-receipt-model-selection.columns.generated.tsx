/**
 * Scaffolded by table-builder from `src/project/receipts/table/material-receipt-model-selection.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { MaterialModel } from '@/project/material-models/model/material-model';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import { MaterialIdentity } from '@/components/material-identity';

export const MATERIAL_MODEL_COLUMN_PINNING: ColumnPinningState = {
  left: ['select'],
};

export function useMaterialModelColumns(): ColumnDef<MaterialModel>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialModel>();

    return [
      col.select(),
      col.custom({
        id: 'identity',
        header: intl.formatMessage({ id: 'receipts.modelSelection.model' }),
        headerClassName: 'min-w-[300px]',
        size: 440,
        enableSorting: false,
        cell: (row) => (
          <MaterialIdentity
            name={row.name}
            code={row.code}
            imageUrl={row.imageUrl}
          />
        ),
      }),
    ];
  }, [intl]);
}
