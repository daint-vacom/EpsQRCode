import type { Custodian } from '@/project/custodians/model/custodian';
import type { MaterialGroup } from '@/project/material-groups/model/material-group';
import type { MaterialModel } from '@/project/material-models/model/material-model';
import type {
  SpreadsheetDataRow,
  SpreadsheetField,
  SpreadsheetMapping,
  SpreadsheetWorkbook,
} from '@/lib/spreadsheets/xlsx';
import {
  detectSpreadsheetExportMapping,
  getSpreadsheetHeaders,
  normalizeHeader,
  suggestSpreadsheetMapping,
} from '@/lib/spreadsheets/xlsx';
import { materialFormSchema } from '../forms/material-form.schema';
import type {
  Material,
  MaterialCondition,
  MaterialFormValues,
  MaterialOwnerKind,
} from '../model/material';
import type { MaterialCapitalSource } from '../model/material-capital-source';

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

// Keep these numeric identifiers stable even when localized enum labels change.
const OWNER_KIND_ENUM_CODES: Record<MaterialOwnerKind, number> = {
  eps: 1,
  external: 2,
  warehouse: 3,
  other: 4,
};

function formatNumberedEnum(code: number, label: string) {
  return `${code} - ${label}`;
}

export function getMaterialSpreadsheetFields(
  models: MaterialModel[],
  custodians: Custodian[],
  translate: TranslateMaterialSpreadsheetMessage,
  groups: MaterialGroup[] = [],
  capitalSources: MaterialCapitalSource[] = [],
): SpreadsheetField<Material>[] {
  const fields: SpreadsheetField<Material>[] = [
    {
      key: 'material.code',
      label: translate('project.materials.spreadsheet.fields.code'),
      required: true,
      read: (row) => row.code,
    },
    {
      key: 'material.quantity',
      label: translate('project.materials.spreadsheet.fields.quantity'),
      headerAliases: ['Quantity', 'Qty'],
      read: () => 1,
    },
    {
      key: 'material.model.code',
      label: translate('project.materials.spreadsheet.fields.modelCode'),
      required: true,
      read: (row) => row.modelSnapshot.code,
    },
    {
      key: 'material.model.name',
      label: translate('project.materials.spreadsheet.fields.modelName'),
      read: (row) => row.modelSnapshot.name,
    },
    {
      key: 'material.model.group.code',
      label: translate('project.materials.spreadsheet.fields.modelGroupCode'),
      read: (row) =>
        groups.find((group) => group.id === row.modelSnapshot.groupId)?.code ??
        '',
    },
    {
      key: 'material.model.description',
      label: translate('project.materials.spreadsheet.fields.modelDescription'),
      read: (row) => row.modelSnapshot.description,
    },
    {
      key: 'material.model.manufacturer',
      label: translate('materialModels.fields.manufacturer'),
      read: (row) => row.modelSnapshot.manufacturer,
    },
    {
      key: 'material.model.unit',
      label: translate('materialModels.fields.unit'),
      read: (row) => row.modelSnapshot.unit,
    },
    {
      key: 'material.model.unitPriceDefault',
      label: translate('materialModels.fields.unitPriceDefault'),
      read: (row) => row.modelSnapshot.unitPriceDefault,
    },
    {
      key: 'material.model.externalCodes',
      label: translate('materialModels.fields.externalCodes'),
      read: (row) => row.modelSnapshot.externalCodes.join('\n'),
    },
    {
      key: 'material.model.specifications',
      label: translate(
        'project.materials.spreadsheet.fields.modelSpecifications',
      ),
      read: (row) =>
        row.modelSnapshot.specifications
          .map((specification) => {
            const values = specification.values
              .map(
                (value, index) =>
                  specification.valueLabels[index]?.trim() || value,
              )
              .filter(Boolean);
            return values.length > 0
              ? `${specification.name}: ${values.join('; ')}`
              : '';
          })
          .filter(Boolean)
          .join('\n'),
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
      key: 'material.placedIntoServiceDate',
      label: translate('project.materials.fields.placedIntoServiceDate'),
      read: (row) => row.placedIntoServiceDate,
    },
    {
      key: 'material.capitalSource.code',
      label: translate('project.materials.fields.capitalSource'),
      read: (row) =>
        capitalSources.find((source) => source.id === row.capitalSourceId)
          ?.code ?? '',
    },
    {
      key: 'material.unitPriceOverride',
      label: translate('project.materials.fields.unitPriceOverride'),
      read: (row) => row.unitPriceOverride,
    },
    {
      key: 'material.isActive',
      label: translate('materialModels.fields.availability'),
      read: (row) => (row.isActive ? 'Có' : 'Không'),
    },
    {
      key: 'material.condition',
      label: translate('project.materials.fields.condition'),
      headerAliases: [
        translate('project.materials.spreadsheet.fields.conditionLegacy'),
      ],
      read: (row) =>
        formatNumberedEnum(
          row.condition === 'good' ? 1 : 2,
          translate(`project.materials.condition.${row.condition}`),
        ),
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
      markerAliases: [`material.specification.slot.${index + 1}`],
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

  const specificationFields = fields.filter((field) =>
    field.key.startsWith('material.specification.'),
  );
  fields.push({
    key: 'material.specifications',
    label: translate('project.materials.fields.specifications'),
    read: (material) =>
      specificationFields
        .map((field) => {
          const value = field.read(material);
          return value === null || value === ''
            ? ''
            : `${field.label}: ${String(value)}`;
        })
        .filter(Boolean)
        .join('\n'),
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
        formatNumberedEnum(
          OWNER_KIND_ENUM_CODES[row.ownerSnapshot.kind],
          translate(
            `project.handover.partyDialog.kind.${row.ownerSnapshot.kind}`,
          ),
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

export function getMaterialSpreadsheetExportFields(
  fields: SpreadsheetField<Material>[],
  translate: TranslateMaterialSpreadsheetMessage,
): SpreadsheetField<Material>[] {
  const specificationField = fields.find(
    (field) => field.key === 'material.specifications',
  );
  if (!specificationField) return fields;

  const legacySlotAliases = [1, 2, 3].flatMap((index) => [
    translate('project.materials.spreadsheet.fields.specificationSlot', {
      index: String(index),
    }),
    translate('project.materials.spreadsheet.fields.specificationShortSlot', {
      index: String(index),
    }),
  ]);
  const exportSpecificationField: SpreadsheetField<Material> = {
    ...specificationField,
    markerAliases: ['material.specification.slot.1'],
    headerAliases: legacySlotAliases,
  };

  return fields
    .filter((field) => !field.key.startsWith('material.specification.'))
    .map((field) =>
      field.key === 'material.specifications'
        ? exportSpecificationField
        : field,
    );
}

export function prepareMaterialExportMapping(
  workbook: SpreadsheetWorkbook,
  fields: SpreadsheetField<Material>[],
  repairMarkerHeaderMismatch = false,
): SpreadsheetMapping | null {
  const markerMapping = detectSpreadsheetExportMapping(workbook, fields);
  if (!markerMapping) return null;

  const worksheet = workbook.getWorksheet(markerMapping.worksheetName);
  if (!worksheet) return markerMapping;

  const headers = getSpreadsheetHeaders(worksheet, markerMapping.headerRow);
  const headerMapping = suggestSpreadsheetMapping(
    worksheet,
    fields,
    markerMapping.headerRow,
  );
  const specificationField = fields.find(
    (field) => field.key === 'material.specifications',
  );
  const legacySpecificationLabels = new Set(
    (specificationField?.headerAliases ?? []).map(normalizeHeader),
  );
  const hasLegacySpecificationHeaders = headers.some((header) =>
    legacySpecificationLabels.has(normalizeHeader(header.label)),
  );
  const markerAndHeaderColumnsDiffer = fields.some(
    (field) =>
      markerMapping.columnByFieldKey[field.key] !==
      headerMapping.columnByFieldKey[field.key],
  );
  const canRepairFromHeaders =
    repairMarkerHeaderMismatch &&
    markerAndHeaderColumnsDiffer &&
    hasLegacySpecificationHeaders &&
    fields.every((field) => headerMapping.columnByFieldKey[field.key]) &&
    Boolean(headerMapping.columnByFieldKey['material.code']) &&
    Boolean(headerMapping.columnByFieldKey['material.model.code']);
  const mapping: SpreadsheetMapping = canRepairFromHeaders
    ? {
        ...headerMapping,
        worksheetName: markerMapping.worksheetName,
        markerRow: markerMapping.markerRow,
        rewriteMarkerRow: true,
        rewriteHeaderLabels: true,
      }
    : { ...markerMapping };

  const specificationColumn =
    mapping.columnByFieldKey['material.specifications'];
  const hiddenColumns = headers
    .filter(
      (header) =>
        header.column !== specificationColumn &&
        legacySpecificationLabels.has(normalizeHeader(header.label)),
    )
    .map((header) => header.column);
  if (hiddenColumns.length > 0) {
    mapping.hiddenColumns = [
      ...new Set([...(mapping.hiddenColumns ?? []), ...hiddenColumns]),
    ];
    mapping.rewriteMarkerRow = mapping.markerRow !== undefined;
    mapping.rewriteHeaderLabels = true;
  }

  if (mapping.markerRow !== undefined) {
    const spacerStart = mapping.markerRow + 1;
    mapping.dataStartRow = Math.max(spacerStart, 4);
    mapping.clearedRows = Array.from(
      { length: mapping.dataStartRow - spacerStart },
      (_, index) => spacerStart + index,
    );
  }

  return mapping;
}

export function mapMaterialImportRows(
  rows: SpreadsheetDataRow[],
  models: MaterialModel[],
  custodians: Custodian[],
  fields: SpreadsheetField<Material>[],
  translate: TranslateMaterialSpreadsheetMessage,
  capitalSources: MaterialCapitalSource[] = [],
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

    const combinedSpecifications = parseCombinedSpecifications(
      valueOf(row, 'material.specifications'),
      model,
    );
    if (combinedSpecifications.errorName) {
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate(
          'project.materials.spreadsheet.errors.specificationModel',
          { name: combinedSpecifications.errorName },
        ),
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

    const capitalSourceCode = valueOf(row, 'material.capitalSource.code');
    const capitalSource = capitalSourceCode
      ? capitalSources.find(
          (item) =>
            item.isActive &&
            (normalizeHeader(item.code) ===
              normalizeHeader(capitalSourceCode) ||
              normalizeHeader(item.name) ===
                normalizeHeader(capitalSourceCode)),
        )
      : undefined;
    if (capitalSourceCode && !capitalSource) {
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate('project.materials.spreadsheet.errors.capitalSource'),
      };
    }

    const rawIsActive = normalizeHeader(valueOf(row, 'material.isActive'));
    const isActive = parseBoolean(rawIsActive);
    if (rawIsActive && isActive === null) {
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate('project.materials.spreadsheet.errors.availability'),
      };
    }
    const rawUnitPrice = valueOf(row, 'material.unitPriceOverride');
    const unitPriceOverride = parseLocalizedAmount(rawUnitPrice);
    if (rawUnitPrice && unitPriceOverride === null) {
      return {
        rowNumber: row.rowNumber,
        code,
        values: null,
        error: translate('project.materials.spreadsheet.errors.unitPrice'),
      };
    }

    const specificationOverrides: Record<string, string[]> = {};
    for (const specification of model.specifications) {
      const specificationId = specification.id;
      const fieldKey = `material.specification.${specificationId}`;
      const field = fields.find((item) => item.key === fieldKey);
      const rawValue = valueOf(row, fieldKey);
      const combinedValues =
        combinedSpecifications.valuesBySpecificationId.get(specificationId);
      const importedValues = rawValue
        ? specification.isList
          ? rawValue
              .split(';')
              .map((item) => item.trim())
              .filter(Boolean)
          : [rawValue]
        : (combinedValues ?? []);
      if (importedValues.length === 0) continue;
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
              { name: field?.label ?? specification.name },
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

    const pendingModel = model.id.startsWith('pending:');
    const candidate = {
      code,
      // New models use a temporary non-UUID ID in the preview. Validate the
      // rest of the material form against a UUID, then restore the temporary
      // ID so the import flow can resolve it after creating the model.
      modelId: pendingModel ? '00000000-0000-4000-8000-000000000000' : model.id,
      nameOverride:
        valueOf(row, 'material.nameOverride') === model.name
          ? ''
          : valueOf(row, 'material.nameOverride'),
      descriptionOverride:
        valueOf(row, 'material.descriptionOverride') === model.description
          ? ''
          : valueOf(row, 'material.descriptionOverride'),
      unit: model.unit,
      serialNumber: valueOf(row, 'material.serialNumber'),
      placedIntoServiceDate: parseSpreadsheetDate(
        valueOf(row, 'material.placedIntoServiceDate'),
      ),
      capitalSourceId: capitalSource?.id ?? '',
      unitPriceOverride,
      isActive: isActive ?? true,
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
      values: pendingModel
        ? { ...parsed.data, modelId: model.id }
        : parsed.data,
      error: null,
    };
  });
}

function parseCondition(value: string): MaterialCondition | null {
  const code = parseNumberedEnumCode(value);
  if (code === 1) return 'good';
  if (code === 2) return 'damaged';

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
  const code = parseNumberedEnumCode(value);
  const kindByCode: Record<number, MaterialOwnerKind> = {
    1: 'eps',
    2: 'external',
    3: 'warehouse',
    4: 'other',
  };
  if (code !== null) return kindByCode[code] ?? null;

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

function parseNumberedEnumCode(value: string): number | null {
  const match = value.trim().match(/^(\d+)(?:\s*-\s*.*)?$/);
  if (!match?.[1]) return null;
  const code = Number(match[1]);
  return Number.isInteger(code) ? code : null;
}

function valueOf(row: SpreadsheetDataRow, key: string): string {
  return row.values[key]?.trim() ?? '';
}

function parseBoolean(value: string): boolean | null {
  if (['co', 'yes', 'true', '1', 'active'].includes(value)) return true;
  if (['khong', 'no', 'false', '0', 'inactive'].includes(value)) return false;
  return null;
}

function parseLocalizedAmount(value: string): number | null {
  const normalized = value.replace(/\s|₫|vnd/gi, '').trim();
  if (!normalized) return null;
  let numeric = normalized.replace(/[^\d.,+-]/g, '');
  const lastComma = numeric.lastIndexOf(',');
  const lastDot = numeric.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalPosition = Math.max(lastComma, lastDot);
    const decimals = numeric.length - decimalPosition - 1;
    numeric =
      numeric.slice(0, decimalPosition).replace(/[.,]/g, '') +
      (decimals > 0 && decimals <= 2
        ? `.${numeric.slice(decimalPosition + 1)}`
        : '');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const position = Math.max(lastComma, lastDot);
    const decimals = numeric.length - position - 1;
    if (decimals > 0 && decimals <= 2) {
      numeric = `${numeric.slice(0, position).replace(/[.,]/g, '')}.${numeric.slice(position + 1)}`;
    } else {
      numeric = numeric.replace(/[.,]/g, '');
    }
  }
  const parsed = Number(numeric);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseSpreadsheetDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const isoDate = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoDate?.[1] && isoDate[2] && isoDate[3]) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, '0')}-${isoDate[3].padStart(2, '0')}`;
  }
  const vietnameseDate = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (vietnameseDate?.[1] && vietnameseDate[2] && vietnameseDate[3]) {
    return `${vietnameseDate[3]}-${vietnameseDate[2].padStart(2, '0')}-${vietnameseDate[1].padStart(2, '0')}`;
  }
  return trimmed;
}

function parseCombinedSpecifications(
  rawValue: string,
  model: MaterialModel,
): {
  valuesBySpecificationId: Map<string, string[]>;
  errorName: string | null;
} {
  const valuesBySpecificationId = new Map<string, string[]>();
  for (const line of rawValue.split(/\r?\n/).map((value) => value.trim())) {
    if (!line) continue;
    const separator = line.indexOf(':');
    const name = separator >= 0 ? line.slice(0, separator).trim() : line;
    const value = separator >= 0 ? line.slice(separator + 1).trim() : '';
    const matches = model.specifications.filter(
      (specification) =>
        normalizeHeader(specification.name) === normalizeHeader(name),
    );
    if (separator < 0 || !value || matches.length !== 1) {
      return { valuesBySpecificationId, errorName: name };
    }
    const specification = matches[0];
    if (!specification) continue;
    const parsedValues = specification.isList
      ? value
          .split(';')
          .map((item) => item.trim())
          .filter(Boolean)
      : [value];
    if (valuesBySpecificationId.has(specification.id)) {
      return { valuesBySpecificationId, errorName: name };
    }
    valuesBySpecificationId.set(specification.id, parsedValues);
  }
  return { valuesBySpecificationId, errorName: null };
}
