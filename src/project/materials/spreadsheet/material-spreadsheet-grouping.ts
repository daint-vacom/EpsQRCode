import {
  normalizeHeader,
  SPREADSHEET_FIELD_MARKER,
  SpreadsheetError,
} from '@/lib/spreadsheets/xlsx';
import type {
  SpreadsheetField,
  SpreadsheetMapping,
  SpreadsheetValue,
  SpreadsheetWorkbook,
} from '@/lib/spreadsheets/xlsx';
import type { Material } from '../model/material';

export const MATERIAL_GROUPING_CONFIG_SHEET_NAME = 'Cấu hình gom nhóm';

export type MaterialSpreadsheetConflictPolicy = 'blank' | 'joinDistinct';

export interface MaterialSpreadsheetGroupByOption {
  fieldKey: string;
  label: string;
  defaultSelected: boolean;
  order: number;
  available: boolean;
}

export interface MaterialSpreadsheetGroupingConfig {
  options: MaterialSpreadsheetGroupByOption[];
  conflictPolicies: Record<string, MaterialSpreadsheetConflictPolicy>;
  defaultConflictPolicy: MaterialSpreadsheetConflictPolicy;
  errorMessageId: string | null;
}

export interface MaterialSpreadsheetExportRow {
  values: Record<string, SpreadsheetValue>;
}

const GROUP_BY_LABEL_IDS: Record<string, string> = {
  'material.model.code': 'project.materials.spreadsheet.groupBy.model',
  'material.owner.code': 'project.materials.spreadsheet.groupBy.owner',
  'material.model.group.code': 'project.materials.spreadsheet.groupBy.group',
  'material.condition': 'project.materials.spreadsheet.groupBy.condition',
  'material.capitalSource.code':
    'project.materials.spreadsheet.groupBy.capitalSource',
  'material.isActive': 'project.materials.spreadsheet.groupBy.isActive',
};

const GROUP_BY_KEY = {
  'material.model.code': (material: Material) => material.modelId,
  'material.owner.code': (material: Material) => getOwnerIdentityKey(material),
  'material.model.group.code': (material: Material) =>
    material.modelSnapshot.groupId,
  'material.condition': (material: Material) => material.condition,
  'material.capitalSource.code': (material: Material) =>
    material.capitalSourceId,
  'material.isActive': (material: Material) => material.isActive,
} satisfies Record<string, (material: Material) => unknown>;

