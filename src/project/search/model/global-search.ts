import { ROUTES } from '@/constants/routes';

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
export const GLOBAL_SEARCH_LIMIT_PER_SOURCE = 5;

export type GlobalSearchSource = 'employees';

export interface GlobalSearchItem {
  id: string;
  title: string;
  code: string | null;
  subtitle: string | null;
  status: string | null;
  imageUrl: string | null;
}

export interface GlobalSearchResult {
  employees: GlobalSearchItem[];
}

export const EMPTY_GLOBAL_SEARCH_RESULT: GlobalSearchResult = {
  employees: [],
};

export function getGlobalSearchResultPath(
  _source: GlobalSearchSource,
  item: GlobalSearchItem,
): string {
  const query = encodeURIComponent(item.code ?? item.title);
  return `${ROUTES.PROJECT.EMPLOYEES}?search=${query}`;
}
