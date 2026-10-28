import type { Custodian } from '@/project/custodians/model/custodian';
import type { MaterialModel } from '@/project/material-models/model/material-model';
import type {
  SpreadsheetDataRow,
  SpreadsheetField,
  SpreadsheetMapping,
  SpreadsheetWorkbook,
} from '@/lib/spreadsheets/xlsx';
import {
  detectSpreadsheetExportMapping,
  normalizeHeader,
  SPREADSHEET_FIELD_MARKER,
} from '@/lib/spreadsheets/xlsx';
import { materialFormSchema } from '../forms/material-form.schema';
import type {
  Material,
  MaterialCondition,
  MaterialFormValues,
  MaterialOwnerKind,
} from '../model/material';

export const MATERIAL_SPREADSHEET_ENTITY_KEY = 'materials';

export type TranslateMaterialSpreadsheetMessage = (
  id: string,
  values?: Record<string, string>,
) => string;

export interface MaterialImportRow {
  rowNumber: number;
  code: string;
  values: MaterialFormValues | null;
  error: string | null;
}

export function getMaterialSpreadsheetFields(
  models: MaterialModel[],
  custodians: Custodian[],
  translate: TranslateMaterialSpreadsheetMessage,
): SpreadsheetField<Material>[] {
  const fields: SpreadsheetField<Material>[] = [
    {
      key: 'material.code',
      label: translate('project.materials.spreadsheet.fields.code'),
      required: true,
      read: (row) => row.code,
    },
    {
      key: 'material.model.code',
      label: translate('project.materials.spreadsheet.fields.modelCode'),
      required: true,
      read: (row) => row.modelSnapshot.code,
    },
    {
      key: 'material.nameOverride',
      label: translate('project.materials.fields.name'),
      headerAliases: [
        translate('project.materials.spreadsheet.fields.nameLegacy'),
      ],
      read: (row) => row.nameOverride?.trim() || row.modelSnapshot.name,
    },
    {
      key: 'material.descriptionOverride',
      label: translate('project.materials.fields.description'),
      headerAliases: [
        translate('project.materials.spreadsheet.fields.descriptionLegacy'),
      ],
      read: (row) =>
        row.descriptionOverride?.trim() || row.modelSnapshot.description,
    },
    {
      key: 'material.serialNumber',
      label: translate('project.materials.spreadsheet.fields.serialNumber'),
      read: (row) => row.serialNumber,
    },
    {
      key: 'material.condition',
      label: translate('project.materials.fields.condition'),
      headerAliases: [
        translate('project.materials.spreadsheet.fields.conditionLegacy'),
      ],
      read: (row) => translate(`project.materials.condition.${row.condition}`),
    },
    {
      key: 'material.note',
      label: translate('project.materials.spreadsheet.fields.note'),
      read: (row) => row.note,
    },
  ];

  const specifications = new Map(
    models
      .flatMap((model) => model.specifications)
      .map((spec) => [spec.id, spec]),
  );
  [...specifications.values()].forEach((specification, index) => {
    fields.push({
      key: `material.specification.${specification.id}`,
      label: specification.name,
      headerAliases: [
        translate('project.materials.spreadsheet.fields.specificationSlot', {
          index: String(index + 1),
        }),
        translate(
          'project.materials.spreadsheet.fields.specificationShortSlot',
          { index: String(index + 1) },
        ),
      ],
      read: (material) => {
        const snapshot = material.modelSnapshot.specifications.find(
          (item) => item.id === specification.id,
        );
        if (!snapshot) return '';

        const hasOverride = Object.prototype.hasOwnProperty.call(
          material.specificationOverrides,
          specification.id,
        );
        const values = hasOverride
          ? (material.specificationOverrides[specification.id] ?? [])
          : snapshot.values.length === 1
            ? [snapshot.values[0]]
            : [];
        if (snapshot.dataType !== 'color') return values.join('; ');

        const labelsByValue = new Map(
          snapshot.values.map((value, valueIndex) => [
            value,
            snapshot.valueLabels[valueIndex],
          ]),
        );
        const labelOverrides =
          material.specificationOverrideLabels[specification.id] ?? [];
        return values
          .map((value, valueIndex) => {
            const customLabel = Object.prototype.hasOwnProperty.call(
              labelOverrides,
              valueIndex,
            )
              ? labelOverrides[valueIndex]?.trim()
              : '';
            return customLabel || labelsByValue.get(value)?.trim() || '';
          })
          .filter(Boolean)
          .join('; ');
      },
    });
  });

  fields.push(
    {
      key: 'material.owner.code',
      label: translate('project.materials.spreadsheet.fields.ownerCode'),
      read: (row) => row.ownerSnapshot.code,
    },
    {
      key: 'material.owner.name',
      label: translate('project.materials.spreadsheet.fields.ownerName'),
      required: true,
      read: (row) => row.ownerSnapshot.name,
    },
    {
      key: 'material.owner.kind',
      label: translate('project.materials.spreadsheet.fields.ownerKind'),
      headerAliases: [
        translate('project.materials.spreadsheet.fields.ownerKindLegacy'),
      ],
      read: (row) =>
        translate(
          `project.handover.partyDialog.kind.${row.ownerSnapshot.kind}`,
        ),
    },
    {
      key: 'material.owner.scope.code',
      label: translate('project.materials.spreadsheet.fields.ownerScopeCode'),
      read: (row) =>
        custodians.find((party) => party.id === row.ownerSnapshot.scopePartyId)
          ?.code ?? '',
    },
    {
      key: 'material.owner.representativeName',
      label: translate(
        'project.materials.spreadsheet.fields.ownerRepresentative',
      ),
      read: (row) => row.ownerSnapshot.representativeName,
    },
    {
      key: 'material.owner.phone',
      label: translate('project.materials.spreadsheet.fields.ownerPhone'),
      read: (row) => row.ownerSnapshot.phone,
    },
    {
      key: 'material.owner.email',
      label: translate('project.materials.spreadsheet.fields.ownerEmail'),
      read: (row) => row.ownerSnapshot.email,
    },
  );
  return fields;
}

