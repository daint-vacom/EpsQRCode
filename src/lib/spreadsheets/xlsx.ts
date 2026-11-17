import JSZip from 'jszip';

export const SPREADSHEET_FIELD_MARKER = '__eps_field__:';
export const MAX_SPREADSHEET_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_SPREADSHEET_ROWS = 50_000;
const SPREADSHEET_MAIN_NAMESPACE =
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

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
  markerAliases?: string[];
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
  markerRow?: number;
  dataStartRow: number;
  columnByFieldKey: Record<string, number>;
  rewriteMarkerRow?: boolean;
  rewriteHeaderLabels?: boolean;
  hiddenColumns?: number[];
  clearedRows?: number[];
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
  dataValidation?: unknown;
}

interface SpreadsheetRow {
  hidden?: boolean;
  height?: number;
  getCell: (column: number) => SpreadsheetCell;
  eachCell?: (
    options: { includeEmpty?: boolean },
    callback: (cell: SpreadsheetCell, column: number) => void,
  ) => void;
}

export interface SpreadsheetWorksheet {
  name: string;
  rowCount: number;
  state?: 'visible' | 'hidden' | 'veryHidden';
  getRow: (row: number) => SpreadsheetRow;
  eachRow?: (
    options: { includeEmpty?: boolean },
    callback: (row: SpreadsheetRow, rowNumber: number) => void,
  ) => void;
  getCell: (row: number, column: number) => SpreadsheetCell;
  addRow: (values: unknown[]) => SpreadsheetRow;
  columns?: Array<{ width?: number; hidden?: boolean }>;
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

async function normalizePrefixedSpreadsheetXml(
  data: ArrayBuffer,
): Promise<ArrayBuffer | null> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(data);
  } catch {
    return null;
  }

  let changed = false;
  const namespacePattern = new RegExp(
    `xmlns:([\\w.-]+)=["']${SPREADSHEET_MAIN_NAMESPACE}["']`,
  );
  const defaultNamespacePattern = new RegExp(
    `xmlns=["']${SPREADSHEET_MAIN_NAMESPACE}["']`,
  );

  await Promise.all(
    Object.values(archive.files).map(async (entry) => {
      if (entry.dir || !/\.(xml|rels)$/i.test(entry.name)) return;

      const contents = await entry.async('string');
      const namespaceMatch = contents.match(namespacePattern);
      if (!namespaceMatch) return;

      const prefix = namespaceMatch[1];
      let normalized = contents;
      if (!defaultNamespacePattern.test(normalized)) {
        normalized = normalized.replace(
          namespaceMatch[0],
          `xmlns="${SPREADSHEET_MAIN_NAMESPACE}" ${namespaceMatch[0]}`,
        );
      }
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      normalized = normalized.replace(
        new RegExp(`(<\\/?\\s*)${escapedPrefix}:`, 'g'),
        '$1',
      );

      if (normalized !== contents) {
        archive.file(entry.name, normalized);
        changed = true;
      }
    }),
  );

  if (!changed) return null;
  const bytes = await archive.generateAsync({ type: 'uint8array' });
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function loadSpreadsheetWorkbook(
  data: ArrayBuffer,
): Promise<SpreadsheetWorkbook> {
  const workbook = await createWorkbook();
  try {
    await workbook.xlsx.load(data);
    return workbook;
  } catch {
    const normalized = await normalizePrefixedSpreadsheetXml(data);
    if (!normalized) {
      throw new SpreadsheetError('common.spreadsheets.errors.invalidFile');
    }

    const normalizedWorkbook = await createWorkbook();
    try {
      await normalizedWorkbook.xlsx.load(normalized);
    } catch {
      throw new SpreadsheetError('common.spreadsheets.errors.invalidFile');
    }
    return normalizedWorkbook;
  }
}

export async function cloneSpreadsheetWorkbook(
  workbook: SpreadsheetWorkbook,
): Promise<SpreadsheetWorkbook> {
  const serialized = await workbook.xlsx.writeBuffer();
  const data = new Uint8Array(serialized.byteLength);
  data.set(serialized);
  const clone = await createWorkbook();
  await clone.xlsx.load(data.buffer as ArrayBuffer);
  return clone;
}

