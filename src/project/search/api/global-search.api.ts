import { loadEmployeeList } from '@/project/employees/api/employees.api';
import {
  GLOBAL_SEARCH_LIMIT_PER_SOURCE,
  type GlobalSearchResult,
} from '../model/global-search';

export async function loadGlobalSearch(
  tenantId: string,
  query: string,
  signal?: AbortSignal,
): Promise<GlobalSearchResult> {
  const result = await loadEmployeeList(
    tenantId,
    { page: 1, pageSize: GLOBAL_SEARCH_LIMIT_PER_SOURCE, search: query.trim() },
    signal,
  );

  return {
    employees: result.employees.map((employee) => ({
      id: employee.id,
      title: employee.displayName,
      code: employee.employeeCode,
      subtitle: employee.phone || null,
      status: employee.status,
      imageUrl: employee.imageUrl,
    })),
  };
}