export function prepareMaterialExportMapping(
  workbook: SpreadsheetWorkbook,
  fields: SpreadsheetField<Material>[],
  templateSource: 'system' | 'custom',
): SpreadsheetMapping | null {
  const mapping = detectSpreadsheetExportMapping(workbook, fields);
  if (!mapping) return null;

  const worksheet = workbook.getWorksheet(mapping.worksheetName);
  if (!worksheet) return null;

  if (
    templateSource === 'system' &&
    hasFieldMarkerRow(worksheet, mapping.headerRow - 1)
  ) {
    return arrangeSystemTemplateColumns(worksheet, mapping, fields);
  }

  fields.forEach((field) => {
    const column = mapping.columnByFieldKey[field.key];
    if (!column || !field.headerAliases?.length) return;
    const header = worksheet.getCell(mapping.headerRow, column);
    const currentHeader = header.text ?? String(header.value ?? '');
    if (
      field.headerAliases.some(
        (alias) => normalizeHeader(alias) === normalizeHeader(currentHeader),
      )
    ) {
      header.value = field.label;
    }
  });
  return mapping;
}

function arrangeSystemTemplateColumns(
  worksheet: SpreadsheetWorkbook['worksheets'][number],
  detectedMapping: SpreadsheetMapping,
  fields: SpreadsheetField<Material>[],
): SpreadsheetMapping | null {
  const orderedFields = fields.filter(
    (field) => detectedMapping.columnByFieldKey[field.key] !== undefined,
  );
  if (orderedFields.length === 0) return null;

  const markerRowNumber = detectedMapping.headerRow - 1;
  const oldColumnCount = Math.max(
    worksheet.columns?.length ?? 0,
    ...Object.values(detectedMapping.columnByFieldKey),
  );
  const originalWidths = worksheet.columns ?? [];
  const fallbackColumn = Math.max(
    1,
    ...Object.values(detectedMapping.columnByFieldKey),
  );
  const styleByField = orderedFields.map((field) => {
    const sourceColumn =
      detectedMapping.columnByFieldKey[field.key] ?? fallbackColumn;
    return {
      headerStyle: worksheet.getCell(detectedMapping.headerRow, sourceColumn)
        .style,
      dataStyle: worksheet.getCell(detectedMapping.dataStartRow, sourceColumn)
        .style,
      width: originalWidths[sourceColumn - 1]?.width,
    };
  });

  const columnByFieldKey = Object.fromEntries(
    orderedFields.map((field, index) => [field.key, index + 1]),
  );
  const markerRow = worksheet.getRow(markerRowNumber);
  markerRow.hidden = true;
  for (
    let column = orderedFields.length + 1;
    column <= oldColumnCount;
    column += 1
  ) {
    markerRow.getCell(column).value = null;
    worksheet.getCell(detectedMapping.headerRow, column).value = null;
    for (
      let rowNumber = detectedMapping.dataStartRow;
      rowNumber <= worksheet.rowCount;
      rowNumber += 1
    ) {
      worksheet.getCell(rowNumber, column).value = null;
    }
  }

  orderedFields.forEach((field, index) => {
    const column = index + 1;
    const markerCell = markerRow.getCell(column);
    const headerCell = worksheet.getCell(detectedMapping.headerRow, column);
    const dataCell = worksheet.getCell(detectedMapping.dataStartRow, column);
    const styles = styleByField[index];

    if (styles.headerStyle && typeof styles.headerStyle === 'object') {
      headerCell.style = structuredClone(styles.headerStyle);
    }
    if (styles.dataStyle && typeof styles.dataStyle === 'object') {
      dataCell.style = structuredClone(styles.dataStyle);
    }
    markerCell.value = `${SPREADSHEET_FIELD_MARKER}${field.key}`;
    headerCell.value = field.label;
  });

  worksheet.columns = orderedFields.map((field, index) => ({
    width: Math.min(
      Math.max(styleByField[index].width ?? 0, field.label.length + 4, 16),
      36,
    ),
  }));

  return {
    ...detectedMapping,
    columnByFieldKey,
  };
}

