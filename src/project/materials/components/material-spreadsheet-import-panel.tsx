import { useEffect, useMemo, useState } from 'react';
import type { Custodian } from '@/project/custodians/model/custodian';
import type { MaterialModel } from '@/project/material-models/model/material-model';
import type { SpreadsheetTemplate } from '@/project/spreadsheets/api/spreadsheet-templates.api';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  readMappedRows,
  readXlsxFile,
  SpreadsheetError,
  type SpreadsheetMapping,
  type SpreadsheetWorkbook,
} from '@/lib/spreadsheets/xlsx';
import type { SpreadsheetField } from '@/lib/spreadsheets/xlsx';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BulkMaterialCreateResult } from '../api/materials.api';
import { useCreateMaterialsBulkMutation } from '../hooks/use-materials';
import type { Material } from '../model/material';
import {
  mapMaterialImportRows,
  type MaterialImportRow,
} from '../spreadsheet/material-spreadsheet';
import { MaterialSpreadsheetMappingEditor } from './material-spreadsheet-mapping-editor';

interface MaterialSpreadsheetImportPanelProps {
  fields: SpreadsheetField<Material>[];
  models: MaterialModel[];
  custodians: Custodian[];
  sharedTemplate: SpreadsheetTemplate | null;
  sharedTemplateLoading: boolean;
  sharedTemplateError: boolean;
}

