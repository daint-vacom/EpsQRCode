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
import type { Material } from '../model/material';
import type { MaterialCapitalSource } from '../model/material-capital-source';
import {
  mapMaterialImportRows,
  type MaterialImportRow,
} from './material-spreadsheet';

export const MATERIAL_IMPORT_REQUIRED_FIELD_KEYS = [
  'material.code',
  'material.model.code',
  'material.owner.name',
] as const;

export interface MaterialSpreadsheetSource {
  id: string;
  file: File;
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
  excelRow: number;
  code: string;
  modelCode: string;
  modelName: string;
  name: string;
  description: string;
  serialNumber: string;
  condition: string;
  specifications: string;
  ownerCode: string;
  ownerName: string;
  note: string;
  isValid: boolean;
  error: string;
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
  modelCode: string;
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

  return Array.from(rowsByModelCode.values())
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
      const externalCodesText = Array.from(
        new Set(
          modelRows
            .flatMap((row) =>
              valueOf(row, 'material.model.externalCodes')
                .split(/\r?\n/)
                .map((item) => item.trim()),
            )
            .filter(Boolean),
        ),
      ).join('\n');
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
        externalCodesText,
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
        externalCodes: externalCodesText.split(/\r?\n/).filter(Boolean),
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

  return mapped.map((row, index) => {
    const sourceRow = sourceRows[index];
    const source = sourceRow?.source;
    const rawValues = sourceRow?.row.values ?? {};
    const modelCode = valueOf(sourceRow?.row, 'material.model.code');
    const proposal = modelProposals.find(
      (item) => normalizeHeader(item.code) === normalizeHeader(modelCode),
    );
    const error = proposal?.error ? proposal.error : row.error;
    return {
      ...row,
      id: `${source?.id ?? 'file'}:${sourceRow?.row.rowNumber ?? row.rowNumber}:${sourceRow?.index ?? index}`,
      sourceId: source?.id ?? '',
      fileName: source?.file.name ?? '',
      rawValues,
      modelCode,
      error,
    };
  });
}

export function toMaterialImportPreviewRows(
  rows: MappedMaterialImportRow[],
  models: MaterialModel[],
  proposals: MaterialModelImportProposal[],
): MaterialSpreadsheetImportPreviewRow[] {
  return rows.map((row) => {
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
      code: row.code,
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
      specifications: valueOf(row.rawValues, 'material.specifications'),
      ownerCode: valueOf(row.rawValues, 'material.owner.code'),
      ownerName: valueOf(row.rawValues, 'material.owner.name'),
      note: valueOf(row.rawValues, 'material.note'),
      isValid: row.values !== null && !row.error,
      error: row.error ?? '',
    };
  });
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
