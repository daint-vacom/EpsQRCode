import type { Custodian } from '@/project/custodians/model/custodian';
import type { MaterialModel } from '@/project/material-models/model/material-model';
import { describe, expect, it } from 'vitest';
import type {
  SpreadsheetDataRow,
  SpreadsheetMapping,
  SpreadsheetWorkbook,
  SpreadsheetWorksheet,
} from '@/lib/spreadsheets/xlsx';
import {
  mapMaterialSpreadsheetRows,
  readMaterialImportLinkedCodes,
  toMaterialImportPreviewRows,
  type MaterialSpreadsheetSource,
} from './material-spreadsheet-import';

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

describe('receipt Excel mapping', () => {
  const model: MaterialModel = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'MODEL-01',
    name: 'Mẫu vật tư',
    groupId: null,
    manufacturer: '',
    unit: 'cái',
    unitPriceDefault: null,
    images: [],
    imageUrl: null,
    description: '',
    externalCodes: [],
    linkedCodes: [],
    requiresInspection: false,
    hasActiveSafetyInspection: false,
    inspectionIntervalValue: 1,
    inspectionIntervalUnit: 'month',
    skipInitialInspection: false,
    useGroupSafetyInspectionChecklist: false,
    specifications: [],
    publicDisplaySettings: { basicInfo: false, specifications: false },
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
  const recipient: Custodian = {
    id: '22222222-2222-4222-8222-222222222222',
    type: 'department',
    code: 'UNIT-01',
    name: 'Đơn vị nhận',
    parentId: null,
    sourceType: 'eps_department',
    sourceId: 'unit-01',
    canRepresent: false,
    canManageMaterial: false,
    accountUserId: null,
    accountUserIds: [],
    representativeUserId: null,
    representativeDisplayName: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };

  function mapRows(values: Array<Record<string, string>>) {
    const source: MaterialSpreadsheetSource = {
      id: 'receipt-import',
      file: new File([], 'receipt.xlsx'),
      status: 'success',
      workbook: null,
      worksheetName: null,
      mapping: null,
      rows: values.map((fields, index) => ({
        rowNumber: index + 2,
        values: { 'material.model.code': model.code, ...fields },
      })),
      globalErrors: [],
    };
    return mapMaterialSpreadsheetRows(
      [source],
      [model],
      [recipient],
      [],
      (id) => id,
      [],
      [],
      'receipt',
    );
  }

  it('accepts warehouse-only lines and resolves an unrelated receiving unit', () => {
    const [warehouse, assigned, unknown] = mapRows([
      { 'material.code': 'MAT-01', 'material.nameOverride': 'Tên từ Excel' },
      { 'material.code': 'MAT-02', 'material.owner.code': recipient.code },
      { 'material.code': 'MAT-03', 'material.owner.code': 'UNKNOWN-UNIT' },
    ]);

    expect(warehouse?.values).toMatchObject({
      nameOverride: 'Tên từ Excel',
      ownerPartyId: '',
    });
    expect(assigned?.values?.ownerPartyId).toBe(recipient.id);
    expect(unknown).toMatchObject({
      values: null,
      error: 'project.materials.spreadsheet.errors.ownerNotFound',
    });
  });

  it('displays the exact representative code for a multi-item receipt line', () => {
    const rows = mapRows([
      { 'material.code': 'MAT-01', 'material.quantity': '2' },
      { 'material.code': 'MAT-01-01', 'material.quantity': '1' },
    ]);

    expect(rows.map(({ error }) => error)).toEqual([null, null]);
    expect(
      toMaterialImportPreviewRows(rows, [model], [], 'receipt')[0],
    ).toMatchObject({
      code: 'MAT-01',
      quantity: 2,
    });
  });
});
