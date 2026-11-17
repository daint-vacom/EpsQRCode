import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteSpreadsheetTemplate,
  listSpreadsheetTemplates,
  loadSpreadsheetTemplate,
  saveSpreadsheetTemplate,
  type SpreadsheetTemplateKey,
} from '../api/spreadsheet-templates.api';

export const spreadsheetTemplateKeys = {
  all: ['project', 'spreadsheet-templates'] as const,
  list: (key: SpreadsheetTemplateKey) =>
    [...spreadsheetTemplateKeys.all, key, 'list'] as const,
  detail: (key: SpreadsheetTemplateKey, templateId: string | null) =>
    [...spreadsheetTemplateKeys.all, key, 'detail', templateId] as const,
};

export function useSpreadsheetTemplatesQuery(
  key: SpreadsheetTemplateKey,
  enabled = true,
) {
  return useQuery({
    queryKey: spreadsheetTemplateKeys.list(key),
    queryFn: () => listSpreadsheetTemplates(key),
    enabled,
    retry: 0,
    staleTime: 60_000,
  });
}

export function useSpreadsheetTemplateQuery(
  key: SpreadsheetTemplateKey,
  templateId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: spreadsheetTemplateKeys.detail(key, templateId),
    queryFn: () => loadSpreadsheetTemplate(key, templateId ?? undefined),
    enabled: enabled && templateId !== null,
    retry: 0,
    staleTime: 60_000,
  });
}

export function useSaveSpreadsheetTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSpreadsheetTemplate,
    onSuccess: (_template, input) =>
      queryClient.invalidateQueries({
        queryKey: spreadsheetTemplateKeys.list(input.key),
      }),
  });
}

export function useDeleteSpreadsheetTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: SpreadsheetTemplateKey; templateId: string }) =>
      deleteSpreadsheetTemplate(input.key, input.templateId),
    onSuccess: (_template, input) =>
      queryClient.invalidateQueries({
        queryKey: spreadsheetTemplateKeys.list(input.key),
      }),
  });
}
