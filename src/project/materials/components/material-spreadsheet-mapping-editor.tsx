import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  loadSpreadsheetMappingProfile,
  makeSpreadsheetMappingProfile,
  resolveSpreadsheetMappingProfile,
  saveSpreadsheetMappingProfile,
} from '@/lib/spreadsheets/mapping-profiles';
import type {
  SpreadsheetField,
  SpreadsheetMapping,
  SpreadsheetWorksheet,
} from '@/lib/spreadsheets/xlsx';
import {
  detectSpreadsheetMapping,
  getSpreadsheetHeaders,
  suggestSpreadsheetMapping,
} from '@/lib/spreadsheets/xlsx';
import { Input } from '@/components/ui/input';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import type { Material } from '../model/material';
import { MATERIAL_SPREADSHEET_ENTITY_KEY } from '../spreadsheet/material-spreadsheet';

interface MaterialSpreadsheetMappingEditorProps {
  workbook: {
    worksheets: SpreadsheetWorksheet[];
    getWorksheet: (name: string) => SpreadsheetWorksheet | undefined;
  };
  fileName: string;
  userId: string | null;
  fields: SpreadsheetField<Material>[];
  onMappingChange: (mapping: SpreadsheetMapping | null) => void;
}

export function MaterialSpreadsheetMappingEditor({
  workbook,
  fileName,
  userId,
  fields,
  onMappingChange,
}: MaterialSpreadsheetMappingEditorProps) {
  const intl = useIntl();
  const [worksheetName, setWorksheetName] = useState(
    workbook.worksheets[0]?.name ?? '',
  );
  const [headerRow, setHeaderRow] = useState(1);
  const [dataStartRow, setDataStartRow] = useState(2);
  const [mapping, setMapping] = useState<SpreadsheetMapping | null>(null);
  const worksheet = workbook.getWorksheet(worksheetName);
  const headers = useMemo(
    () => (worksheet ? getSpreadsheetHeaders(worksheet, headerRow) : []),
    [headerRow, worksheet],
  );
  const headerOptions: SelectOption[] = useMemo(
    () => [
      {
        value: '',
        label: intl.formatMessage({
          id: 'project.materials.spreadsheet.unmapped',
        }),
      },
      ...headers.map((header) => ({
        value: String(header.column),
        label: header.label,
      })),
    ],
    [headers, intl],
  );
  const worksheetOptions: SelectOption[] = useMemo(
    () =>
      workbook.worksheets.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [workbook.worksheets],
  );

  useEffect(() => {
    const firstWorksheet = workbook.worksheets[0];
    if (!firstWorksheet) return;
    const savedProfile = loadSpreadsheetMappingProfile(
      userId,
      MATERIAL_SPREADSHEET_ENTITY_KEY,
      fileName,
    );
    const savedWorksheet = savedProfile
      ? workbook.getWorksheet(savedProfile.worksheetName)
      : undefined;
    const initialWorksheet = savedWorksheet ?? firstWorksheet;
    const markerMapping = detectSpreadsheetMapping(initialWorksheet, fields);
    const profileMapping = resolveSpreadsheetMappingProfile(
      initialWorksheet,
      fields,
      savedProfile,
    );
    const initialMapping =
      markerMapping ??
      profileMapping ??
      suggestSpreadsheetMapping(initialWorksheet, fields, 1);
    setWorksheetName(initialWorksheet.name);
    setHeaderRow(initialMapping.headerRow);
    setDataStartRow(initialMapping.dataStartRow);
    setMapping(initialMapping);
    onMappingChange(initialMapping);
  }, [fields, fileName, onMappingChange, userId, workbook]);

  const persistMapping = (nextMapping: SpreadsheetMapping) => {
    setMapping(nextMapping);
    onMappingChange(nextMapping);
    const selectedWorksheet = workbook.getWorksheet(nextMapping.worksheetName);
    if (!selectedWorksheet) return;
    saveSpreadsheetMappingProfile(
      userId,
      MATERIAL_SPREADSHEET_ENTITY_KEY,
      makeSpreadsheetMappingProfile(
        fileName,
        nextMapping,
        getSpreadsheetHeaders(selectedWorksheet, nextMapping.headerRow),
        fields,
      ),
    );
  };

  const handleWorksheetChange = (value: string) => {
    const nextWorksheet = workbook.getWorksheet(value);
    if (!nextWorksheet) return;
    setWorksheetName(value);
    const markerMapping = detectSpreadsheetMapping(nextWorksheet, fields);
    const nextMapping =
      markerMapping ?? suggestSpreadsheetMapping(nextWorksheet, fields, 1);
    setHeaderRow(nextMapping.headerRow);
    setDataStartRow(nextMapping.dataStartRow);
    persistMapping(nextMapping);
  };

  const handleHeaderRowChange = (value: string) => {
    const nextHeaderRow = Math.max(1, Number(value) || 1);
    setHeaderRow(nextHeaderRow);
    if (!worksheet) return;
    if (mapping?.markerRow !== undefined) {
      persistMapping({ ...mapping, headerRow: nextHeaderRow });
      return;
    }
    const nextMapping = suggestSpreadsheetMapping(
      worksheet,
      fields,
      nextHeaderRow,
    );
    setDataStartRow(nextMapping.dataStartRow);
    persistMapping(nextMapping);
  };

  const handleDataStartRowChange = (value: string) => {
    if (mapping?.markerRow !== undefined) return;
    const nextDataStartRow = Math.max(
      headerRow + 1,
      Number(value) || headerRow + 1,
    );
    setDataStartRow(nextDataStartRow);
    if (mapping) persistMapping({ ...mapping, dataStartRow: nextDataStartRow });
  };

  const handleFieldColumnChange = (fieldKey: string, value: string) => {
    if (!mapping) return;
    const nextColumns = { ...mapping.columnByFieldKey };
    if (value) nextColumns[fieldKey] = Number(value);
    else delete nextColumns[fieldKey];
    persistMapping({ ...mapping, columnByFieldKey: nextColumns });
  };

  if (!worksheet || !mapping) return null;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {workbook.worksheets.length > 1 ? (
          <div className="space-y-1">
            <label
              className="text-sm font-medium"
              htmlFor="material-excel-sheet"
            >
              {intl.formatMessage({
                id: 'project.materials.spreadsheet.sheet',
              })}
            </label>
            <OptionSelect
              id="material-excel-sheet"
              options={worksheetOptions}
              value={worksheetName}
              onChange={handleWorksheetChange}
              searchable={false}
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <label
            className="text-sm font-medium"
            htmlFor="material-excel-header-row"
          >
            {intl.formatMessage({
              id: 'project.materials.spreadsheet.headerRow',
            })}
          </label>
          <Input
            id="material-excel-header-row"
            type="number"
            min={1}
            value={headerRow}
            onChange={(event) => handleHeaderRowChange(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-sm font-medium"
            htmlFor="material-excel-data-start-row"
          >
            {intl.formatMessage({
              id: 'project.materials.spreadsheet.dataStartRow',
            })}
          </label>
          <Input
            id="material-excel-data-start-row"
            type="number"
            min={headerRow + 1}
            value={dataStartRow}
            disabled={mapping.markerRow !== undefined}
            onChange={(event) => handleDataStartRowChange(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {intl.formatMessage({
          id: 'project.materials.spreadsheet.mappingHint',
        })}
      </p>
      <div className="max-h-64 overflow-y-auto rounded-md border border-border">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold">
          <span>
            {intl.formatMessage({ id: 'project.materials.spreadsheet.field' })}
          </span>
          <span>
            {intl.formatMessage({ id: 'project.materials.spreadsheet.column' })}
          </span>
        </div>
        {fields.map((field) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
            key={field.key}
          >
            <span className="min-w-0 truncate text-sm">
              {field.label}
              {field.required ? ' *' : ''}
            </span>
            <OptionSelect
              aria-label={`${intl.formatMessage({ id: 'project.materials.spreadsheet.column' })}: ${field.label}`}
              options={headerOptions}
              value={mapping.columnByFieldKey[field.key]?.toString() ?? ''}
              onChange={(value) => handleFieldColumnChange(field.key, value)}
              searchable
            />
          </div>
        ))}
      </div>
    </div>
  );
}
