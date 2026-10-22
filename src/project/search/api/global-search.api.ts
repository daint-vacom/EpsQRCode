import { loadAccounts } from '@/project/accounts/api/accounts.api';
import {
  GLOBAL_SEARCH_LIMIT_PER_SOURCE,
  type GlobalSearchResult,
} from '../model/global-search';

export async function loadGlobalSearch(
  query: string,
  signal?: AbortSignal,
): Promise<GlobalSearchResult> {
  void signal;
  const result = await loadAccounts(query.trim());

  return {
    accounts: result
      .slice(0, GLOBAL_SEARCH_LIMIT_PER_SOURCE)
      .map((account) => ({
        id: account.userId,
        title: account.displayName,
        code: account.username,
        subtitle:
          account.accountType === 'external'
            ? account.externalOrganizationName
            : [account.epsDepartmentName, account.epsTeamName]
                .filter(Boolean)
                .join(' / ') || null,
        status: account.status,
        imageUrl: null,
      })),
  };
}
