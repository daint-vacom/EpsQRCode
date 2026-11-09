import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadSpreadsheetTemplate,
  saveSpreadsheetTemplate,
  type SpreadsheetTemplateKey,
} from '../api/spreadsheet-templates.api';

export const spreadsheetTemplateKeys = {
  all: ['project', 'spreadsheet-templates'] as const,
  detail: (key: SpreadsheetTemplateKey) =>
    [...spreadsheetTemplateKeys.all, key] as const,
};

export function useSpreadsheetTemplateQuery(
  key: SpreadsheetTemplateKey,
  enabled = true,
) {
  return useQuery({
    queryKey: spreadsheetTemplateKeys.detail(key),
    queryFn: () => loadSpreadsheetTemplate(key),
    enabled,
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
        queryKey: spreadsheetTemplateKeys.detail(input.key),
      }),
  });
}
