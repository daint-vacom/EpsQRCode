import type { Custodian } from '@/project/custodians/model/custodian';
import type { MaterialGroup } from '@/project/material-groups/model/material-group';
import type {
  MaterialModel,
  MaterialModelFormValues,
  MaterialModelSpecification,
} from '@/project/material-models/model/material-model';
import type { MaterialSpecification } from '@/project/material-specifications/model/material-specification';
import {
  detectSpreadsheetExportMapping,
  normalizeHeader,
  type SpreadsheetDataRow,
  type SpreadsheetField,
  type SpreadsheetMapping,
  type SpreadsheetWorkbook,
} from '@/lib/spreadsheets/xlsx';
import type { LinkedCode } from '../model/linked-code';
import {
  getMaterialGroupingCommonValue,
  getMaterialGroupingKey,
  MATERIAL_IMPORT_GROUPING_CONFIG,
  type Material,
} from '../model/material';
import type { MaterialCapitalSource } from '../model/material-capital-source';
import {
  mapMaterialImportRows,
  type MaterialImportRow,
} from './material-spreadsheet';

export const MATERIAL_IMPORT_REQUIRED_FIELD_KEYS = [
  'material.model.code',
  'material.owner.name',
] as const;

export const MATERIAL_IMPORT_MAX_ITEMS = 50_000;
const MATERIAL_IMPORT_MAX_ROW_QUANTITY = 10_000;
const LINKED_CODES_CONFIG_SHEET_NAME = 'Cấu hình mã liên kết';
const LINKED_CODES_MODEL_FIELD = '__linkedModelCodes';
const LINKED_CODES_MATERIAL_FIELD = '__linkedMaterialCodes';

export type MaterialImportLinkedCodeScope = 'model' | 'material';

interface MaterialImportLinkedCodeConfig {
  worksheetName: string;
  columnName: string;
  scope: MaterialImportLinkedCodeScope;
  label: string;
}

export interface MaterialSpreadsheetSource {
  id: string;
  file: File;
  status: 'reading' | 'success' | 'error';
  workbook: SpreadsheetWorkbook | null;
  worksheetName: string | null;
  mapping: SpreadsheetMapping | null;
  rows: SpreadsheetDataRow[];
  globalErrors: string[];
}

export interface MaterialSpreadsheetImportPreviewRow {
  id: string;
  sourceId: string;
  fileName: string;
  excelRow: number | null;
  code: string;
  quantity: number;
  modelCode: string;
  modelName: string;
  name: string;
  description: string;
  serialNumber: string;
  condition: string;
  materialGroupKey: string;
  specifications: string;
  ownerCode: string;
  ownerName: string;
  note: string;
  isValid: boolean;
  error: string;
  groupSummary?: MaterialSpreadsheetImportGroupSummary;
  subRows?: MaterialSpreadsheetImportPreviewRow[];
}

export interface MaterialSpreadsheetImportGroupSummary {
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
}

export interface MaterialModelImportProposal {
  code: string;
  name: string;
  groupCode: string;
  description: string;
  manufacturer: string;
  unit: string;
  unitPriceDefault: number | null;
  formValues: MaterialModelFormValues | null;
  previewModel: MaterialModel | null;
  error: string | null;
}

export interface MappedMaterialImportRow extends MaterialImportRow {
  id: string;
  sourceId: string;
  fileName: string;
  rawValues: Record<string, string>;
  quantity: number;
  modelCode: string;
  modelLinkedCodes: LinkedCode[];
  error: string | null;
}

export type TranslateMaterialImportMessage = (
  id: string,
  values?: Record<string, string>,
) => string;

export function findMaterialImportMapping(
  workbook: SpreadsheetWorkbook,
  fields: SpreadsheetField<Material>[],
): SpreadsheetMapping | null {
  let bestMapping: SpreadsheetMapping | null = null;
  let bestRequiredCount = -1;
  let bestFieldCount = -1;

  for (const worksheet of workbook.worksheets) {
    const mapping = detectSpreadsheetExportMapping(
      { worksheets: [worksheet] },
      fields,
    );
    if (!mapping) continue;

    const requiredCount = MATERIAL_IMPORT_REQUIRED_FIELD_KEYS.filter((key) =>
      Boolean(mapping.columnByFieldKey[key]),
    ).length;
    const fieldCount = Object.keys(mapping.columnByFieldKey).length;
    if (
      requiredCount > bestRequiredCount ||
      (requiredCount === bestRequiredCount && fieldCount > bestFieldCount)
    ) {
      bestMapping = mapping;
      bestRequiredCount = requiredCount;
      bestFieldCount = fieldCount;
    }
  }

  return bestMapping;
}