function hasFieldMarkerRow(
  worksheet: SpreadsheetWorkbook['worksheets'][number],
  rowNumber: number,
): boolean {
  if (rowNumber < 1) return false;
  let hasMarker = false;
  worksheet.getRow(rowNumber).eachCell?.({ includeEmpty: false }, (cell) => {
    if (String(cell.value ?? '').startsWith(SPREADSHEET_FIELD_MARKER)) {
      hasMarker = true;
    }
  });
  return hasMarker;
}

export function mapMaterialImportRows(
  rows: SpreadsheetDataRow[],
  models: MaterialModel[],
  custodians: Custodian[],
  fields: SpreadsheetField<Material>[],
  translate: TranslateMaterialSpreadsheetMessage,
): MaterialImportRow[] {
  const usedCodes = new Set<string>();
  return rows.map((row) => {
    const code = valueOf(row, 'material.code');
    const normalizedCode = code.toLocaleLowerCase();
    if (!code)
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate('project.materials.spreadsheet.errors.missingCode'),
      };
    if (usedCodes.has(normalizedCode)) {
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate('project.materials.spreadsheet.errors.duplicateCode'),
      };
    }
    usedCodes.add(normalizedCode);

    const modelCode = valueOf(row, 'material.model.code').toLocaleLowerCase();
    const model = models.find(
      (item) => item.code.trim().toLocaleLowerCase() === modelCode,
    );
    if (!model || !model.isActive) {
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate('project.materials.spreadsheet.errors.modelNotFound'),
      };
    }

    const ownerCode = valueOf(row, 'material.owner.code');
    const ownerName = valueOf(row, 'material.owner.name');
    const rawOwnerKind = valueOf(row, 'material.owner.kind');
    const importedOwnerKind = parseOwnerKind(rawOwnerKind, translate);
    if (rawOwnerKind && !importedOwnerKind) {
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate('project.materials.spreadsheet.errors.ownerKind'),
      };
    }
    let ownerPartyId = '';
    let ownerSnapshot: MaterialFormValues['ownerSnapshot'];
    if (importedOwnerKind === 'other') {
      const scopeCode = normalizeHeader(
        valueOf(row, 'material.owner.scope.code'),
      );
      const scope = custodians.find(
        (item) =>
          item.isActive &&
          item.canManageMaterial &&
          item.canRepresent &&
          ['department', 'team', 'person'].includes(item.type) &&
          normalizeHeader(item.code) === scopeCode,
      );
      if (!ownerName || !scope) {
        return {
          rowNumber: row.rowNumber,
          code,
          values: null,
          error: translate(
            'project.materials.spreadsheet.errors.ownerNotFound',
          ),
        };
      }
      ownerSnapshot = {
        kind: 'other',
        code: ownerCode,
        name: ownerName,
        representativeName: valueOf(row, 'material.owner.representativeName'),
        phone: valueOf(row, 'material.owner.phone'),
        email: valueOf(row, 'material.owner.email'),
        scopePartyId: scope.id,
      };
    } else {
      let owner: Custodian | undefined;
      if (ownerCode) {
        owner = custodians.find(
          (item) =>
            item.isActive &&
            normalizeHeader(item.code) === normalizeHeader(ownerCode),
        );
      } else if (ownerName) {
        const nameMatches = custodians.filter(
          (item) =>
            item.isActive &&
            normalizeHeader(item.name) === normalizeHeader(ownerName),
        );
        if (nameMatches.length === 1) owner = nameMatches[0];
      }
      if (
        !owner ||
        owner.type === 'other' ||
        !owner.canManageMaterial ||
        !owner.canRepresent
      ) {
        return {
          rowNumber: row.rowNumber,
          code,
          values: null,
          error: translate(
            'project.materials.spreadsheet.errors.ownerNotFound',
          ),
        };
      }
      const inferredKind =
        owner.type === 'external'
          ? 'external'
          : owner.type === 'warehouse'
            ? 'warehouse'
            : 'eps';
      if (importedOwnerKind && importedOwnerKind !== inferredKind) {
        return {
          rowNumber: row.rowNumber,
          code,
          values: null,
          error: translate(
            'project.materials.spreadsheet.errors.ownerNotFound',
          ),
        };
      }
      ownerPartyId = owner.id;
      ownerSnapshot = {
        kind: inferredKind,
        code: owner.code,
        name: ownerName || owner.name,
        representativeName:
          valueOf(row, 'material.owner.representativeName') ||
          owner.representativeName ||
          '',
        phone: valueOf(row, 'material.owner.phone') || owner.phone || '',
        email: valueOf(row, 'material.owner.email') || owner.email || '',
      };
    }

    const condition = parseCondition(valueOf(row, 'material.condition'));
    if (!condition) {
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate('project.materials.spreadsheet.errors.condition'),
      };
    }

    const specificationOverrides: Record<string, string[]> = {};
    for (const field of fields) {
      const fieldKey = field.key;
      if (!fieldKey.startsWith('material.specification.')) continue;
      const rawValue = valueOf(row, fieldKey);
      if (!rawValue) continue;
      const specificationId = fieldKey.slice('material.specification.'.length);
      const specification = model.specifications.find(
        (item) => item.id === specificationId,
      );
      if (!specification) {
        return {
          rowNumber: row.rowNumber,
          code,
          values: null,
          error: translate(
            'project.materials.spreadsheet.errors.specificationModel',
            {
              name: field.label,
            },
          ),
        };
      }
      const importedValues = specification.isList
        ? rawValue
            .split(';')
            .map((item) => item.trim())
            .filter(Boolean)
        : [rawValue];
      let normalizedValues = importedValues;
      if (specification.dataType === 'color') {
        const matchedValueIndexes = importedValues.map((value) => {
          const rawValueIndex = specification.values.findIndex(
            (candidate) =>
              normalizeHeader(candidate) === normalizeHeader(value),
          );
          if (rawValueIndex >= 0) return rawValueIndex;
          return specification.valueLabels.findIndex(
            (label) =>
              label.trim() && normalizeHeader(label) === normalizeHeader(value),
          );
        });
        if (matchedValueIndexes.some((valueIndex) => valueIndex < 0)) {
          return {
            rowNumber: row.rowNumber,
            code,
            values: null,
            error: translate(
              'project.materials.spreadsheet.errors.specificationValue',
              { name: field.label },
            ),
          };
        }
        normalizedValues = matchedValueIndexes.map(
          (valueIndex) => specification.values[valueIndex],
        );
      }
      if (
        normalizedValues.length === 1 &&
        specification.values.length === 1 &&
        normalizedValues[0] === specification.values[0]
      ) {
        continue;
      }
      specificationOverrides[specificationId] = normalizedValues;
    }

    const candidate = {
      code,
      modelId: model.id,
      nameOverride:
        valueOf(row, 'material.nameOverride') === model.name
          ? ''
          : valueOf(row, 'material.nameOverride'),
      descriptionOverride:
        valueOf(row, 'material.descriptionOverride') === model.description
          ? ''
          : valueOf(row, 'material.descriptionOverride'),
      serialNumber: valueOf(row, 'material.serialNumber'),
      ownerPartyId,
      ownerSnapshot,
      condition,
      note: valueOf(row, 'material.note'),
      specificationOverrides,
      specificationOverrideLabels: {},
    };
    const parsed = materialFormSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate('project.materials.spreadsheet.errors.formInvalid'),
      };
    }
    return {
      rowNumber: row.rowNumber,
      code,
      values: parsed.data,
      error: null,
    };
  });
}

function parseCondition(value: string): MaterialCondition | null {
  const normalized = value.trim().toLocaleLowerCase();
  if (!normalized || normalized === 'còn tốt' || normalized === 'good')
    return 'good';
  if (normalized === 'hỏng hóc' || normalized === 'damaged') return 'damaged';
  return null;
}

function parseOwnerKind(
  value: string,
  translate: TranslateMaterialSpreadsheetMessage,
): MaterialOwnerKind | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;

  const kinds: MaterialOwnerKind[] = ['eps', 'external', 'warehouse', 'other'];
  return (
    kinds.find(
      (kind) =>
        normalized === normalizeHeader(kind) ||
        normalized ===
          normalizeHeader(
            translate(`project.handover.partyDialog.kind.${kind}`),
          ),
    ) ?? null
  );
}

function valueOf(row: SpreadsheetDataRow, key: string): string {
  return row.values[key]?.trim() ?? '';
}
