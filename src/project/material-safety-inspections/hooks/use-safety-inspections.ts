import { pendingDocumentCountsKey } from '@/project/layout/use-my-pending-document-counts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  loadMaterialSafetyInspectionPlan,
  loadMaterialSafetyInspectionQueue,
  loadMaterialSafetyInspections,
  loadSafetyInspection,
  loadSafetyInspectionFilterSummary,
  loadSafetyInspectionList,
  saveMaterialSafetyInspection,
  startMaterialSafetyInspectionDraft,
} from '../api/safety-inspections.api';
import type {
  MaterialSafetyInspectionPlanFilters,
  MaterialSafetyInspectionQueueFilters,
  SafetyInspectionAttachment,
  SafetyInspectionFormValues,
  SafetyInspectionListFilters,
} from '../model/safety-inspection';
import type { SafetyInspectionChecklistGroup } from '../model/safety-inspection-checklist';

export const safetyInspectionKeys = {
  all: ['project', 'material-safety-inspections'] as const,
  queue: (
    userId: string | null,
    filters: MaterialSafetyInspectionQueueFilters,
  ) => [...safetyInspectionKeys.all, 'queue', userId, filters] as const,
  plan: (userId: string | null, filters: MaterialSafetyInspectionPlanFilters) =>
    [...safetyInspectionKeys.all, 'plan', userId, filters] as const,
  management: (filters: SafetyInspectionListFilters) =>
    [...safetyInspectionKeys.all, 'management', filters] as const,
  managementSummary: (userId: string | null, search: string) =>
    [
      ...safetyInspectionKeys.all,
      'management-summary',
      userId,
      search,
    ] as const,
  list: (materialId: string) =>
    [...safetyInspectionKeys.all, 'material', materialId] as const,
  detail: (inspectionId: string) =>
    [...safetyInspectionKeys.all, 'detail', inspectionId] as const,
};

export function useMaterialSafetyInspectionQueueQuery(
  filters: MaterialSafetyInspectionQueueFilters,
  enabled = true,
) {
  const { userId } = useUser();

  return useQuery({
    queryKey: safetyInspectionKeys.queue(userId, filters),
    queryFn: ({ signal }) => loadMaterialSafetyInspectionQueue(filters, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
    retry: 0,
  });
}

export function useMaterialSafetyInspectionPlanQuery(
  filters: MaterialSafetyInspectionPlanFilters,
  enabled = true,
) {
  const { userId } = useUser();

  return useQuery({
    queryKey: safetyInspectionKeys.plan(userId, filters),
    queryFn: ({ signal }) => loadMaterialSafetyInspectionPlan(filters, signal),
    enabled,
    retry: 0,
  });
}

export function useSafetyInspectionListQuery(
  filters: SafetyInspectionListFilters,
  enabled = true,
) {
  const { userId } = useUser();
  return useQuery({
    queryKey: [...safetyInspectionKeys.management(filters), userId],
    queryFn: ({ signal }) => loadSafetyInspectionList(filters, signal),
    enabled,
    retry: 0,
  });
}

export function useSafetyInspectionFilterSummaryQuery(
  search: string,
  enabled = true,
) {
  const { userId } = useUser();

  return useQuery({
    queryKey: safetyInspectionKeys.managementSummary(userId, search),
    queryFn: ({ signal }) => loadSafetyInspectionFilterSummary(search, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
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
      Promise.all([
        queryClient.invalidateQueries({ queryKey: pendingDocumentCountsKey }),
        queryClient.invalidateQueries({ queryKey: safetyInspectionKeys.all }),
      ]),
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
        queryClient.invalidateQueries({ queryKey: pendingDocumentCountsKey }),
        queryClient.invalidateQueries({ queryKey: safetyInspectionKeys.all }),
        queryClient.invalidateQueries({
          queryKey: safetyInspectionKeys.detail(input.inspectionId),
        }),
      ]),
  });
}
