import { useQuery } from '@tanstack/react-query';
import { loadMaterialCapitalSources } from '../api/material-capital-sources.api';

export const materialCapitalSourceKeys = {
  all: ['project', 'material-capital-sources'] as const,
  list: () => [...materialCapitalSourceKeys.all, 'list'] as const,
};

export function useMaterialCapitalSourcesQuery(enabled = true) {
  return useQuery({
    queryKey: materialCapitalSourceKeys.list(),
    queryFn: ({ signal }) => loadMaterialCapitalSources(signal),
    enabled,
    retry: 0,
  });
}
