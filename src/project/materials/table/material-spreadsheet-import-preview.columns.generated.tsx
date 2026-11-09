/**
 * Scaffolded by table-builder from `src/project/materials/table/material-spreadsheet-import-preview.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { BadgeCheck, BadgeX } from 'lucide-react';
import { useIntl } from 'react-intl';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import type { MaterialSpreadsheetImportPreviewRow } from '../spreadsheet/material-spreadsheet-import';

export function useMaterialSpreadsheetImportPreviewRowColumns(): ColumnDef<MaterialSpreadsheetImportPreviewRow>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialSpreadsheetImportPreviewRow>();

    return [
      col.text({
        id: 'fileName',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.previewFile',
        }),
        get: (row) => row.fileName,
        size: 150,
        enableSorting: false,
      }),
      col.text({
        id: 'excelRow',
        header: intl.formatMessage({ id: 'project.materials.spreadsheet.row' }),
        get: (row) => row.excelRow,
        size: 88,
        enableSorting: false,
      }),
      col.text({
        id: 'code',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.fields.code',
        }),
        get: (row) => row.code,
        size: 130,
        enableSorting: false,
      }),
      col.text({
        id: 'modelCode',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.fields.modelCode',
        }),
        get: (row) => row.modelCode,
        size: 130,
        enableSorting: false,
      }),
      col.text({
        id: 'modelName',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.previewModelName',
        }),
        get: (row) => row.modelName,
        size: 150,
        enableSorting: false,
      }),
      col.text({
        id: 'name',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.previewMaterialName',
        }),
        get: (row) => row.name,
        size: 150,
        enableSorting: false,
      }),
      col.text({
        id: 'description',
        header: intl.formatMessage({
          id: 'project.materials.fields.description',
        }),
        get: (row) => row.description,
        size: 190,
        enableSorting: false,
      }),
      col.text({
        id: 'serialNumber',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.fields.serialNumber',
        }),
        get: (row) => row.serialNumber,
        size: 120,
        enableSorting: false,
      }),
      col.text({
        id: 'condition',
        header: intl.formatMessage({
          id: 'project.materials.fields.condition',
        }),
        get: (row) => row.condition,
        size: 115,
        enableSorting: false,
      }),
      col.text({
        id: 'specifications',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.previewSpecifications',
        }),
        get: (row) => row.specifications,
        size: 240,
        enableSorting: false,
      }),
      col.text({
        id: 'ownerCode',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.fields.ownerCode',
        }),
        get: (row) => row.ownerCode,
        size: 120,
        enableSorting: false,
      }),
      col.text({
        id: 'ownerName',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.previewOwner',
        }),
        get: (row) => row.ownerName,
        size: 160,
        enableSorting: false,
      }),
      col.text({
        id: 'note',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.fields.note',
        }),
        get: (row) => row.note,
        size: 180,
        enableSorting: false,
      }),
      col.custom({
        id: 'validation',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.validation',
        }),
        size: 135,
        enableSorting: false,
        cell: (row) => (
          <span
            className={
              row.isValid
                ? 'inline-flex items-center gap-1.5 text-success'
                : 'inline-flex items-center gap-1.5 text-destructive'
            }
            title={row.error || undefined}
          >
            {row.isValid ? (
              <BadgeCheck className="size-4 shrink-0" />
            ) : (
              <BadgeX className="size-4 shrink-0" />
            )}
            <span>
              {intl.formatMessage({
                id: row.isValid
                  ? 'project.materials.spreadsheet.validLabel'
                  : 'project.materials.spreadsheet.invalidLabel',
              })}
            </span>
          </span>
        ),
      }),
    ];
  }, [intl]);
}
