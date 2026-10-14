import { useEffect, useState } from 'react';
import { INSPECTION_TABLES_MOCK } from '../data/inspection-tables.mock';
import { EXAMPLE_MATERIAL_MODELS_MOCK } from '../data/material-models.mock';
import { MATERIALS_MOCK } from '../data/materials.mock';
import type { InspectionTable } from '../model/inspection-table';
import type { Material } from '../model/material';
import type { ExampleMaterialModel } from '../model/material-model';

let inspectionTables = [...INSPECTION_TABLES_MOCK];
let materials = [...MATERIALS_MOCK];
let exampleMaterialModels: ExampleMaterialModel[] =
  EXAMPLE_MATERIAL_MODELS_MOCK.map((model, index) => ({
    ...model,
    isActive: true,
    createdAt: new Date(Date.UTC(2026, 5, 1 + index)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 5, 1 + index)).toISOString(),
  }));
let inspectionTableSeq = 0;
let materialSeq = 0;
let exampleMaterialModelSeq = 0;

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function nextMaterialId() {
  materialSeq += 1;
  return `material-new-${materialSeq}`;
}

export function nextExampleMaterialModelId() {
  exampleMaterialModelSeq += 1;
  return `model-new-${exampleMaterialModelSeq}`;
}

export function nextInspectionTableId() {
  inspectionTableSeq += 1;
  return `insp-new-${inspectionTableSeq}`;
}

export function useMaterialCatalogStore() {
  const [, setVersion] = useState(0);

  useEffect(() => subscribe(() => setVersion((version) => version + 1)), []);

  return {
    inspectionTables,
    materials,
    exampleMaterialModels,
    upsertInspectionTable(table: InspectionTable) {
      inspectionTables = inspectionTables.some((item) => item.id === table.id)
        ? inspectionTables.map((item) => (item.id === table.id ? table : item))
        : [...inspectionTables, table];
      emitChange();
    },
    removeInspectionTable(id: string) {
      inspectionTables = inspectionTables.filter((table) => table.id !== id);
      emitChange();
    },
    upsertMaterial(material: Material) {
      materials = materials.some((item) => item.id === material.id)
        ? materials.map((item) => (item.id === material.id ? material : item))
        : [material, ...materials];
      emitChange();
    },
    removeMaterial(id: string) {
      materials = materials.filter((material) => material.id !== id);
      emitChange();
    },
    upsertExampleMaterialModel(model: ExampleMaterialModel) {
      const existing = exampleMaterialModels.find(
        (item) => item.id === model.id,
      );
      const saved = {
        ...model,
        isActive: existing?.isActive ?? model.isActive,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      exampleMaterialModels = existing
        ? exampleMaterialModels.map((item) =>
            item.id === model.id ? saved : item,
          )
        : [saved, ...exampleMaterialModels];
      emitChange();
    },
    setExampleMaterialModelActive(id: string, isActive: boolean) {
      exampleMaterialModels = exampleMaterialModels.map((model) =>
        model.id === id
          ? { ...model, isActive, updatedAt: new Date().toISOString() }
          : model,
      );
      emitChange();
    },
    removeExampleMaterialModel(id: string) {
      exampleMaterialModels = exampleMaterialModels.filter(
        (model) => model.id !== id,
      );
      emitChange();
    },
  };
}