export async function readXlsxFile(file: File): Promise<SpreadsheetWorkbook> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new SpreadsheetError('common.spreadsheets.errors.fileType');
  }
  if (file.size > MAX_SPREADSHEET_FILE_BYTES) {
    throw new SpreadsheetError('common.spreadsheets.errors.fileSize');
  }
  const workbook = await loadSpreadsheetWorkbook(await file.arrayBuffer());
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
  validateSpreadsheetMarkerRows(workbook);
  upgradeLegacyMarkerLayouts(workbook);
  return workbook;
}

function validateSpreadsheetMarkerRows(workbook: SpreadsheetWorkbook) {
  for (const worksheet of workbook.worksheets) {
    if (isSpreadsheetFieldCatalogWorksheet(worksheet)) continue;

    let markerRow: number | undefined;
    let hasMarkersInMultipleRows = false;

    forEachWorksheetRow(worksheet, (row, rowNumber) => {
      row.eachCell?.({ includeEmpty: false }, (cell) => {
        if (!cellToText(cell).trim().startsWith(SPREADSHEET_FIELD_MARKER)) {
          return;
        }
        if (markerRow === undefined) {
          markerRow = rowNumber;
        } else if (markerRow !== rowNumber) {
          hasMarkersInMultipleRows = true;
        }
      });
    });

    if (hasMarkersInMultipleRows) {
      throw new SpreadsheetError(
        'common.spreadsheets.errors.markersMustShareRow',
      );
    }
  }
}

function isSpreadsheetFieldCatalogWorksheet(worksheet: SpreadsheetWorksheet) {
  const normalizedName = normalizeHeader(worksheet.name).replace(
    /\s*-\s*hide\s*$/i,
    '',
  );
  return normalizedName === normalizeHeader('Trường dữ liệu');
}

function upgradeLegacyMarkerLayouts(workbook: SpreadsheetWorkbook) {
  for (const worksheet of workbook.worksheets) {
    const legacyMarkerRow = worksheet.getRow(1);
    const markers: Array<{ column: number; value: unknown }> = [];
    legacyMarkerRow.eachCell?.({ includeEmpty: false }, (cell, column) => {
      if (cellToText(cell).trim().startsWith(SPREADSHEET_FIELD_MARKER)) {
        markers.push({ column, value: cell.value });
      }
    });
    if (markers.length === 0) continue;

    const headerRow = worksheet.getRow(2);
    const dataSampleRow = worksheet.getRow(3);
    const headingsByColumn = new Map(
      markers.map(({ column }) => {
        const cell = headerRow.getCell(column);
        return [
          column,
          {
            value: cell.value,
            style:
              cell.style && typeof cell.style === 'object'
                ? structuredClone(cell.style)
                : undefined,
          },
        ];
      }),
    );
    headerRow.eachCell?.({ includeEmpty: true }, (cell, column) => {
      const targetCell = legacyMarkerRow.getCell(column);
      targetCell.value = cell.value;
      if (cell.style && typeof cell.style === 'object') {
        targetCell.style = structuredClone(cell.style);
      }
      cell.value = null;
    });

    for (const marker of markers) {
      const heading = headingsByColumn.get(marker.column);
      const headingCell = legacyMarkerRow.getCell(marker.column);
      headingCell.value = heading?.value;
      if (heading?.style) headingCell.style = heading.style;

      const markerCell = headerRow.getCell(marker.column);
      markerCell.value = marker.value;
      const sampleStyle = dataSampleRow.getCell(marker.column).style;
      if (sampleStyle && typeof sampleStyle === 'object') {
        markerCell.style = structuredClone(sampleStyle);
      }
    }

    legacyMarkerRow.hidden = false;
    headerRow.hidden = false;
    legacyMarkerRow.height = headerRow.height;
    headerRow.height = dataSampleRow.height;
  }
}

