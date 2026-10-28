export const SPREADSHEET_FIELD_MARKER = '__eps_field__:';
export const MAX_SPREADSHEET_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_SPREADSHEET_ROWS = 50_000;

export class SpreadsheetError extends Error {
  constructor(messageId: string) {
    super(messageId);
    this.name = 'SpreadsheetError';
  }
}

export type SpreadsheetValue = string | number | boolean | Date | null;

export interface SpreadsheetField<TRecord> {
  key: string;
  label: string;
  headerAliases?: string[];
  required?: boolean;
  read: (record: TRecord) => SpreadsheetValue;
}

export interface SpreadsheetHeader {
  column: number;
  label: string;
}

export interface SpreadsheetMapping {
  worksheetName: string;
  headerRow: number;
  dataStartRow: number;
  columnByFieldKey: Record<string, number>;
}

export interface SpreadsheetDataRow {
  rowNumber: number;
  values: Record<string, string>;
}

interface SpreadsheetCell {
  value: unknown;
  text?: string;
  numFmt?: string;
  font?: unknown;
  fill?: unknown;
  alignment?: unknown;
  style?: unknown;
}

interface SpreadsheetRow {
  hidden?: boolean;
  getCell: (column: number) => SpreadsheetCell;
  eachCell?: (
    options: { includeEmpty?: boolean },
    callback: (cell: SpreadsheetCell, column: number) => void,
  ) => void;
}

export interface SpreadsheetWorksheet {
  name: string;
  rowCount: number;
  getRow: (row: number) => SpreadsheetRow;
  getCell: (row: number, column: number) => SpreadsheetCell;
  addRow: (values: unknown[]) => SpreadsheetRow;
  columns?: Array<{ width?: number }>;
  views?: unknown[];
}

export interface SpreadsheetWorkbook {
  worksheets: SpreadsheetWorksheet[];
  xlsx: {
    load: (data: ArrayBuffer) => Promise<void>;
    writeBuffer: () => Promise<Uint8Array>;
  };
  addWorksheet: (name: string) => SpreadsheetWorksheet;
  getWorksheet: (name: string) => SpreadsheetWorksheet | undefined;
}

interface ExcelJsModule {
  Workbook: new () => SpreadsheetWorkbook;
}

export interface ExportWorkbookOptions<TRecord> {
  fields: SpreadsheetField<TRecord>[];
  records: TRecord[];
  fileName: string;
  worksheetName?: string;
  workbook?: SpreadsheetWorkbook;
  mapping?: SpreadsheetMapping;
}

async function createWorkbook(): Promise<SpreadsheetWorkbook> {
  const loadedModule = (await import('exceljs')) as unknown as {
    default?: ExcelJsModule;
    Workbook?: ExcelJsModule['Workbook'];
  };
  const excelJs = loadedModule.default ?? loadedModule;
  if (!excelJs.Workbook)
    throw new SpreadsheetError('common.spreadsheets.errors.unavailable');
  return new excelJs.Workbook();
}

export async function readXlsxFile(file: File): Promise<SpreadsheetWorkbook> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new SpreadsheetError('common.spreadsheets.errors.fileType');
  }
  if (file.size > MAX_SPREADSHEET_FILE_BYTES) {
    throw new SpreadsheetError('common.spreadsheets.errors.fileSize');
  }
  const workbook = await createWorkbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  if (workbook.worksheets.length === 0) {
    throw new SpreadsheetError('common.spreadsheets.errors.noWorksheets');
  }
  if (
    workbook.worksheets.some(
      (worksheet) => worksheet.rowCount > MAX_SPREADSHEET_ROWS,
    )
  ) {
    throw new SpreadsheetError('common.spreadsheets.errors.rowLimit');
  }
  return workbook;
}

export function getSpreadsheetHeaders(
  worksheet: SpreadsheetWorksheet,
  rowNumber: number,
): SpreadsheetHeader[] {
  const row = worksheet.getRow(rowNumber);
  const headers: SpreadsheetHeader[] = [];
  row.eachCell?.({ includeEmpty: false }, (cell, column) => {
    const label = cellToText(cell).trim();
    if (label) headers.push({ column, label });
  });
  return headers;
}

