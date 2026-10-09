/**
 * Scaffolded by table-builder from `src/project/files/table/file-manager-item.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import type { FileManagerItem } from '../model/file-manager';

export const FILE_MANAGER_ITEM_COLUMN_PINNING: ColumnPinningState = {
  left: ['select'],
};

export function useFileManagerItemColumns(): ColumnDef<FileManagerItem>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<FileManagerItem>();

    return [
      col.select(),
      col.text({
        id: 'name',
        header: intl.formatMessage({ id: 'files.fields.name' }),
        get: (row) => row.name,
        tooltipOnTruncate: true,
        headerClassName: 'min-w-[320px]',
        size: 360,
        enableSorting: false,
      }),
      col.text({
        id: 'mimeType',
        header: intl.formatMessage({ id: 'files.fields.type' }),
        get: (row) => row.mimeType,
        headerClassName: 'w-[180px]',
        size: 180,
        enableSorting: false,
      }),
      col.text({
        id: 'sizeLabel',
        header: intl.formatMessage({ id: 'files.fields.size' }),
        get: (row) => row.sizeLabel,
        headerClassName: 'w-[130px]',
        size: 130,
        enableSorting: false,
      }),
      col.text({
        id: 'modifiedAtLabel',
        header: intl.formatMessage({ id: 'files.fields.activityDate' }),
        get: (row) => row.modifiedAtLabel,
        headerClassName: 'w-[180px]',
        size: 180,
        enableSorting: false,
      }),
    ];
  }, [intl]);
}