function forEachWorksheetRow(
  worksheet: SpreadsheetWorksheet,
  callback: (row: SpreadsheetRow, rowNumber: number) => void,
) {
  if (worksheet.eachRow) {
    worksheet.eachRow({ includeEmpty: false }, callback);
    return;
  }

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    callback(worksheet.getRow(rowNumber), rowNumber);
  }
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
  fields: Array<{ key: string; markerAliases?: string[] }>,
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
    if (isSpreadsheetFieldCatalogWorksheet(worksheet)) continue;

    const markedMapping = detectMarkedSpreadsheetMapping(worksheet, fields);
    if (markedMapping) {
      return markedMapping;
    }

    forEachWorksheetRow(worksheet, (_row, headerRow) => {
      const candidate = suggestSpreadsheetMapping(worksheet, fields, headerRow);
      const matchCount = Object.keys(candidate.columnByFieldKey).length;
      if (matchCount > bestMatchCount) {
        bestMapping = candidate;
        bestMatchCount = matchCount;
      }
    });
  }

  return bestMapping;
}

function detectMarkedSpreadsheetMapping(
  worksheet: SpreadsheetWorksheet,
  fields: Array<{ key: string; markerAliases?: string[] }>,
): SpreadsheetMapping | null {
  const fieldKeyByMarker = new Map<string, string>();
  for (const field of fields) {
    fieldKeyByMarker.set(field.key, field.key);
    for (const alias of field.markerAliases ?? []) {
      fieldKeyByMarker.set(alias, field.key);
    }
  }
  let mapping: SpreadsheetMapping | null = null;
  forEachWorksheetRow(worksheet, (row, rowNumber) => {
    if (mapping) return;
    const columnByFieldKey: Record<string, number> = {};
    row.eachCell?.({ includeEmpty: false }, (cell, column) => {
      const marker = cellToText(cell).trim();
      if (!marker.startsWith(SPREADSHEET_FIELD_MARKER)) return;
      const markerKey = marker.slice(SPREADSHEET_FIELD_MARKER.length);
      const fieldKey = fieldKeyByMarker.get(markerKey);
      if (fieldKey) columnByFieldKey[fieldKey] = column;
    });
    if (Object.keys(columnByFieldKey).length === 0) return;
    mapping = {
      worksheetName: worksheet.name,
      headerRow: Math.max(1, rowNumber - 1),
      markerRow: rowNumber,
      dataStartRow: rowNumber + 1,
      columnByFieldKey,
    };
  });
  return mapping;
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
  const workbook = providedWorkbook
    ? await cloneSpreadsheetWorkbook(providedWorkbook)
    : await createWorkbook();
  const worksheet = providedMapping
    ? workbook.getWorksheet(providedMapping.worksheetName)
    : workbook.addWorksheet(worksheetName);
  if (!worksheet) {
    throw new SpreadsheetError('common.spreadsheets.errors.worksheetMissing');
  }

  const mapping = providedMapping ?? {
    worksheetName: worksheet.name,
    headerRow: 1,
    markerRow: 2,
    dataStartRow: 3,
    columnByFieldKey: Object.fromEntries(
      fields.map((field, index) => [field.key, index + 1]),
    ),
  };

  if (providedMapping) {
    for (const column of mapping.hiddenColumns ?? []) {
      const existingColumn = worksheet.columns?.[column - 1] ?? {};
      if (worksheet.columns) {
        worksheet.columns[column - 1] = { ...existingColumn, hidden: true };
      }
      worksheet.getCell(mapping.headerRow, column).value = null;
      if (mapping.markerRow !== undefined) {
        worksheet.getCell(mapping.markerRow, column).value = null;
      }
    }

    if (mapping.markerRow !== undefined && mapping.rewriteMarkerRow) {
      const markerRow = worksheet.getRow(mapping.markerRow);
      markerRow.eachCell?.({ includeEmpty: false }, (cell) => {
        if (cellToText(cell).trim().startsWith(SPREADSHEET_FIELD_MARKER)) {
          cell.value = null;
        }
      });
      for (const field of fields) {
        const column = mapping.columnByFieldKey[field.key];
        if (!column) continue;
        markerRow.getCell(column).value =
          `${SPREADSHEET_FIELD_MARKER}${field.key}`;
        if (mapping.rewriteHeaderLabels) {
          worksheet.getCell(mapping.headerRow, column).value = field.label;
        }
      }
    }

    for (const rowNumber of mapping.clearedRows ?? []) {
      const row = worksheet.getRow(rowNumber);
      row.eachCell?.({ includeEmpty: false }, (cell) => {
        cell.value = null;
      });
      row.hidden = true;
    }
  }

  if (!providedMapping) {
    const markerRow = worksheet.getRow(mapping.markerRow ?? 2);
    fields.forEach((field) => {
      markerRow.getCell(mapping.columnByFieldKey[field.key]).value =
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
  const sampleValidations = new Map<number, unknown>();
  let sampleRowHeight: number | undefined;
  if (providedMapping) {
    const sampleRow =
      mapping.markerRow === undefined
        ? mapping.dataStartRow
        : mapping.markerRow + 1;
    const fallbackStyleRow = mapping.markerRow ?? mapping.dataStartRow;
    const sampleHeight = worksheet.getRow(sampleRow).height;
    const fallbackHeight = worksheet.getRow(fallbackStyleRow).height;
    sampleRowHeight =
      typeof sampleHeight === 'number' && sampleHeight > 0
        ? sampleHeight
        : fallbackHeight;
    for (const field of fields) {
      const column = mapping.columnByFieldKey[field.key];
      if (!column) continue;

      const sampleStyle = worksheet.getCell(sampleRow, column).style;
      const hasSampleStyle =
        sampleStyle &&
        typeof sampleStyle === 'object' &&
        Object.keys(sampleStyle).length > 0;
      const fallbackStyle = worksheet.getCell(fallbackStyleRow, column).style;
      const style = hasSampleStyle ? sampleStyle : fallbackStyle;
      if (style && typeof style === 'object' && Object.keys(style).length > 0) {
        sampleStyles.set(column, structuredClone(style));
      }

      const dataValidation = worksheet.getCell(
        sampleRow,
        column,
      ).dataValidation;
      if (dataValidation && typeof dataValidation === 'object') {
        sampleValidations.set(column, structuredClone(dataValidation));
      }
    }
  }
  const firstOutputAreaRow =
    mapping.markerRow === undefined
      ? mapping.dataStartRow
      : mapping.markerRow + 1;
  const lastRowToClear = Math.max(
    lastExistingRow,
    mapping.dataStartRow + records.length - 1,
  );
  for (
    let rowNumber = firstOutputAreaRow;
    rowNumber <= lastRowToClear;
    rowNumber += 1
  ) {
    for (const column of mapping.hiddenColumns ?? []) {
      worksheet.getCell(rowNumber, column).value = null;
    }
    for (const field of fields) {
      const column = mapping.columnByFieldKey[field.key];
      if (!column) continue;
      const cell = worksheet.getCell(rowNumber, column);
      cell.value = null;
    }
  }

  records.forEach((record, index) => {
    const rowNumber = mapping.dataStartRow + index;
    if (sampleRowHeight) worksheet.getRow(rowNumber).height = sampleRowHeight;
    for (const field of fields) {
      const column = mapping.columnByFieldKey[field.key];
      if (!column) continue;
      const cell = worksheet.getCell(rowNumber, column);
      if (
        providedMapping &&
        (mapping.markerRow !== undefined || rowNumber > mapping.dataStartRow)
      ) {
        const sampleStyle = sampleStyles.get(column);
        if (sampleStyle) cell.style = structuredClone(sampleStyle);
        const sampleValidation = sampleValidations.get(column);
        if (sampleValidation) {
          cell.dataValidation = structuredClone(sampleValidation);
        }
      }
      cell.value = field.read(record);
    }
  });

  if (mapping.markerRow !== undefined) {
    worksheet.getRow(mapping.markerRow).hidden = true;
  }

  for (const sheet of workbook.worksheets) {
    if (/\s*-\s*HIDE$/i.test(sheet.name.trim())) {
      sheet.state = 'hidden';
    }
  }
  if (
    !workbook.worksheets.some(
      (sheet) => sheet.state !== 'hidden' && sheet.state !== 'veryHidden',
    )
  ) {
    worksheet.state = 'visible';
  }

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