export function readMaterialImportLinkedCodes(
  workbook: SpreadsheetWorkbook,
  mapping: SpreadsheetMapping,
  rows: SpreadsheetDataRow[],
  translate: TranslateMaterialImportMessage,
): { rows: SpreadsheetDataRow[]; errors: string[] } {
  const configSheet = workbook.worksheets.find(
    (worksheet) =>
      normalizeHeader(worksheet.name) ===
      normalizeHeader(LINKED_CODES_CONFIG_SHEET_NAME),
  );
  if (!configSheet) return { rows, errors: [] };

  const configRows: string[][] = [];
  configSheet.eachRow?.({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    row.eachCell?.({ includeEmpty: true }, (cell, column) => {
      values[column - 1] = spreadsheetCellText(cell);
    });
    configRows.push(values);
  });
  if (configRows.length === 0) return { rows, errors: [] };
  const requiredHeaders = [
    'Sheet dữ liệu',
    'Cột dữ liệu',
    'Phạm vi lưu',
    'Nhãn mã liên kết',
  ].map(normalizeHeader);
  const configHeaderRowIndex = configRows.findIndex((values) => {
    const headers = values.map(normalizeHeader);
    return requiredHeaders.every((header) => headers.includes(header));
  });
  if (configHeaderRowIndex < 0) {
    return {
      rows,
      errors: [
        translate(
          'project.materials.spreadsheet.errors.linkedCodeConfigMissingColumns',
        ),
      ],
    };
  }

  const headers = configRows[configHeaderRowIndex]!.map(normalizeHeader);
  const columnIndex = (name: string) => headers.indexOf(normalizeHeader(name));
  const worksheetColumn = columnIndex('Sheet dữ liệu');
  const dataColumn = columnIndex('Cột dữ liệu');
  const scopeColumn = columnIndex('Phạm vi lưu');
  const labelColumn = columnIndex('Nhãn mã liên kết');
  if (
    [worksheetColumn, dataColumn, scopeColumn, labelColumn].some((i) => i < 0)
  ) {
    return {
      rows,
      errors: [
        translate(
          'project.materials.spreadsheet.errors.linkedCodeConfigMissingColumns',
        ),
      ],
    };
  }

  const sourceWorksheet = workbook.getWorksheet(mapping.worksheetName);
  if (!sourceWorksheet) return { rows, errors: [] };
  const sourceHeaders = new Map<string, number>();
  sourceWorksheet
    .getRow(mapping.headerRow)
    .eachCell?.({ includeEmpty: true }, (cell, column) => {
      const header = spreadsheetCellText(cell);
      if (header) sourceHeaders.set(normalizeHeader(header), column);
    });

  const configs: MaterialImportLinkedCodeConfig[] = [];
  const errors: string[] = [];
  for (const values of configRows.slice(configHeaderRowIndex + 1)) {
    const worksheetName = values[worksheetColumn]?.trim() ?? '';
    const columnName = values[dataColumn]?.trim() ?? '';
    const scopeValue = normalizeHeader(values[scopeColumn] ?? '');
    const label = values[labelColumn]?.trim() ?? '';
    if (!worksheetName && !columnName && !scopeValue && !label) continue;
    if (!worksheetName || !columnName || !scopeValue || !label) {
      errors.push(
        translate(
          'project.materials.spreadsheet.errors.linkedCodeConfigIncomplete',
        ),
      );
      continue;
    }
    const scope: MaterialImportLinkedCodeScope | null = [
      'vat tu',
      'material',
    ].includes(scopeValue)
      ? 'material'
      : ['mau', 'mau vat tu', 'material model', 'model'].includes(scopeValue)
        ? 'model'
        : null;
    if (!scope) {
      errors.push(
        translate(
          'project.materials.spreadsheet.errors.linkedCodeScopeInvalid',
          { scope: values[scopeColumn] ?? '' },
        ),
      );
      continue;
    }
    if (
      normalizeHeader(worksheetName) !== normalizeHeader(mapping.worksheetName)
    ) {
      continue;
    }
    if (!sourceHeaders.has(normalizeHeader(columnName))) {
      errors.push(
        translate(
          'project.materials.spreadsheet.errors.linkedCodeColumnMissing',
          { column: columnName },
        ),
      );
      continue;
    }
    configs.push({ worksheetName, columnName, scope, label });
  }

  const codeColumnByConfig = configs.map((config) => ({
    ...config,
    column: sourceHeaders.get(normalizeHeader(config.columnName))!,
  }));
  const rowByNumber = new Map(rows.map((row) => [row.rowNumber, row]));
  const startRow = mapping.dataStartRow;
  for (
    let rowNumber = startRow;
    rowNumber <= sourceWorksheet.rowCount;
    rowNumber += 1
  ) {
    const target = rowByNumber.get(rowNumber);
    if (!target) continue;
    const linkedCodes: Record<MaterialImportLinkedCodeScope, LinkedCode[]> = {
      model: [],
      material: [],
    };
    for (const config of codeColumnByConfig) {
      const value = spreadsheetCellText(
        sourceWorksheet.getCell(rowNumber, config.column),
      );
      if (value) linkedCodes[config.scope].push({ label: config.label, value });
    }
    target.values[LINKED_CODES_MODEL_FIELD] = JSON.stringify(linkedCodes.model);
    target.values[LINKED_CODES_MATERIAL_FIELD] = JSON.stringify(
      linkedCodes.material,
    );
  }
  return { rows, errors: Array.from(new Set(errors)) };
}

