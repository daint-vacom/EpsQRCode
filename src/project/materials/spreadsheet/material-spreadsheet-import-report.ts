import JSZip from 'jszip';
import {
  cloneSpreadsheetWorkbook,
  type SpreadsheetWorkbook,
  type SpreadsheetWorksheet,
} from '@/lib/spreadsheets/xlsx';
import type { MaterialSpreadsheetSource } from './material-spreadsheet-import';

export interface MaterialImportOutcome {
  id: string;
  sourceId: string;
  rowNumber: number;
  code: string;
  success: boolean;
  error: string;
}

export interface MaterialImportReportResult {
  blob: Blob;
  fileName: string;
}

const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function createMaterialImportReport(
  sources: MaterialSpreadsheetSource[],
  outcomes: MaterialImportOutcome[],
  onlyErrors: boolean,
  translate: (id: string) => string,
): Promise<MaterialImportReportResult> {
  const outcomesBySource = new Map<string, MaterialImportOutcome[]>();
  for (const outcome of outcomes) {
    const current = outcomesBySource.get(outcome.sourceId) ?? [];
    current.push(outcome);
    outcomesBySource.set(outcome.sourceId, current);
  }

  const selectedSources = sources.filter((source) => {
    if (!onlyErrors) return true;
    return (
      source.globalErrors.length > 0 ||
      (outcomesBySource.get(source.id) ?? []).some(
        (outcome) => !outcome.success,
      )
    );
  });
  const files: Array<{ name: string; blob: Blob }> = [];
  const unparsedSources: MaterialSpreadsheetSource[] = [];

  for (const source of selectedSources) {
    if (!source.workbook) {
      unparsedSources.push(source);
      continue;
    }
    const workbook = await createSourceResultWorkbook(
      source,
      outcomesBySource.get(source.id) ?? [],
      onlyErrors,
      translate('project.materials.spreadsheet.resultColumn'),
      translate('project.materials.spreadsheet.globalErrorsSheet'),
    );
    files.push({
      name: resultFileName(source.file.name, onlyErrors),
      blob: await workbookToBlob(workbook),
    });
  }

  if (unparsedSources.length > 0) {
    for (const source of unparsedSources) {
      files.push({
        name: source.file.name,
        blob: source.file,
      });
    }
    const globalErrors = unparsedSources.flatMap((source) =>
      source.globalErrors.map((error) => ({
        fileName: source.file.name,
        error,
      })),
    );
    if (globalErrors.length > 0) {
      const errorWorkbook = await createGlobalErrorsWorkbook(
        globalErrors,
        translate('project.materials.spreadsheet.globalErrorsSheet'),
      );
      files.push({
        name: 'loi-chung.xlsx',
        blob: await workbookToBlob(errorWorkbook),
      });
    }
  }

  if (files.length === 0) {
    throw new Error('Không có tệp kết quả để tải xuống.');
  }

  if (files.length === 1 && sources.length === 1) {
    return { blob: files[0].blob, fileName: files[0].name };
  }

  const zip = new JSZip();
  const uniqueNames = new Set<string>();
  for (const file of files) {
    const uniqueName = makeUniqueFileName(file.name, uniqueNames);
    zip.file(uniqueName, file.blob);
  }
  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    fileName: onlyErrors ? 'vat-tu-ket-qua-loi.zip' : 'vat-tu-ket-qua.zip',
  };
}

async function createSourceResultWorkbook(
  source: MaterialSpreadsheetSource,
  outcomes: MaterialImportOutcome[],
  onlyErrors: boolean,
  resultLabel: string,
  errorSheetLabel: string,
): Promise<SpreadsheetWorkbook> {
  const workbook = await cloneSpreadsheetWorkbook(source.workbook!);
  if (source.mapping) {
    const worksheet = workbook.getWorksheet(source.mapping.worksheetName);
    if (worksheet) {
      writeOutcomeColumn(worksheet, source, outcomes, resultLabel);
      if (onlyErrors) retainOnlyErrorRows(worksheet, source, outcomes);
    }
  }

  if (source.globalErrors.length > 0) {
    addGlobalErrorsWorksheet(
      workbook,
      source.file.name,
      source.globalErrors,
      errorSheetLabel,
    );
  }
  return workbook;
}