export function readMaterialSpreadsheetGroupingConfig(
  workbook: Pick<SpreadsheetWorkbook, 'worksheets'>,
  fields: SpreadsheetField<Material>[],
  mapping: SpreadsheetMapping | null,
  translate: (id: string) => string,
): MaterialSpreadsheetGroupingConfig {
  const emptyConfig: MaterialSpreadsheetGroupingConfig = {
    options: [],
    conflictPolicies: {},
    defaultConflictPolicy: 'blank',
    errorMessageId: null,
  };
  const worksheet = workbook.worksheets.find(
    (candidate) =>
      normalizedWorksheetBaseName(candidate.name) ===
      normalizeHeader(MATERIAL_GROUPING_CONFIG_SHEET_NAME),
  );
  if (!worksheet) return emptyConfig;

  const optionHeaders = [
    'Mã field mapping',
    'Cho phép chọn',
    'Mặc định chọn',
    'Thứ tự',
  ];
  const hasOptionHeaders = optionHeaders.every(
    (header, index) =>
      normalizeHeader(readCellText(worksheet.getCell(2, index + 1))) ===
      normalizeHeader(header),
  );
  const hasPolicyHeaders =
    normalizeHeader(readCellText(worksheet.getCell(2, 6))) ===
      normalizeHeader('Mã field mapping') &&
    normalizeHeader(readCellText(worksheet.getCell(2, 7))) ===
      normalizeHeader('Xử lý xung đột');
  if (!hasOptionHeaders || !hasPolicyHeaders) {
    return {
      ...emptyConfig,
      errorMessageId: 'project.materials.spreadsheet.groupByConfigInvalid',
    };
  }

  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const options: MaterialSpreadsheetGroupByOption[] = [];
  const conflictPolicies: Record<string, MaterialSpreadsheetConflictPolicy> =
    {};
  let defaultConflictPolicy: MaterialSpreadsheetConflictPolicy = 'blank';

  for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const fieldKey = parseFieldMarker(
      readCellText(worksheet.getCell(rowNumber, 1)),
    );
    if (fieldKey) {
      const labelId = GROUP_BY_LABEL_IDS[fieldKey];
      const field = fieldsByKey.get(fieldKey);
      if (
        labelId &&
        field &&
        isEnabled(readCellText(worksheet.getCell(rowNumber, 2)))
      ) {
        const mappedColumn = mapping?.columnByFieldKey[fieldKey];
        const available = Boolean(
          mappedColumn && !mapping?.hiddenColumns?.includes(mappedColumn),
        );
        if (!options.some((option) => option.fieldKey === fieldKey)) {
          options.push({
            fieldKey,
            label: translate(labelId),
            defaultSelected:
              available &&
              isEnabled(readCellText(worksheet.getCell(rowNumber, 3))),
            order: parseOrder(
              readCellText(worksheet.getCell(rowNumber, 4)),
              rowNumber,
            ),
            available,
          });
        }
      }
    }

    const policyMarker = readCellText(worksheet.getCell(rowNumber, 6));
    const policy = parseConflictPolicy(
      readCellText(worksheet.getCell(rowNumber, 7)),
    );
    if (!policyMarker || !policy) continue;
    if (policyMarker.trim() === '*') {
      defaultConflictPolicy = policy;
      continue;
    }
    const policyFieldKey = parseFieldMarker(policyMarker);
    if (policyFieldKey && fieldsByKey.has(policyFieldKey)) {
      conflictPolicies[policyFieldKey] = policy;
    }
  }

  options.sort((left, right) => left.order - right.order);
  return {
    options,
    conflictPolicies,
    defaultConflictPolicy,
    errorMessageId: null,
  };
}

export function createMaterialSpreadsheetExportRows(
  records: Material[],
  fields: SpreadsheetField<Material>[],
  selectedGroupByFields: string[],
  config: Pick<
    MaterialSpreadsheetGroupingConfig,
    'conflictPolicies' | 'defaultConflictPolicy'
  >,
): MaterialSpreadsheetExportRow[] {
  const projectedRecords = records.map((record) => ({
    record,
    values: Object.fromEntries(
      fields.map((field) => [field.key, field.read(record)]),
    ) as Record<string, SpreadsheetValue>,
  }));

  const groupByFields = [...new Set(selectedGroupByFields)];
  if (groupByFields.length === 0) {
    return projectedRecords.map(({ values }) => ({ values }));
  }

  const dimensions = groupByFields.map((fieldKey) => {
    const getKey = GROUP_BY_KEY[fieldKey as keyof typeof GROUP_BY_KEY];
    if (!getKey) {
      throw new SpreadsheetError(
        'project.materials.spreadsheet.groupByUnsupported',
      );
    }
    return { fieldKey, getKey };
  });
  const groupedRecords = new Map<
    string,
    Array<(typeof projectedRecords)[number]>
  >();

  for (const projectedRecord of projectedRecords) {
    const groupKey = JSON.stringify(
      dimensions.map(({ fieldKey, getKey }) => [
        fieldKey,
        getKey(projectedRecord.record),
      ]),
    );
    const group = groupedRecords.get(groupKey);
    if (group) group.push(projectedRecord);
    else groupedRecords.set(groupKey, [projectedRecord]);
  }

  return [...groupedRecords.values()].map((group) => {
    const values: Record<string, SpreadsheetValue> = {};
    for (const field of fields) {
      if (field.key === 'material.quantity') {
        values[field.key] = group.length;
      } else if (field.key === 'material.code') {
        values[field.key] = null;
      } else {
        values[field.key] = aggregateFieldValues(
          group.map(({ values: rowValues }) => rowValues[field.key]),
          config.conflictPolicies[field.key] ?? config.defaultConflictPolicy,
        );
      }
    }
    return { values };
  });
}