export function getMissingMaterialImportFields(
  mapping: SpreadsheetMapping | null,
  translate: TranslateMaterialImportMessage,
): string[] {
  return MATERIAL_IMPORT_REQUIRED_FIELD_KEYS.filter(
    (key) => !mapping?.columnByFieldKey[key],
  ).map((key) => {
    const fieldKeyByRequirement: Record<string, string> = {
      'material.code': 'code',
      'material.model.code': 'modelCode',
      'material.owner.name': 'ownerName',
    };
    return translate(
      `project.materials.spreadsheet.fields.${fieldKeyByRequirement[key] ?? key}`,
    );
  });
}

export function isMaterialImportExampleRow(row: SpreadsheetDataRow) {
  return (
    normalizeHeader(valueOf(row, 'material.code')) ===
      normalizeHeader('VT-MAU-001') &&
    normalizeHeader(valueOf(row, 'material.note')) ===
      normalizeHeader('Dữ liệu mẫu')
  );
}

export function buildMaterialModelImportProposals(
  rows: SpreadsheetDataRow[],
  models: MaterialModel[],
  groups: MaterialGroup[],
  specificationCatalog: MaterialSpecification[],
  translate: TranslateMaterialImportMessage,
): MaterialModelImportProposal[] {
  const rowsByModelCode = new Map<string, SpreadsheetDataRow[]>();
  for (const row of rows) {
    const code = valueOf(row, 'material.model.code');
    if (!code) continue;
    const key = normalizeHeader(code);
    const currentRows = rowsByModelCode.get(key) ?? [];
    currentRows.push(row);
    rowsByModelCode.set(key, currentRows);
  }

  const proposals = Array.from(rowsByModelCode.values())
    .map((modelRows) => {
      const firstRow = modelRows[0];
      const code = valueOf(firstRow, 'material.model.code');
      const existingModel = models.find(
        (model) => normalizeHeader(model.code) === normalizeHeader(code),
      );
      if (existingModel) return null;

      const name = consistentValue(
        modelRows,
        'material.model.name',
        translate,
        code,
      );
      const groupCode = consistentValue(
        modelRows,
        'material.model.group.code',
        translate,
        code,
      );
      const description = consistentValue(
        modelRows,
        'material.model.description',
        translate,
        code,
      );
      const manufacturer = consistentValue(
        modelRows,
        'material.model.manufacturer',
        translate,
        code,
      );
      const unit = consistentValue(
        modelRows,
        'material.model.unit',
        translate,
        code,
      );
      const rawUnitPrice = valueOf(firstRow, 'material.model.unitPriceDefault');
      const unitPriceDefault = parseLocalizedAmount(rawUnitPrice);
      const linkedCodes = dedupeLinkedCodes([
        ...modelRows.flatMap((row) => readRowLinkedCodes(row, 'model')),
        ...modelRows.flatMap((row) =>
          parseFormattedLinkedCodes(valueOf(row, 'material.model.linkedCodes')),
        ),
        ...modelRows.flatMap((row) =>
          valueOf(row, 'material.model.externalCodes')
            .split(/\r?\n/)
            .map((value) => value.trim())
            .filter(Boolean)
            .map((value) => ({ label: 'Mã liên kết', value })),
        ),
      ]);
      const conflictingModelCodes = modelRows.some((row) =>
        readRowLinkedCodes(row, 'model').some((entry) =>
          linkedCodes.some(
            (candidate) =>
              normalizeHeader(candidate.label) ===
                normalizeHeader(entry.label) &&
              normalizeHeader(candidate.value) !== normalizeHeader(entry.value),
          ),
        ),
      );
      const rawSpecifications = consistentValue(
        modelRows,
        'material.model.specifications',
        translate,
        code,
      );
      const errors = [
        name.error,
        groupCode.error,
        description.error,
        manufacturer.error,
        unit.error,
        ...(rawUnitPrice && unitPriceDefault === null
          ? [translate('project.materials.spreadsheet.errors.unitPrice')]
          : []),
        rawSpecifications.error,
        ...(conflictingModelCodes
          ? [
              translate(
                'project.materials.spreadsheet.errors.modelMetadataConflict',
                { code },
              ),
            ]
          : []),
      ].filter((error): error is string => Boolean(error));
      const resolvedGroup = groups.find(
        (group) =>
          group.isActive &&
          normalizeHeader(group.code) === normalizeHeader(groupCode.value),
      );
      if (!name.value) {
        errors.push(
          translate('project.materials.spreadsheet.errors.modelNameRequired'),
        );
      }
      if (!groupCode.value) {
        errors.push(
          translate('project.materials.spreadsheet.errors.modelGroupRequired'),
        );
      } else if (!resolvedGroup) {
        errors.push(
          translate('project.materials.spreadsheet.errors.modelGroupNotFound', {
            code: groupCode.value,
          }),
        );
      }

      const parsedSpecifications = parseModelSpecifications(
        rawSpecifications.value,
        specificationCatalog,
        translate,
      );
      if (parsedSpecifications.error) errors.push(parsedSpecifications.error);

      if (errors.length > 0 || !resolvedGroup) {
        return {
          code,
          name: name.value,
          groupCode: groupCode.value,
          description: description.value,
          manufacturer: manufacturer.value,
          unit: unit.value,
          unitPriceDefault,
          formValues: null,
          previewModel: null,
          error: Array.from(new Set(errors)).join(' '),
        } satisfies MaterialModelImportProposal;
      }

      const specifications = parsedSpecifications.specifications;
      const formValues: MaterialModelFormValues = {
        code,
        codeMode: 'manual',
        name: name.value,
        groupId: resolvedGroup.id,
        description: description.value,
        manufacturer: manufacturer.value,
        unit: unit.value,
        unitPriceDefault,
        linkedCodes,
        requiresInspection: false,
        inspectionIntervalValue: 1,
        inspectionIntervalUnit: 'month',
        skipInitialInspection: false,
        useGroupSafetyInspectionChecklist: true,
        specifications,
        safetyInspectionChecklist: [],
      };
      const previewModel: MaterialModel = {
        id: `pending:${normalizeHeader(code)}`,
        code,
        name: name.value,
        groupId: resolvedGroup.id,
        images: [],
        imageUrl: null,
        description: description.value,
        manufacturer: manufacturer.value,
        unit: unit.value,
        unitPriceDefault,
        externalCodes: linkedCodes.map((item) => item.value),
        linkedCodes,
        requiresInspection: false,
        inspectionIntervalValue: 1,
        inspectionIntervalUnit: 'month',
        skipInitialInspection: false,
        useGroupSafetyInspectionChecklist: true,
        specifications,
        safetyInspectionChecklist: [],
        publicDisplaySettings: { basicInfo: true, specifications: true },
        isActive: true,
        createdAt: '',
        updatedAt: '',
      };

      return {
        code,
        name: name.value,
        groupCode: groupCode.value,
        description: description.value,
        manufacturer: manufacturer.value,
        unit: unit.value,
        unitPriceDefault,
        formValues,
        previewModel,
        error: null,
      } satisfies MaterialModelImportProposal;
    })
    .filter(
      (proposal): proposal is MaterialModelImportProposal => proposal !== null,
    );

  const reservedCodes = new Set(
    models
      .flatMap((model) => [model.code, ...model.externalCodes])
      .map((code) => code.trim().toLowerCase()),
  );
  return proposals.map((proposal) => {
    if (!proposal.formValues || proposal.error) return proposal;

    const codes = [
      proposal.code,
      ...proposal.formValues.linkedCodes.map((item) => item.value),
    ];
    const proposalCodes = new Set<string>();
    const conflict = codes.find((code) => {
      const normalized = code.toLowerCase();
      if (reservedCodes.has(normalized) || proposalCodes.has(normalized)) {
        return true;
      }
      proposalCodes.add(normalized);
      return false;
    });
    if (conflict) {
      return {
        ...proposal,
        formValues: null,
        previewModel: null,
        error: translate(
          'project.materials.spreadsheet.errors.externalCodeConflict',
          { code: conflict },
        ),
      };
    }

    codes.forEach((code) => reservedCodes.add(code.toLowerCase()));
    return proposal;
  });
}

