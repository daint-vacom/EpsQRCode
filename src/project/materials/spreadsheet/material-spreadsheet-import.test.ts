import { describe, expect, it } from 'vitest';
import type {
  SpreadsheetDataRow,
  SpreadsheetMapping,
  SpreadsheetWorkbook,
  SpreadsheetWorksheet,
} from '@/lib/spreadsheets/xlsx';
import { readMaterialImportLinkedCodes } from './material-spreadsheet-import';

function makeWorksheet(name: string, values: string[][]): SpreadsheetWorksheet {
  const cell = (value: string) => ({ value, text: value });
  return {
    name,
    rowCount: values.length,
    getCell: (row, column) => cell(values[row - 1]?.[column - 1] ?? ''),
    getRow: (row) => ({
      getCell: (column) => cell(values[row - 1]?.[column - 1] ?? ''),
      eachCell: (_options, callback) => {
        values[row - 1]?.forEach((value, index) =>
          callback(cell(value), index + 1),
        );
      },
    }),
    eachRow: (_options, callback) => {
      values.forEach((row, index) =>
        callback(
          {
            getCell: (column) => cell(row[column - 1] ?? ''),
            eachCell: (_rowOptions, cellCallback) =>
              row.forEach((value, column) =>
                cellCallback(cell(value), column + 1),
              ),
          },
          index + 1,
        ),
      );
    },
    addRow: () => ({ getCell: () => cell('') }),
  };
}

describe('readMaterialImportLinkedCodes', () => {
  it('routes configured values to model and material scopes with their labels', () => {
    const dataSheet = makeWorksheet('TSCĐ (2)', [
      ['Mã vật tư', 'Mã mẫu', 'Số thẻ', 'Mã số TSCĐ'],
      ['MAT-01', 'MODEL-01', 'CARD-01', 'ASSET-01'],
    ]);
    const configSheet = makeWorksheet('Cấu hình mã liên kết', [
      ['CẤU HÌNH MÃ LIÊN KẾT NGOÀI'],
      [],
      ['Sheet dữ liệu', 'Cột dữ liệu', 'Phạm vi lưu', 'Nhãn mã liên kết'],
      ['TSCĐ (2)', 'Số thẻ', 'Vật tư', 'Số thẻ'],
      ['TSCĐ (2)', 'Mã số TSCĐ', 'Vật tư', 'Mã số TSCĐ'],
      ['TSCĐ (2)', 'Mã mẫu', 'Mẫu vật tư', 'Mã mẫu ngoài'],
    ]);
    const workbook = {
      worksheets: [dataSheet, configSheet],
      getWorksheet: (name) =>
        [dataSheet, configSheet].find((item) => item.name === name),
    } as SpreadsheetWorkbook;
    const mapping: SpreadsheetMapping = {
      worksheetName: 'TSCĐ (2)',
      headerRow: 1,
      dataStartRow: 2,
      columnByFieldKey: {},
    };
    const rows: SpreadsheetDataRow[] = [{ rowNumber: 2, values: {} }];

    const result = readMaterialImportLinkedCodes(
      workbook,
      mapping,
      rows,
      (id) => id,
    );

    expect(result.errors).toEqual([]);
    expect(JSON.parse(result.rows[0]!.values.__linkedMaterialCodes!)).toEqual([
      { label: 'Số thẻ', value: 'CARD-01' },
      { label: 'Mã số TSCĐ', value: 'ASSET-01' },
    ]);
    expect(JSON.parse(result.rows[0]!.values.__linkedModelCodes!)).toEqual([
      { label: 'Mã mẫu ngoài', value: 'MODEL-01' },
    ]);
  });
});
