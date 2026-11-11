import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadMaterialSafetyInspectionQueue,
  loadMaterialSafetyInspections,
  loadSafetyInspection,
  loadSafetyInspectionList,
  saveMaterialSafetyInspection,
  startMaterialSafetyInspectionDraft,
} from '../api/safety-inspections.api';
import type {
  MaterialSafetyInspectionQueueFilters,
  SafetyInspectionAttachment,
  SafetyInspectionFormValues,
  SafetyInspectionListFilters,
} from '../model/safety-inspection';
import type { SafetyInspectionChecklistGroup } from '../model/safety-inspection-checklist';

export const safetyInspectionKeys = {
  all: ['project', 'material-safety-inspections'] as const,
  queue: (filters: MaterialSafetyInspectionQueueFilters) =>
    [...safetyInspectionKeys.all, 'queue', filters] as const,
  management: (filters: SafetyInspectionListFilters) =>
    [...safetyInspectionKeys.all, 'management', filters] as const,
  list: (materialId: string) =>
    [...safetyInspectionKeys.all, 'material', materialId] as const,
  detail: (inspectionId: string) =>
    [...safetyInspectionKeys.all, 'detail', inspectionId] as const,
};

export function useMaterialSafetyInspectionQueueQuery(
  filters: MaterialSafetyInspectionQueueFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: safetyInspectionKeys.queue(filters),
    queryFn: ({ signal }) => loadMaterialSafetyInspectionQueue(filters, signal),
    enabled,
    retry: 0,
  });
}

export function useSafetyInspectionListQuery(
  filters: SafetyInspectionListFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: safetyInspectionKeys.management(filters),
    queryFn: ({ signal }) => loadSafetyInspectionList(filters, signal),
    enabled,
    retry: 0,
  });
}

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

export function useStartMaterialSafetyInspectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      materialId: string;
      checklist: SafetyInspectionChecklistGroup[];
      inspectorName: string;
      inspectedAt: string;
    }) =>
      startMaterialSafetyInspectionDraft(
        input.materialId,
        input.checklist,
        input.inspectorName,
        input.inspectedAt,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: safetyInspectionKeys.all }),
  });
}

export function useSaveMaterialSafetyInspectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      inspectionId: string;
      materialId: string;
      values: SafetyInspectionFormValues;
      attachments: SafetyInspectionAttachment[];
      files: File[];
      complete: boolean;
    }) => saveMaterialSafetyInspection(input),
    onSuccess: (_result, input) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: safetyInspectionKeys.all }),
        queryClient.invalidateQueries({
          queryKey: safetyInspectionKeys.detail(input.inspectionId),
        }),
      ]),
  });
}
