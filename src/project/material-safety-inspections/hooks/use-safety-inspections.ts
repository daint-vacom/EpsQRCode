import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMaterialSafetyInspection,
  loadMaterialSafetyInspections,
  loadSafetyInspection,
} from '../api/safety-inspections.api';
import type { SafetyInspectionFormValues } from '../model/safety-inspection';

export const safetyInspectionKeys = {
  all: ['project', 'material-safety-inspections'] as const,
  list: (materialId: string) =>
    [...safetyInspectionKeys.all, 'material', materialId] as const,
  detail: (inspectionId: string) =>
    [...safetyInspectionKeys.all, 'detail', inspectionId] as const,
};

export function useMaterialSafetyInspectionsQuery(
  materialId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: safetyInspectionKeys.list(materialId),
    queryFn: ({ signal }) => loadMaterialSafetyInspections(materialId, signal),
    enabled: Boolean(materialId) && enabled,
    retry: 0,
  });
}

export function useSafetyInspectionQuery(inspectionId: string, enabled = true) {
  return useQuery({
    queryKey: safetyInspectionKeys.detail(inspectionId),
    queryFn: ({ signal }) => loadSafetyInspection(inspectionId, signal),
    enabled: Boolean(inspectionId) && enabled,
    retry: 0,
  });
}

export function useCreateMaterialSafetyInspectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      materialId,
      values,
      files,
    }: {
      materialId: string;
      values: SafetyInspectionFormValues;
      files: File[];
    }) => createMaterialSafetyInspection(materialId, values, files),
    onSuccess: (_id, variables) =>
      queryClient.invalidateQueries({
        queryKey: safetyInspectionKeys.list(variables.materialId),
      }),
  });
}