export function detectSpreadsheetMapping(
  worksheet: SpreadsheetWorksheet,
  fields: Array<{ key: string }>,
): SpreadsheetMapping | null {
  const mapping = detectMarkedSpreadsheetMapping(worksheet, fields);
  if (!mapping || Object.keys(mapping.columnByFieldKey).length < 2) return null;
  return mapping;
}

export function detectSpreadsheetExportMapping<TRecord>(
  workbook: Pick<SpreadsheetWorkbook, 'worksheets'>,
  fields: SpreadsheetField<TRecord>[],
): SpreadsheetMapping | null {
  let bestMapping: SpreadsheetMapping | null = null;
  let bestMatchCount = 0;

  for (const worksheet of workbook.worksheets) {
    const markedMapping = detectMarkedSpreadsheetMapping(worksheet, fields);
    if (markedMapping) {
      const headerMapping = suggestSpreadsheetMapping(
        worksheet,
        fields,
        markedMapping.headerRow,
      );
      return {
        ...markedMapping,
        columnByFieldKey: {
          ...headerMapping.columnByFieldKey,
          ...markedMapping.columnByFieldKey,
        },
      };
    }

    const searchRows = Math.min(worksheet.rowCount, 12);
    for (let headerRow = 1; headerRow <= searchRows; headerRow += 1) {
      const candidate = suggestSpreadsheetMapping(worksheet, fields, headerRow);
      const matchCount = Object.keys(candidate.columnByFieldKey).length;
      if (matchCount > bestMatchCount) {
        bestMapping = candidate;
        bestMatchCount = matchCount;
      }
    }
  }

  return bestMapping;
}

function detectMarkedSpreadsheetMapping(
  worksheet: SpreadsheetWorksheet,
  fields: Array<{ key: string }>,
): SpreadsheetMapping | null {
  const knownKeys = new Set(fields.map((field) => field.key));
  const searchRows = Math.min(worksheet.rowCount, 12);
  for (let rowNumber = 1; rowNumber <= searchRows; rowNumber += 1) {
    const columnByFieldKey: Record<string, number> = {};
    worksheet
      .getRow(rowNumber)
      .eachCell?.({ includeEmpty: false }, (cell, column) => {
        const marker = cellToText(cell).trim();
        if (!marker.startsWith(SPREADSHEET_FIELD_MARKER)) return;
        const fieldKey = marker.slice(SPREADSHEET_FIELD_MARKER.length);
        if (knownKeys.has(fieldKey)) columnByFieldKey[fieldKey] = column;
      });
    if (Object.keys(columnByFieldKey).length === 0) continue;
    const headerRow = rowNumber + 1;
    return {
      worksheetName: worksheet.name,
      headerRow,
      dataStartRow: headerRow + 1,
      columnByFieldKey,
    };
  }
  return null;
}

export function suggestSpreadsheetMapping<TRecord>(
  worksheet: SpreadsheetWorksheet,
  fields: SpreadsheetField<TRecord>[],
  headerRow: number,
): SpreadsheetMapping {
  const headers = getSpreadsheetHeaders(worksheet, headerRow);
  const normalizedHeaderColumns = new Map<string, number>();
  for (const header of headers) {
    const normalized = normalizeHeader(header.label);
    if (!normalizedHeaderColumns.has(normalized)) {
      normalizedHeaderColumns.set(normalized, header.column);
    }
  }
  const columnByFieldKey: Record<string, number> = {};
  for (const field of fields) {
    const headerCandidates = [field.label, ...(field.headerAliases ?? [])];
    for (const candidate of headerCandidates) {
      const column = normalizedHeaderColumns.get(normalizeHeader(candidate));
      if (!column) continue;
      columnByFieldKey[field.key] = column;
      break;
    }
  }
  return {
    worksheetName: worksheet.name,
    headerRow,
    dataStartRow: headerRow + 1,
    columnByFieldKey,
  };
}

export function readMappedRows(
  worksheet: SpreadsheetWorksheet,
  mapping: SpreadsheetMapping,
  fieldKeys: string[],
): SpreadsheetDataRow[] {
  const rows: SpreadsheetDataRow[] = [];
  for (
    let rowNumber = mapping.dataStartRow;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const values: Record<string, string> = {};
    let hasValue = false;
    for (const fieldKey of fieldKeys) {
      const column = mapping.columnByFieldKey[fieldKey];
      if (!column) continue;
      const value = cellToText(worksheet.getCell(rowNumber, column)).trim();
      values[fieldKey] = value;
      if (value) hasValue = true;
    }
    if (hasValue) rows.push({ rowNumber, values });
  }
  return rows;
}

