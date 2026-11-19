/**
 * Scaffolded by table-builder from `src/project/materials/table/material-spreadsheet-import-preview.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { BadgeCheck, BadgeX } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNumberFormat } from '@/providers/number-format-provider';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MaterialSpreadsheetImportPreviewRow } from '../spreadsheet/material-spreadsheet-import';

export const MATERIAL_SPREADSHEET_IMPORT_PREVIEW_ROW_COLUMN_PINNING: ColumnPinningState =
  {
    left: ['select', 'excelRow'],
  };

export function useMaterialSpreadsheetImportPreviewRowColumns(
  showFileName = true,
): ColumnDef<MaterialSpreadsheetImportPreviewRow>[] {
  const intl = useIntl();
  const { formatNumber, formatCurrency, formatPercent } = useNumberFormat();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialSpreadsheetImportPreviewRow>({
      formatNumber,
      formatCurrency,
      formatPercent,
    });
    const groupedValidationLabel = (isValid: boolean) =>
      intl.formatMessage({
        id: isValid
          ? 'project.materials.spreadsheet.validLabel'
          : 'project.materials.spreadsheet.invalidLabel',
      });

    return [
      col.select(),
      ...(showFileName
        ? [
            col.text({
              id: 'fileName',
              header: intl.formatMessage({
                id: 'project.materials.spreadsheet.previewFile',
              }),
              get: (row) => row.fileName,
              size: 150,
              enableSorting: false,
            }),
          ]
        : []),
      col.custom({
        id: 'excelRow',
        header: intl.formatMessage({ id: 'project.materials.spreadsheet.row' }),
        size: 105,
        enableSorting: false,
        cell: (row) => (
          <div className="inline-flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex cursor-help"
                  tabIndex={0}
                  aria-label={
                    row.groupSummary
                      ? groupedValidationLabel(row.isValid)
                      : row.isValid
                        ? intl.formatMessage({
                            id: 'project.materials.spreadsheet.validLabel',
                          })
                        : row.error ||
                          intl.formatMessage({
                            id: 'project.materials.spreadsheet.invalidLabel',
                          })
                  }
                >
                  {row.groupSummary ? (
                    row.isValid ? (
                      <BadgeCheck className="size-4 text-[var(--color-success-accent,var(--color-green-600))]" />
                    ) : (
                      <BadgeX className="size-4 text-destructive" />
                    )
                  ) : row.isValid ? (
                    <BadgeCheck className="size-4 text-[var(--color-success-accent,var(--color-green-600))]" />
                  ) : (
                    <BadgeX className="size-4 text-destructive" />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {row.groupSummary
                  ? groupedValidationLabel(row.isValid)
                  : row.isValid
                    ? intl.formatMessage({
                        id: 'project.materials.spreadsheet.validLabel',
                      })
                    : row.error ||
                      intl.formatMessage({
                        id: 'project.materials.spreadsheet.invalidLabel',
                      })}
              </TooltipContent>
            </Tooltip>
            <span>{row.groupSummary?.rowCount ?? row.excelRow ?? '—'}</span>
          </div>
        ),
      }),
      col.custom({
        id: 'validation',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.validation',
        }),
        size: 260,
        enableSorting: false,
        cell: (row) => (
          <span
            className={
              row.isValid
                ? 'text-[var(--color-success-accent,var(--color-green-600))]'
                : 'text-destructive'
            }
          >
            {row.groupSummary
              ? groupedValidationLabel(row.isValid)
              : row.isValid
                ? intl.formatMessage({
                    id: 'project.materials.spreadsheet.validLabel',
                  })
                : row.error ||
                  intl.formatMessage({
                    id: 'project.materials.spreadsheet.invalidLabel',
                  })}
          </span>
        ),
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
      col.number({
        id: 'quantity',
        header: intl.formatMessage({
          id: 'project.materials.spreadsheet.fields.quantity',
        }),
        get: (row) => row.quantity,
        size: 88,
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
    ];
  }, [formatCurrency, formatNumber, formatPercent, intl, showFileName]);
}