export function MaterialSpreadsheetImportPanel({
  fields,
  models,
  custodians,
  sharedTemplate,
  sharedTemplateLoading,
  sharedTemplateError,
}: MaterialSpreadsheetImportPanelProps) {
  const intl = useIntl();
  const { userId } = useUser();
  const createMutation = useCreateMaterialsBulkMutation();
  const [fileName, setFileName] = useState('');
  const [hasCustomFile, setHasCustomFile] = useState(false);
  const [workbook, setWorkbook] = useState<SpreadsheetWorkbook | null>(null);
  const [mapping, setMapping] = useState<SpreadsheetMapping | null>(null);
  const [fileError, setFileError] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [results, setResults] = useState<BulkMaterialCreateResult[] | null>(
    null,
  );

  useEffect(() => {
    if (hasCustomFile) return;
    setFileName(sharedTemplate?.fileName ?? '');
    setWorkbook(sharedTemplate?.workbook ?? null);
    setMapping(null);
    setResults(null);
  }, [hasCustomFile, sharedTemplate]);

  const worksheet = mapping
    ? workbook?.getWorksheet(mapping.worksheetName)
    : undefined;
  const spreadsheetRows = useMemo(
    () =>
      worksheet && mapping
        ? readMappedRows(
            worksheet,
            mapping,
            fields.map((field) => field.key),
          )
        : [],
    [fields, mapping, worksheet],
  );
  const importRows = useMemo<MaterialImportRow[]>(
    () =>
      mapMaterialImportRows(
        spreadsheetRows,
        models,
        custodians,
        fields,
        (id, values) => intl.formatMessage({ id }, values),
      ),
    [custodians, fields, intl, models, spreadsheetRows],
  );
  const validRows = importRows.filter(
    (row) => row.values !== null && !row.error,
  );
  const errorCount = importRows.length - validRows.length;
  const requiredKeys = fields
    .filter((field) => field.required)
    .map((field) => field.key);
  const requiredMapped = requiredKeys.every((key) =>
    Boolean(mapping?.columnByFieldKey[key]),
  );

  const handleFile = async (selectedFile?: File) => {
    setFileError('');
    setResults(null);
    setMapping(null);
    if (!selectedFile) {
      setHasCustomFile(false);
      setFileName(sharedTemplate?.fileName ?? '');
      setWorkbook(sharedTemplate?.workbook ?? null);
      return;
    }
    setHasCustomFile(true);
    setFileName(selectedFile.name);
    setWorkbook(null);
    setFileLoading(true);
    try {
      setWorkbook(await readXlsxFile(selectedFile));
    } catch (error) {
      setFileError(getErrorText(error, intl.formatMessage));
    } finally {
      setFileLoading(false);
    }
  };

  const handleImport = async () => {
    const importableRows = validRows.filter(
      (
        row,
      ): row is MaterialImportRow & {
        values: NonNullable<MaterialImportRow['values']>;
      } => row.values !== null,
    );
    if (importableRows.length === 0 || !requiredMapped) return;
    setFileError('');
    setResults(null);
    const createdResults: BulkMaterialCreateResult[] = [];
    try {
      for (let start = 0; start < importableRows.length; start += 100) {
        const batch = importableRows.slice(start, start + 100);
        const batchResults = await createMutation.mutateAsync(
          batch.map((row) => row.values),
        );
        createdResults.push(
          ...batchResults.map((result, index) => ({
            ...result,
            rowNumber: batch[index]?.rowNumber ?? result.rowNumber,
          })),
        );
      }
      setResults(createdResults);
    } catch (error) {
      setFileError(getErrorText(error, intl.formatMessage));
      if (createdResults.length > 0) setResults(createdResults);
    }
  };

  const importSuccessCount =
    results?.filter((result) => result.success).length ?? 0;
  const importFailureCount =
    results?.filter((result) => !result.success).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="material-import-file">
          {intl.formatMessage({
            id: 'project.materials.spreadsheet.templateOptional',
          })}
        </label>
        <Input
          id="material-import-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            void handleFile(file);
          }}
        />
        <p className="text-xs text-muted-foreground">
          {intl.formatMessage({ id: 'project.materials.spreadsheet.fileHelp' })}
        </p>
      </div>

      {sharedTemplateLoading ? (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="size-4 animate-spin" />
          {intl.formatMessage({ id: 'common.state.loading' })}
        </p>
      ) : workbook ? (
        <p className="text-sm text-muted-foreground">
          {intl.formatMessage(
            {
              id: hasCustomFile
                ? 'project.materials.spreadsheet.customTemplateActive'
                : sharedTemplate
                  ? 'project.materials.spreadsheet.sharedTemplateActive'
                  : 'project.materials.spreadsheet.templateActive',
            },
            { name: fileName },
          )}
        </p>
      ) : sharedTemplateError ? (
        <p className="text-sm text-destructive" role="alert">
          {intl.formatMessage({
            id: 'project.materials.spreadsheet.sharedTemplateLoadError',
          })}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {intl.formatMessage({
            id: 'project.materials.spreadsheet.sharedTemplateMissing',
          })}
        </p>
      )}
      {hasCustomFile ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleFile()}
        >
          {intl.formatMessage({
            id: 'project.materials.spreadsheet.useSharedTemplate',
          })}
        </Button>
      ) : null}

      {fileLoading ? (
        <div
          className="flex items-center gap-2 py-4 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="size-4 animate-spin" />
          {intl.formatMessage({ id: 'common.state.loading' })}
        </div>
      ) : null}
      {fileError ? (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{fileError}</span>
        </div>
      ) : null}

      {workbook ? (
        <>
          <MaterialSpreadsheetMappingEditor
            workbook={workbook}
            fileName={fileName}
            userId={userId}
            fields={fields}
            onMappingChange={setMapping}
          />
          {!requiredMapped ? (
            <p className="text-sm text-destructive">
              {intl.formatMessage({
                id: 'project.materials.spreadsheet.mappingMissing',
              })}
            </p>
          ) : null}
          {spreadsheetRows.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-3 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" />
              {intl.formatMessage({
                id: 'project.materials.spreadsheet.noRows',
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">
                  {intl.formatMessage(
                    { id: 'project.materials.spreadsheet.previewCount' },
                    { count: importRows.length },
                  )}
                </span>
                <span className="text-success">
                  {intl.formatMessage(
                    { id: 'project.materials.spreadsheet.validCount' },
                    { count: validRows.length },
                  )}
                </span>
                {errorCount > 0 ? (
                  <span className="text-destructive">
                    {intl.formatMessage(
                      { id: 'project.materials.spreadsheet.errorCount' },
                      { count: errorCount },
                    )}
                  </span>
                ) : null}
              </div>
              <div className="max-h-56 overflow-auto rounded-md border border-border">
                <table className="w-full min-w-[42rem] text-left text-xs">
                  <thead className="sticky top-0 bg-muted/70">
                    <tr>
                      <th className="px-3 py-2 font-semibold">
                        {intl.formatMessage({
                          id: 'project.materials.spreadsheet.row',
                        })}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {intl.formatMessage({
                          id: 'project.materials.spreadsheet.fields.code',
                        })}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {intl.formatMessage({
                          id: 'project.materials.spreadsheet.fields.modelCode',
                        })}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {intl.formatMessage({
                          id: 'project.materials.spreadsheet.fields.ownerName',
                        })}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {intl.formatMessage({
                          id: 'project.materials.spreadsheet.result',
                        })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 20).map((row) => (
                      <tr
                        className="border-t border-border"
                        key={row.rowNumber}
                      >
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.code || '—'}</td>
                        <td className="px-3 py-2">
                          {getRowValue(
                            spreadsheetRows,
                            row.rowNumber,
                            'material.model.code',
                          ) || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {getRowValue(
                            spreadsheetRows,
                            row.rowNumber,
                            'material.owner.name',
                          ) ||
                            getRowValue(
                              spreadsheetRows,
                              row.rowNumber,
                              'material.owner.code',
                            ) ||
                            '—'}
                        </td>
                        <td className="px-3 py-2">
                          {row.error ? (
                            <span className="text-destructive">
                              {row.error}
                            </span>
                          ) : (
                            <span className="text-success">
                              {intl.formatMessage({
                                id: 'project.materials.spreadsheet.validLabel',
                              })}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {results ? (
            <div
              className="space-y-2 rounded-md border border-border p-3"
              role="status"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-success" />
                {intl.formatMessage(
                  { id: 'project.materials.spreadsheet.successSummary' },
                  { success: importSuccessCount, failed: importFailureCount },
                )}
              </div>
              {results.some((result) => !result.success) ? (
                <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-destructive">
                  {results
                    .filter((result) => !result.success)
                    .map((result) => (
                      <li key={`${result.rowNumber}-${result.code}`}>
                        {intl.formatMessage({
                          id: 'project.materials.spreadsheet.row',
                        })}{' '}
                        {result.rowNumber}: {result.error}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={
                !requiredMapped ||
                validRows.length === 0 ||
                createMutation.isPending ||
                results !== null
              }
              onClick={() => void handleImport()}
            >
              {createMutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {intl.formatMessage({
                id: createMutation.isPending
                  ? 'project.materials.spreadsheet.importing'
                  : 'project.materials.spreadsheet.importNow',
              })}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function getRowValue(
  rows: Array<{ rowNumber: number; values: Record<string, string> }>,
  rowNumber: number,
  key: string,
) {
  return rows.find((row) => row.rowNumber === rowNumber)?.values[key] ?? '';
}

function getErrorText(
  error: unknown,
  formatMessage: (descriptor: { id: string }) => string,
): string {
  if (error instanceof SpreadsheetError)
    return formatMessage({ id: error.message });
  return error instanceof Error ? error.message : String(error);
}