export function mapMaterialSpreadsheetRows(
  sources: MaterialSpreadsheetSource[],
  models: MaterialModel[],
  custodians: Custodian[],
  fields: SpreadsheetField<Material>[],
  translate: TranslateMaterialImportMessage,
  modelProposals: MaterialModelImportProposal[] = [],
  capitalSources: MaterialCapitalSource[] = [],
): MappedMaterialImportRow[] {
  const sourceRows = sources.flatMap((source) =>
    source.rows.map((row, index) => ({ source, row, index })),
  );
  const modelsWithPending = [
    ...models,
    ...modelProposals.flatMap((proposal) =>
      proposal.previewModel && !proposal.error ? [proposal.previewModel] : [],
    ),
  ];
  const mapped = mapMaterialImportRows(
    sourceRows.map(({ row }) => row),
    modelsWithPending,
    custodians,
    fields,
    translate,
    capitalSources,
  );

  let plannedItemCount = 0;
  const mappedRows = mapped.map((row, index) => {
    const sourceRow = sourceRows[index];
    const source = sourceRow?.source;
    const rawValues = sourceRow?.row.values ?? {};
    const modelCode = valueOf(sourceRow?.row, 'material.model.code');
    const proposal = modelProposals.find(
      (item) => normalizeHeader(item.code) === normalizeHeader(modelCode),
    );
    const quantityResult = parseImportQuantity(
      rawValues['material.quantity'] ?? '',
      translate,
    );
    const serialNumber = rawValues['material.serialNumber']?.trim() ?? '';
    const itemLinkedCodes = dedupeLinkedCodes([
      ...readRowLinkedCodes(sourceRow?.row, 'material'),
      ...parseFormattedLinkedCodes(
        valueOf(sourceRow?.row, 'material.linkedCodes'),
      ),
    ]);
    let error = proposal?.error || quantityResult.error || row.error;
    if (
      !error &&
      new Set(itemLinkedCodes.map((item) => normalizeHeader(item.value)))
        .size !== itemLinkedCodes.length
    ) {
      error = translate(
        'project.materials.spreadsheet.errors.linkedCodeDuplicate',
      );
    }
    if (!error && quantityResult.quantity > 1 && serialNumber) {
      error = translate('project.materials.spreadsheet.errors.serialQuantity');
    }
    if (!error && quantityResult.quantity > 1 && itemLinkedCodes.length > 0) {
      error = translate(
        'project.materials.spreadsheet.errors.linkedCodeQuantity',
      );
    }
    if (
      !error &&
      plannedItemCount + quantityResult.quantity > MATERIAL_IMPORT_MAX_ITEMS
    ) {
      error = translate('project.materials.spreadsheet.errors.quantityLimit', {
        count: MATERIAL_IMPORT_MAX_ITEMS.toLocaleString(),
      });
    }
    if (!error) plannedItemCount += quantityResult.quantity;
    const materialLinkedCodes = itemLinkedCodes;
    return {
      ...row,
      values:
        error || !row.values
          ? null
          : { ...row.values, linkedCodes: materialLinkedCodes },
      id: `${source?.id ?? 'file'}:${sourceRow?.row.rowNumber ?? row.rowNumber}:${sourceRow?.index ?? index}`,
      sourceId: source?.id ?? '',
      fileName: source?.file.name ?? '',
      rawValues,
      quantity: quantityResult.quantity,
      modelCode,
      modelLinkedCodes: readRowLinkedCodes(sourceRow?.row, 'model'),
      error,
    };
  });

  return markGeneratedCodeCollisions(mappedRows, translate);
}

