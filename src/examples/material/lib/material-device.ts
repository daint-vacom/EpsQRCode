import type {
  Material,
  MaterialGroupKey,
  MaterialSpecValue,
} from '../model/material';
import type { ExampleMaterialModel } from '../model/material-model';
import type { SpecDefinition } from '../model/spec-definition';
import type { SpecValueSet } from '../model/spec-value-set';
import {
  resolveDefinitionForSpec,
  resolveEffectiveOptions,
  resolveEffectiveSelectionMode,
} from './resolve-effective-specs';
import {
  constrainSelectValue,
  isEmptySpecValue,
  isValidSpecValue,
} from './spec-value';

export function legacyGroupFromModelGroupId(groupId: string): MaterialGroupKey {
  if (groupId === 'grp-kiem-ke') return 'kiem-ke';
  if (groupId === 'grp-an-toan' || groupId === 'grp-pccc') return 'an-toan';
  if (groupId === 'grp-cong-cu') return 'cong-cu';
  return 'van-phong';
}

export function getModelForMaterial(
  material: Pick<Material, 'modelId'>,
  models: ExampleMaterialModel[],
): ExampleMaterialModel | undefined {
  return models.find((model) => model.id === material.modelId);
}

export function getDerivedGroupIdForMaterial(
  material: Pick<Material, 'modelId'>,
  models: ExampleMaterialModel[],
): string | undefined {
  return getModelForMaterial(material, models)?.groupId;
}

export function buildMaterialSpecValues(
  model: ExampleMaterialModel,
  specValues: MaterialSpecValue[],
  definitions: SpecDefinition[],
  valueSets: SpecValueSet[],
): MaterialSpecValue[] {
  const valueById = new Map(
    specValues.map((specValue) => [
      specValue.exampleMaterialModelSpecId,
      specValue.value,
    ]),
  );
  const context = { definitions, valueSets };

  return model.specs
    .filter((modelSpec) => modelSpec.materialValueMode === 'editable')
    .flatMap((modelSpec) => {
      const definition = resolveDefinitionForSpec(modelSpec, context);
      if (!definition) return [];

      const selectionMode = resolveEffectiveSelectionMode(
        modelSpec,
        definition,
      );
      const optionIds = resolveEffectiveOptions(
        modelSpec,
        definition,
        valueSets,
      )?.map((option) => option.id);
      const rawValue = valueById.get(modelSpec.id);
      const value = constrainSelectValue(
        definition,
        rawValue,
        optionIds,
        selectionMode,
      );

      if (
        isEmptySpecValue(value) ||
        !isValidSpecValue(definition, value, selectionMode)
      ) {
        return [];
      }

      return [{ exampleMaterialModelSpecId: modelSpec.id, value }];
    });
}

export function validateMaterialSpecValues(
  model: ExampleMaterialModel,
  specValues: MaterialSpecValue[],
  definitions: SpecDefinition[],
  valueSets: SpecValueSet[],
): string[] {
  const normalizedValues = buildMaterialSpecValues(
    model,
    specValues,
    definitions,
    valueSets,
  );
  const valueById = new Map(
    normalizedValues.map((specValue) => [
      specValue.exampleMaterialModelSpecId,
      specValue.value,
    ]),
  );
  const context = { definitions, valueSets };

  return model.specs.flatMap((modelSpec) => {
    if (!modelSpec.isRequired || modelSpec.materialValueMode === 'locked') {
      return [];
    }
    const definition = resolveDefinitionForSpec(modelSpec, context);
    const selectionMode = resolveEffectiveSelectionMode(modelSpec, definition);
    const optionIds = resolveEffectiveOptions(
      modelSpec,
      definition,
      valueSets,
    )?.map((option) => option.id);
    const rawValue =
      valueById.get(modelSpec.id) ??
      modelSpec.defaultValue ??
      definition?.defaultValue;
    const value = definition
      ? constrainSelectValue(definition, rawValue, optionIds, selectionMode)
      : undefined;

    if (
      !definition ||
      isEmptySpecValue(value) ||
      !isValidSpecValue(definition, value, selectionMode)
    ) {
      return [definition?.name ?? modelSpec.id];
    }
    return [];
  });
}
