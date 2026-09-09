import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/providers/tenant-provider';
import { loadGlobalSearch } from '../api/global-search.api';
import {
  EMPTY_GLOBAL_SEARCH_RESULT,
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
} from '../model/global-search';

export function useGlobalSearch(query: string) {
  const { tenantId } = useTenant();
  const normalizedQuery = query.trim();
  const enabled =
    Boolean(tenantId) &&
    normalizedQuery.length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH;

  const searchQuery = useQuery({
    queryKey: ['project', 'global-search', tenantId, normalizedQuery],
    queryFn: ({ signal }) => {
      if (!tenantId) throw new Error('Chưa xác định tenant đang hoạt động.');
      return loadGlobalSearch(tenantId, normalizedQuery, signal);
    },
    enabled,
    staleTime: 30 * 1000,
    retry: false,
  });

  return {
    ...searchQuery,
    data: enabled
      ? (searchQuery.data ?? EMPTY_GLOBAL_SEARCH_RESULT)
      : EMPTY_GLOBAL_SEARCH_RESULT,
  };
}