export function toMaterialImportPreviewRows(
  rows: MappedMaterialImportRow[],
  models: MaterialModel[],
  proposals: MaterialModelImportProposal[],
): MaterialSpreadsheetImportPreviewRow[] {
  return rows.map((row) => {
    const isValid = row.values !== null && !row.error;
    const model = models.find(
      (item) => normalizeHeader(item.code) === normalizeHeader(row.modelCode),
    );
    const proposal = proposals.find(
      (item) => normalizeHeader(item.code) === normalizeHeader(row.modelCode),
    );
    return {
      id: row.id,
      sourceId: row.sourceId,
      fileName: row.fileName,
      excelRow: row.rowNumber,
      code: row.code
        ? formatMaterialImportCodeRange(row.code, row.quantity)
        : '',
      quantity: row.quantity,
      modelCode: row.modelCode,
      modelName: model?.name ?? proposal?.name ?? '',
      name: valueOf(row.rawValues, 'material.nameOverride'),
      description:
        valueOf(row.rawValues, 'material.descriptionOverride') ||
        model?.description ||
        proposal?.description ||
        '',
      serialNumber: valueOf(row.rawValues, 'material.serialNumber'),
      condition: valueOf(row.rawValues, 'material.condition'),
      materialGroupKey: JSON.stringify([
        getMaterialGroupingKey(
          {
            id: row.id,
            modelCode: row.modelCode,
            ownerCode: valueOf(row.rawValues, 'material.owner.code'),
            ownerName: valueOf(row.rawValues, 'material.owner.name'),
            condition: valueOf(row.rawValues, 'material.condition'),
          },
          MATERIAL_IMPORT_GROUPING_CONFIG,
        ),
        isValid ? 'valid' : 'invalid',
      ]),
      specifications: valueOf(row.rawValues, 'material.specifications'),
      ownerCode: valueOf(row.rawValues, 'material.owner.code'),
      ownerName: valueOf(row.rawValues, 'material.owner.name'),
      note: valueOf(row.rawValues, 'material.note'),
      isValid,
      error: row.error ?? '',
    };
  });
}

