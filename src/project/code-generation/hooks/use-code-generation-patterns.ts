import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadCodeGenerationPatterns,
  saveCodeGenerationPatterns,
} from '../api/code-generation-patterns.api';

export const codeGenerationPatternKeys = {
  all: ['project', 'code-generation-patterns'] as const,
};

export function useCodeGenerationPatternsQuery(enabled = true) {
  return useQuery({
    queryKey: codeGenerationPatternKeys.all,
    queryFn: ({ signal }) => loadCodeGenerationPatterns(signal),
    enabled,
    retry: 0,
  });
}

export function useSaveCodeGenerationPatternsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveCodeGenerationPatterns,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: codeGenerationPatternKeys.all,
      }),
  });
}