export function getMaterialSpreadsheetExportRowFields(
  fields: SpreadsheetField<Material>[],
): SpreadsheetField<MaterialSpreadsheetExportRow>[] {
  return fields.map((field) => ({
    ...field,
    read: (row) => row.values[field.key] ?? null,
  }));
}

function getOwnerIdentityKey(material: Material) {
  const owner = material.ownerSnapshot;
  const identity = owner.partyId
    ? ['party', owner.partyId]
    : owner.catalogPartyId
      ? ['catalog', owner.catalogPartyId]
      : owner.employeeId
        ? ['employee', owner.employeeId]
        : owner.teamId
          ? ['team', owner.teamId]
          : owner.departmentId
            ? ['department', owner.departmentId]
            : owner.externalOrganizationId
              ? ['external', owner.externalOrganizationId]
              : owner.warehouseId
                ? ['warehouse', owner.warehouseId]
                : owner.sourceId
                  ? ['source', owner.sourceType ?? '', owner.sourceId]
                  : owner.scopePartyId
                    ? ['scope', owner.scopePartyId]
                    : [
                        'snapshot',
                        owner.code.trim().toLocaleLowerCase(),
                        owner.name.trim().toLocaleLowerCase(),
                      ];
  return JSON.stringify([owner.kind, owner.type, identity]);
}

function aggregateFieldValues(
  values: Array<SpreadsheetValue | undefined>,
  policy: MaterialSpreadsheetConflictPolicy,
): SpreadsheetValue {
  const distinctValues = new Map<string, SpreadsheetValue>();
  for (const value of values) {
    if (value === undefined || isEmptyValue(value)) continue;
    const signature = getValueSignature(value);
    if (!distinctValues.has(signature)) distinctValues.set(signature, value);
  }

  const valuesToKeep = [...distinctValues.values()];
  if (valuesToKeep.length <= 1) return valuesToKeep[0] ?? null;
  if (policy === 'blank') return null;

  const joinedValue = valuesToKeep.map(formatCellValue).join('\n');
  if (joinedValue.length > 32_767) {
    throw new SpreadsheetError(
      'project.materials.spreadsheet.groupByCellTooLong',
    );
  }
  return joinedValue;
}

function parseFieldMarker(value: string) {
  const marker = value.trim();
  return marker.startsWith(SPREADSHEET_FIELD_MARKER)
    ? marker.slice(SPREADSHEET_FIELD_MARKER.length).trim()
    : '';
}

function readCellText(cell: { value: unknown }) {
  const value = cell.value;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

function isEnabled(value: string) {
  return ['true', '1', 'yes', 'co'].includes(normalizeHeader(value));
}

function parseOrder(value: string, fallback: number) {
  if (value.trim() === '') return fallback;
  const order = Number(value);
  return Number.isFinite(order) ? order : fallback;
}

function parseConflictPolicy(value: string) {
  const normalized = normalizeHeader(value).replace(/\s+/g, '_');
  if (normalized === 'blank') return 'blank';
  if (normalized === 'join_distinct') return 'joinDistinct';
  return null;
}

function normalizedWorksheetBaseName(name: string) {
  return normalizeHeader(name)
    .replace(/\s*-\s*hide\s*$/i, '')
    .trim();
}

function isEmptyValue(value: SpreadsheetValue) {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

function getValueSignature(value: SpreadsheetValue) {
  if (value instanceof Date) return `date:${value.toISOString()}`;
  return `${typeof value}:${typeof value === 'string' ? value.trim() : String(value)}`;
}

function formatCellValue(value: SpreadsheetValue) {
  return value instanceof Date ? value.toISOString() : String(value);
}