export function groupMaterialImportPreviewRows(
  rows: MaterialSpreadsheetImportPreviewRow[],
): MaterialSpreadsheetImportPreviewRow[] {
  const groups = new Map<string, MaterialSpreadsheetImportPreviewRow[]>();
  for (const row of rows) {
    const members = groups.get(row.materialGroupKey) ?? [];
    members.push(row);
    groups.set(row.materialGroupKey, members);
  }

  return Array.from(groups.entries())
    .map(([materialGroupKey, members]) => {
      const first = members[0];
      const validMembers = members.filter((row) => row.isValid);
      const invalidMembers = members.filter((row) => !row.isValid);
      const commonValue = (
        get: (row: MaterialSpreadsheetImportPreviewRow) => string,
      ) => getMaterialGroupingCommonValue(members.map(get));

      return {
        ...first,
        id: `material-group:${materialGroupKey}`,
        fileName: commonValue((row) => row.fileName),
        excelRow: null,
        code: commonValue((row) => row.code),
        quantity: members.reduce((total, row) => total + row.quantity, 0),
        modelCode: commonValue((row) => row.modelCode),
        modelName: commonValue((row) => row.modelName),
        name: commonValue((row) => row.name),
        description: commonValue((row) => row.description),
        serialNumber: commonValue((row) => row.serialNumber),
        condition: commonValue((row) => row.condition),
        specifications: commonValue((row) => row.specifications),
        ownerCode: commonValue((row) => row.ownerCode),
        ownerName: commonValue((row) => row.ownerName),
        note: commonValue((row) => row.note),
        isValid: validMembers.length > 0,
        error: commonValue((row) => row.error),
        groupSummary: {
          rowCount: members.length,
          validRowCount: validMembers.length,
          invalidRowCount: invalidMembers.length,
        },
        subRows: members,
      };
    })
    .sort((left, right) =>
      left.modelName.localeCompare(right.modelName, 'vi', {
        sensitivity: 'base',
      }),
    );
}

