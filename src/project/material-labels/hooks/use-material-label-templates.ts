import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  loadMaterialLabelPrintSnapshot,
  loadMaterialLabelTemplateFilterSummary,
  loadMaterialLabelTemplatePreferences,
  loadMaterialLabelTemplates,
  saveMaterialLabelTemplate,
  saveMaterialLabelTemplatePreferences,
} from '../api/material-label-templates.api';
import type {
  MaterialLabelTemplate,
  MaterialLabelTemplateInput,
} from '../model/material-label-template';

export const materialLabelTemplateKeys = {
  all: ['project', 'material-label-templates'] as const,
  preferences: (materialIds: string[]) =>
    [
      ...materialLabelTemplateKeys.all,
      'preferences',
      [...materialIds].sort(),
    ] as const,
  filterSummary: (userId: string | null, search: string) =>
    [
      ...materialLabelTemplateKeys.all,
      'filter-summary',
      userId,
      search,
    ] as const,
  lastPrint: (materialId: string) =>
    [...materialLabelTemplateKeys.all, 'last-print', materialId] as const,
};

export function useMaterialLabelTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: materialLabelTemplateKeys.all,
    queryFn: ({ signal }) => loadMaterialLabelTemplates(signal),
    enabled,
    retry: 0,
    staleTime: 60_000,
  });
}

export function useMaterialLabelTemplateFilterSummaryQuery(
  search: string,
  enabled = true,
) {
  const { userId } = useUser();
  return useQuery({
    queryKey: materialLabelTemplateKeys.filterSummary(userId, search),
    queryFn: ({ signal }) =>
      loadMaterialLabelTemplateFilterSummary(search, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
    retry: 0,
  });
}

export function useMaterialLabelPrintSnapshotQuery(
  materialId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: materialLabelTemplateKeys.lastPrint(materialId),
    queryFn: ({ signal }) => loadMaterialLabelPrintSnapshot(materialId, signal),
    enabled: enabled && Boolean(materialId),
    retry: 0,
    staleTime: 60_000,
  });
}

export function useMaterialLabelTemplatePreferencesQuery(
  materialIds: string[],
  enabled = true,
) {
  return useQuery({
    queryKey: materialLabelTemplateKeys.preferences(materialIds),
    queryFn: ({ signal }) =>
      loadMaterialLabelTemplatePreferences(materialIds, signal),
    enabled: enabled && materialIds.length > 0,
    retry: 0,
    staleTime: 60_000,
  });
}

export function useSaveMaterialLabelTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MaterialLabelTemplateInput) =>
      saveMaterialLabelTemplate(input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: materialLabelTemplateKeys.all,
      }),
  });
}

export function useSaveMaterialLabelTemplatePreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      materialIds,
      template,
      previews,
    }: {
      materialIds: string[];
      template: MaterialLabelTemplate;
      previews: Record<string, string>;
    }) => saveMaterialLabelTemplatePreferences(materialIds, template, previews),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: materialLabelTemplateKeys.all,
      }),
  });
}
