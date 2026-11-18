import {
  normalizeHeader,
  SPREADSHEET_FIELD_MARKER,
  type SpreadsheetField,
  type SpreadsheetWorkbook,
} from '@/lib/spreadsheets/xlsx';
import type { Material } from '../model/material';
import { MATERIAL_GROUPING_CONFIG_SHEET_NAME } from './material-spreadsheet-grouping';
import { findMaterialImportMapping } from './material-spreadsheet-import';

const IMPORT_GUIDANCE = [
  'project.materials.spreadsheet.importGuide.purpose',
  'project.materials.spreadsheet.importGuide.tabs',
  'project.materials.spreadsheet.importGuide.layout',
  'project.materials.spreadsheet.importGuide.quantity',
  'project.materials.spreadsheet.importGuide.codes',
  'project.materials.spreadsheet.importGuide.serial',
  'project.materials.spreadsheet.importGuide.example',
];

export function prepareMaterialImportTemplate(
  workbook: SpreadsheetWorkbook,
  fields: SpreadsheetField<Material>[],
  translate: (id: string) => string,
) {
  const groupingName = normalizeHeader(MATERIAL_GROUPING_CONFIG_SHEET_NAME);
  for (const worksheet of [...workbook.worksheets]) {
    const baseName = normalizeHeader(worksheet.name).replace(
      /\s*-\s*hide\s*$/i,
      '',
    );
    if (baseName !== groupingName) continue;

    const mutableWorkbook = workbook as SpreadsheetWorkbook & {
      removeWorksheet: (id: number) => void;
    };
    const worksheetId = (worksheet as typeof worksheet & { id: number }).id;
    mutableWorkbook.removeWorksheet(worksheetId);
  }

  const mapping = findMaterialImportMapping(workbook, fields);
  for (const worksheet of workbook.worksheets) {
    const normalizedName = normalizeHeader(worksheet.name);
    if (
      normalizedName === normalizeHeader('Trường dữ liệu - HIDE') ||
      normalizedName === normalizeHeader('Hướng dẫn - HIDE')
    ) {
      worksheet.name = worksheet.name.replace(/\s*-\s*hide\s*$/i, '');
    }
  }
  const quantityField = fields.find(
    (field) => field.key === 'material.quantity',
  );
  if (mapping && quantityField) {
    const worksheet = workbook.getWorksheet(mapping.worksheetName);
    if (worksheet && mapping.columnByFieldKey[quantityField.key]) {
      const mutableWorksheet = worksheet as typeof worksheet & {
        getColumn: (column: number) => { hidden: boolean };
      };
      mutableWorksheet.getColumn(
        mapping.columnByFieldKey[quantityField.key]!,
      ).hidden = false;
    } else if (worksheet) {
      const nextColumn =
        Math.max(0, ...Object.values(mapping.columnByFieldKey)) + 1;
      worksheet.getCell(mapping.headerRow, nextColumn).value =
        quantityField.label;
      const mutableWorksheet = worksheet as typeof worksheet & {
        getColumn: (column: number) => { hidden: boolean };
      };
      mutableWorksheet.getColumn(nextColumn).hidden = false;
      if (mapping.markerRow !== undefined) {
        worksheet.getCell(mapping.markerRow, nextColumn).value =
          `${SPREADSHEET_FIELD_MARKER}${quantityField.key}`;
      }
    }
  }
  if (mapping?.markerRow !== undefined) {
    const mappingWorksheet = workbook.getWorksheet(mapping.worksheetName);
    if (mappingWorksheet) {
      mappingWorksheet.getRow(mapping.markerRow).hidden = true;
    }
  }

  const guide =
    workbook.worksheets.find(
      (worksheet) =>
        normalizeHeader(worksheet.name).replace(/\s*-\s*hide\s*$/i, '') ===
        normalizeHeader('Hướng dẫn'),
    ) ?? workbook.addWorksheet('Hướng dẫn');
  for (let row = IMPORT_GUIDANCE.length + 2; row <= guide.rowCount; row += 1) {
    guide.getRow(row).eachCell?.({ includeEmpty: true }, (cell) => {
      cell.value = null;
    });
  }
  guide.getCell(1, 1).value = translate(
    'project.materials.spreadsheet.importGuide.section',
  );
  guide.getCell(1, 2).value = translate(
    'project.materials.spreadsheet.importGuide.detail',
  );
  IMPORT_GUIDANCE.forEach((messageId, index) => {
    const row = index + 2;
    guide.getCell(row, 1).value = translate(
      `project.materials.spreadsheet.importGuide.heading${index + 1}`,
    );
    guide.getCell(row, 2).value = translate(messageId);
    guide.getRow(row).height = 54;
  });
  guide.name = 'Hướng dẫn';
}
