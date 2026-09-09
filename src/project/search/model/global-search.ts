import { buildPath, ROUTES } from '@/constants/routes';

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
export const GLOBAL_SEARCH_LIMIT_PER_SOURCE = 5;

export type GlobalSearchSource =
  | 'customers'
  | 'contracts'
  | 'contractTemplates'
  | 'employees';

export interface GlobalSearchItem {
  id: string;
  title: string;
  code: string | null;
  subtitle: string | null;
  status: string | null;
  imageUrl: string | null;
}

export interface GlobalSearchResult {
  customers: GlobalSearchItem[];
  contracts: GlobalSearchItem[];
  contractTemplates: GlobalSearchItem[];
  employees: GlobalSearchItem[];
}

export const EMPTY_GLOBAL_SEARCH_RESULT: GlobalSearchResult = {
  customers: [],
  contracts: [],
  contractTemplates: [],
  employees: [],
};

export function getGlobalSearchResultPath(
  source: GlobalSearchSource,
  item: GlobalSearchItem,
): string {
  switch (source) {
    case 'customers':
      return buildPath(ROUTES.PROJECT.CUSTOMER_DETAIL, { id: item.id });
    case 'contracts':
      return buildPath(ROUTES.PROJECT.CONTRACT_DETAIL, { id: item.id });
    case 'contractTemplates':
      return buildPath(ROUTES.PROJECT.CONTRACT_TEMPLATE_DETAIL, {
        id: item.id,
      });
    case 'employees':
      return `${ROUTES.PROJECT.EMPLOYEES}?search=${encodeURIComponent(item.code ?? item.title)}`;
  }
}