export function getMaterialImportCodes(
  code: string,
  quantity: number,
): string[] {
  if (!code.trim()) return Array.from({ length: quantity }, () => '');
  if (quantity <= 1) return [code];
  const suffixLength = Math.max(3, String(quantity).length);
  return Array.from(
    { length: quantity },
    (_, index) => `${code}-${String(index + 1).padStart(suffixLength, '0')}`,
  );
}

function formatMaterialImportCodeRange(code: string, quantity: number) {
  const codes = getMaterialImportCodes(code, quantity);
  return codes.length > 1 ? `${codes[0]} … ${codes[codes.length - 1]}` : code;
}

function markGeneratedCodeCollisions(
  rows: MappedMaterialImportRow[],
  translate: TranslateMaterialImportMessage,
) {
  const rowByCode = new Map<string, string>();
  const collidingRows = new Set<string>();
  for (const row of rows) {
    if (!row.values || row.error || !row.code.trim()) continue;
    for (const code of getMaterialImportCodes(row.code, row.quantity)) {
      const key = normalizeHeader(code);
      const previousRowId = rowByCode.get(key);
      if (previousRowId) {
        collidingRows.add(previousRowId);
        collidingRows.add(row.id);
      } else {
        rowByCode.set(key, row.id);
      }
    }
  }

  return rows.map((row) =>
    collidingRows.has(row.id)
      ? {
          ...row,
          values: null,
          error: translate(
            'project.materials.spreadsheet.errors.duplicateCode',
          ),
        }
      : row,
  );
}

function parseImportQuantity(
  value: string,
  translate: TranslateMaterialImportMessage,
): { quantity: number; error: string | null } {
  const normalized = value.trim().replace(/[\s\u00a0]/g, '');
  if (!normalized) return { quantity: 1, error: null };

  const groupedThousands = /^\d{1,3}(?:[,.]\d{3})+$/.test(normalized);
  const digits = groupedThousands
    ? normalized.replace(/[,.]/g, '')
    : normalized;
  if (!/^\d+$/.test(digits)) {
    return {
      quantity: 1,
      error: translate('project.materials.spreadsheet.errors.quantity'),
    };
  }

  const quantity = Number(digits);
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > MATERIAL_IMPORT_MAX_ROW_QUANTITY
  ) {
    return {
      quantity: 1,
      error: translate('project.materials.spreadsheet.errors.quantity'),
    };
  }
  return { quantity, error: null };
}

function consistentValue(
  rows: SpreadsheetDataRow[],
  key: string,
  translate: TranslateMaterialImportMessage,
  modelCode: string,
): { value: string; error: string | null } {
  const values = Array.from(
    new Set(rows.map((row) => valueOf(row, key)).filter(Boolean)),
  );
  if (values.length > 1) {
    return {
      value: values[0] ?? '',
      error: translate(
        'project.materials.spreadsheet.errors.modelMetadataConflict',
        {
          code: modelCode,
        },
      ),
    };
  }
  return { value: values[0] ?? '', error: null };
}

