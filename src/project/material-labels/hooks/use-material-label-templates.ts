import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadMaterialLabelTemplatePreferences,
  loadMaterialLabelTemplates,
  saveMaterialLabelTemplate,
  saveMaterialLabelTemplatePreferences,
} from '../api/material-label-templates.api';
import type { MaterialLabelTemplateInput } from '../model/material-label-template';

export const materialLabelTemplateKeys = {
  all: ['project', 'material-label-templates'] as const,
  preferences: (materialIds: string[]) =>
    [
      ...materialLabelTemplateKeys.all,
      'preferences',
      [...materialIds].sort(),
    ] as const,
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
      templateId,
    }: {
      materialIds: string[];
      templateId: string;
    }) => saveMaterialLabelTemplatePreferences(materialIds, templateId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: materialLabelTemplateKeys.all,
      }),
  });
}