export async function exportSpreadsheet<TRecord>({
  fields,
  records,
  fileName,
  worksheetName = 'Vật tư',
  workbook: providedWorkbook,
  mapping: providedMapping,
}: ExportWorkbookOptions<TRecord>): Promise<void> {
  const workbook = providedWorkbook ?? (await createWorkbook());
  const worksheet = providedMapping
    ? workbook.getWorksheet(providedMapping.worksheetName)
    : workbook.addWorksheet(worksheetName);
  if (!worksheet) {
    throw new SpreadsheetError('common.spreadsheets.errors.worksheetMissing');
  }

  const mapping = providedMapping ?? {
    worksheetName: worksheet.name,
    headerRow: 2,
    dataStartRow: 3,
    columnByFieldKey: Object.fromEntries(
      fields.map((field, index) => [field.key, index + 1]),
    ),
  };

  if (!providedMapping) {
    const markerRow = worksheet.getRow(1);
    markerRow.hidden = true;
    fields.forEach((field) => {
      worksheet.getCell(1, mapping.columnByFieldKey[field.key]).value =
        `${SPREADSHEET_FIELD_MARKER}${field.key}`;
    });
    fields.forEach((field) => {
      worksheet.getCell(
        mapping.headerRow,
        mapping.columnByFieldKey[field.key],
      ).value = field.label;
    });
    worksheet.columns = fields.map((field) => ({
      width: Math.min(Math.max(field.label.length + 4, 16), 36),
    }));
    const headerRow = worksheet.getRow(mapping.headerRow);
    headerRow.eachCell?.({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    worksheet.views = [{ state: 'frozen', ySplit: mapping.headerRow }];
  }

  const lastExistingRow = worksheet.rowCount;
  const sampleStyles = new Map<number, unknown>();
  if (providedMapping) {
    for (const field of fields) {
      const column = mapping.columnByFieldKey[field.key];
      const style = column
        ? worksheet.getCell(mapping.dataStartRow, column).style
        : undefined;
      if (column && style && typeof style === 'object') {
        sampleStyles.set(column, structuredClone(style));
      }
    }
  }
  const lastRowToClear = Math.max(
    lastExistingRow,
    mapping.dataStartRow + records.length - 1,
  );
  for (
    let rowNumber = mapping.dataStartRow;
    rowNumber <= lastRowToClear;
    rowNumber += 1
  ) {
    for (const field of fields) {
      const column = mapping.columnByFieldKey[field.key];
      if (!column) continue;
      const cell = worksheet.getCell(rowNumber, column);
      cell.value = null;
    }
  }

  records.forEach((record, index) => {
    const rowNumber = mapping.dataStartRow + index;
    for (const field of fields) {
      const column = mapping.columnByFieldKey[field.key];
      if (!column) continue;
      const cell = worksheet.getCell(rowNumber, column);
      if (providedMapping && rowNumber > mapping.dataStartRow) {
        const sampleStyle = sampleStyles.get(column);
        if (sampleStyle) cell.style = structuredClone(sampleStyle);
      }
      cell.value = field.read(record);
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = normalizeFileName(fileName);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cellToText(cell: SpreadsheetCell): string {
  const value = cell.value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && cell.text) return cell.text;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value && typeof value === 'object') {
    if ('result' in value) {
      const result = (value as { result?: unknown }).result;
      return result === null || result === undefined ? '' : String(result);
    }
    if (
      'text' in value &&
      typeof (value as { text?: unknown }).text === 'string'
    ) {
      return (value as { text: string }).text;
    }
    if (
      'richText' in value &&
      Array.isArray((value as { richText: unknown[] }).richText)
    ) {
      return (value as { richText: Array<{ text?: string }> }).richText
        .map((part) => part.text ?? '')
        .join('');
    }
  }
  return '';
}

function normalizeFileName(fileName: string): string {
  const safeName = fileName.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return safeName.toLowerCase().endsWith('.xlsx')
    ? safeName
    : `${safeName}.xlsx`;
}