function parseLocalizedAmount(value: string): number | null {
  const normalized = value.replace(/\s|₫|vnd/gi, '').trim();
  if (!normalized) return null;
  let numeric = normalized.replace(/[^\d.,+-]/g, '');
  const lastSeparator = Math.max(
    numeric.lastIndexOf(','),
    numeric.lastIndexOf('.'),
  );
  if (lastSeparator >= 0) {
    const decimals = numeric.length - lastSeparator - 1;
    numeric =
      decimals > 0 && decimals <= 2
        ? `${numeric.slice(0, lastSeparator).replace(/[.,]/g, '')}.${numeric.slice(lastSeparator + 1)}`
        : numeric.replace(/[.,]/g, '');
  }
  const parsed = Number(numeric);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseModelSpecifications(
  raw: string,
  catalog: MaterialSpecification[],
  translate: TranslateMaterialImportMessage,
): { specifications: MaterialModelSpecification[]; error: string | null } {
  const specifications: MaterialModelSpecification[] = [];
  const seenSpecificationIds = new Set<string>();

  for (const line of raw.split(/\r?\n/).map((item) => item.trim())) {
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator <= 0 || separator === line.length - 1) {
      return {
        specifications,
        error: translate(
          'project.materials.spreadsheet.errors.modelSpecificationsFormat',
        ),
      };
    }

    const name = line.slice(0, separator).trim();
    const catalogMatches = catalog.filter(
      (item) => normalizeHeader(item.name) === normalizeHeader(name),
    );
    if (catalogMatches.length !== 1) {
      return {
        specifications,
        error: translate(
          'project.materials.spreadsheet.errors.modelSpecificationUnknown',
          { name },
        ),
      };
    }

    const definition = catalogMatches[0];
    if (seenSpecificationIds.has(definition.id)) {
      return {
        specifications,
        error: translate(
          'project.materials.spreadsheet.errors.modelSpecificationDuplicate',
          { name },
        ),
      };
    }
    seenSpecificationIds.add(definition.id);

    const enteredValues = line
      .slice(separator + 1)
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
    if (enteredValues.length === 0) {
      return {
        specifications,
        error: translate(
          'project.materials.spreadsheet.errors.modelSpecificationValues',
          { name },
        ),
      };
    }

    const values: string[] = [];
    const valueLabels: string[] = [];
    for (const enteredValue of enteredValues) {
      const option = definition.options.find(
        (item) =>
          normalizeHeader(item.label) === normalizeHeader(enteredValue) ||
          normalizeHeader(item.name ?? '') === normalizeHeader(enteredValue),
      );
      if (definition.dataType === 'color' && !option) {
        return {
          specifications,
          error: translate(
            'project.materials.spreadsheet.errors.modelSpecificationValueUnknown',
            { name, value: enteredValue },
          ),
        };
      }

      if (definition.dataType === 'boolean') {
        const normalized = normalizeHeader(enteredValue);
        if (['true', 'yes', normalizeHeader('Có')].includes(normalized)) {
          values.push('true');
        } else if (
          ['false', 'no', normalizeHeader('Không')].includes(normalized)
        ) {
          values.push('false');
        } else {
          return {
            specifications,
            error: translate(
              'project.materials.spreadsheet.errors.modelSpecificationValueUnknown',
              { name, value: enteredValue },
            ),
          };
        }
      } else {
        values.push(option?.label ?? enteredValue);
        valueLabels.push(
          definition.dataType === 'color'
            ? option?.name?.trim() || option?.label || enteredValue
            : '',
        );
      }
    }

    specifications.push({
      id: definition.id,
      dataType: definition.dataType,
      name: definition.name,
      isList: values.length > 1,
      valueLabels,
      values,
    });
  }

  return { specifications, error: null };
}

function valueOf(
  row: SpreadsheetDataRow | Record<string, string> | undefined,
  key: string,
): string {
  if (!row) return '';
  const values = 'values' in row ? row.values : row;
  return values[key]?.trim() ?? '';
}

function readRowLinkedCodes(
  row: SpreadsheetDataRow | undefined,
  scope: MaterialImportLinkedCodeScope,
): LinkedCode[] {
  const raw = valueOf(
    row,
    scope === 'model' ? LINKED_CODES_MODEL_FIELD : LINKED_CODES_MATERIAL_FIELD,
  );
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is LinkedCode =>
        typeof item?.label === 'string' &&
        typeof item?.value === 'string' &&
        Boolean(item.label.trim() && item.value.trim()),
    );
  } catch {
    return [];
  }
}

function dedupeLinkedCodes(codes: LinkedCode[]) {
  const seen = new Set<string>();
  return codes.filter((code) => {
    const key = `${normalizeHeader(code.label)}\u0000${normalizeHeader(code.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseFormattedLinkedCodes(raw: string): LinkedCode[] {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const separator = line.indexOf(':');
      if (separator <= 0) return null;
      const label = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      return label && value ? { label, value } : null;
    })
    .filter((item): item is LinkedCode => item !== null);
}

function spreadsheetCellText(cell: { value: unknown; text?: string }) {
  if (typeof cell.text === 'string' && cell.text.trim())
    return cell.text.trim();
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string')
      return value.text.trim();
    if ('result' in value) return String(value.result ?? '').trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    }
  }
  return String(value).trim();
}