function writeOutcomeColumn(
  worksheet: SpreadsheetWorksheet,
  source: MaterialSpreadsheetSource,
  outcomes: MaterialImportOutcome[],
  resultLabel: string,
) {
  const mapping = source.mapping;
  if (!mapping) return;
  let columnCount = worksheet.columns?.length ?? 0;
  worksheet.eachRow?.({ includeEmpty: false }, (row) => {
    row.eachCell?.({ includeEmpty: false }, (_cell, column) => {
      columnCount = Math.max(columnCount, column);
    });
  });
  const resultColumn = columnCount + 1;
  const headerCell = worksheet.getCell(mapping.headerRow, resultColumn);
  const previousHeader = worksheet.getCell(mapping.headerRow, resultColumn - 1);
  if (previousHeader.style && typeof previousHeader.style === 'object') {
    headerCell.style = structuredClone(previousHeader.style);
  }
  headerCell.value = resultLabel;
  if (mapping.markerRow !== undefined) {
    worksheet.getCell(mapping.markerRow, resultColumn).value = null;
  }
  if (worksheet.columns) worksheet.columns[resultColumn - 1] = { width: 34 };

  const outcomeByRow = new Map(
    outcomes.map((outcome) => [outcome.rowNumber, outcome]),
  );
  for (const row of source.rows) {
    const outcome = outcomeByRow.get(row.rowNumber);
    if (!outcome) continue;
    const resultCell = worksheet.getCell(row.rowNumber, resultColumn);
    resultCell.value = outcome.success ? '' : outcome.error;
    if (outcome.success) {
      for (let column = 1; column <= resultColumn; column += 1) {
        worksheet.getCell(row.rowNumber, column).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2F0D9' },
        };
      }
    } else {
      resultCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFCE8E6' },
      };
      resultCell.font = {
        ...(resultCell.font && typeof resultCell.font === 'object'
          ? resultCell.font
          : {}),
        color: { argb: 'FFB42318' },
      };
      resultCell.alignment = { vertical: 'top', wrapText: true };
    }
  }
}

function retainOnlyErrorRows(
  worksheet: SpreadsheetWorksheet,
  source: MaterialSpreadsheetSource,
  outcomes: MaterialImportOutcome[],
) {
  const mapping = source.mapping;
  if (!mapping) return;
  const failedRows = new Set(
    outcomes
      .filter((outcome) => !outcome.success)
      .map((outcome) => outcome.rowNumber),
  );
  const dataRows = new Set(source.rows.map((row) => row.rowNumber));
  const mutableWorksheet = worksheet as SpreadsheetWorksheet & {
    spliceRows: (start: number, count: number) => unknown;
  };
  for (
    let rowNumber = worksheet.rowCount;
    rowNumber >= mapping.dataStartRow;
    rowNumber -= 1
  ) {
    if (dataRows.has(rowNumber) && failedRows.has(rowNumber)) continue;
    mutableWorksheet.spliceRows(rowNumber, 1);
  }
}

function addGlobalErrorsWorksheet(
  workbook: SpreadsheetWorkbook,
  fileName: string,
  errors: string[],
  requestedName: string,
) {
  const worksheet = workbook.addWorksheet(
    uniqueWorksheetName(workbook, requestedName),
  );
  worksheet.addRow(['Tệp Excel', 'Lỗi']);
  errors.forEach((error) => worksheet.addRow([fileName, error]));
  worksheet.getCell(1, 1).font = { bold: true };
  worksheet.getCell(1, 2).font = { bold: true };
  if (worksheet.columns) {
    worksheet.columns = [{ width: 36 }, { width: 80 }];
  }
}

async function createGlobalErrorsWorkbook(
  errors: Array<{ fileName: string; error: string }>,
  worksheetName: string,
): Promise<SpreadsheetWorkbook> {
  const loadedModule = (await import('exceljs')) as unknown as {
    default?: { Workbook: new () => SpreadsheetWorkbook };
    Workbook?: new () => SpreadsheetWorkbook;
  };
  const excelJs = loadedModule.default ?? loadedModule;
  if (!excelJs.Workbook) throw new Error('Không thể tạo tệp Excel báo lỗi.');
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);
  worksheet.addRow(['Tệp Excel', 'Lỗi']);
  errors.forEach((item) => worksheet.addRow([item.fileName, item.error]));
  worksheet.getCell(1, 1).font = { bold: true };
  worksheet.getCell(1, 2).font = { bold: true };
  if (worksheet.columns) worksheet.columns = [{ width: 36 }, { width: 80 }];
  return workbook;
}

function uniqueWorksheetName(workbook: SpreadsheetWorkbook, baseName: string) {
  let name = baseName.slice(0, 31);
  let suffix = 2;
  while (workbook.getWorksheet(name)) {
    const tail = ` ${suffix}`;
    name = `${baseName.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  return name;
}

function resultFileName(sourceName: string, onlyErrors: boolean) {
  const stem = sourceName.replace(/\.xlsx$/i, '');
  return `${stem}_${onlyErrors ? 'ket-qua-loi' : 'ket-qua'}.xlsx`;
}

function makeUniqueFileName(name: string, used: Set<string>) {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';
  let next = name;
  let suffix = 2;
  while (used.has(next.toLowerCase())) {
    next = `${stem} (${suffix})${extension}`;
    suffix += 1;
  }
  used.add(next.toLowerCase());
  return next;
}

async function workbookToBlob(workbook: SpreadsheetWorkbook) {
  const bytes = await workbook.xlsx.writeBuffer();
  return new Blob([bytes], { type: XLSX_MIME_TYPE });
}
