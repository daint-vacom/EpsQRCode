import { useSubjectTagFilter } from '@/project/tags/hooks/use-subject-tag-filter';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { buildListQueryParams } from '@/lib/list-query-params';
import { useTableListState } from '@/hooks/use-table-list-state';
import { useTenant } from '@/providers/tenant-provider';
import {
  loadCustomerList,
  loadCustomerPreviousMonthStats,
  loadCustomerResponsibilityFilterOptions,
  loadCustomerStats,
} from '../api/customers.api';
import {
  BUSINESS_TYPES,
  CUSTOMER_LIST_INITIAL_FILTERS,
  CUSTOMER_STATUSES,
  type BusinessType,
  type CustomerListFieldFilters,
  type CustomerListFilters,
  type CustomerListParams,
  type CustomerStatus,
} from '../model/customer';

function parseCustomFieldFilters(value: unknown): Record<string, string> {
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

export interface UseCustomerListOptions {
  enabled?: boolean;
  initialPageSize?: number;
  includeStats?: boolean;
  includeResponsibilityFilterOptions?: boolean;
}

export function useCustomerList({
  enabled = true,
  initialPageSize = 10,
  includeStats = true,
  includeResponsibilityFilterOptions = true,
}: UseCustomerListOptions = {}) {
  const tenantState = useTenant();
  const queryEnabled = Boolean(tenantState.tenantId && enabled);
  const listState = useTableListState<CustomerListFilters>({
    initialFilters: CUSTOMER_LIST_INITIAL_FILTERS,
    initialPageSize,
  });

  const queryParams = buildListQueryParams(listState, {
    filters: {
      customerCode: { omit: [''] },
      name: { omit: [''] },
      businessTypes: {
        param: 'businessTypes',
        serialize: (value) => (value.length > 0 ? value.join(',') : undefined),
      },
      businessRegistrationCode: { omit: [''] },
      countryCode: { omit: [''] },
      region: { omit: [''] },
      contactSearch: { omit: [''] },
      phone: { omit: [''] },
      email: { omit: [''] },
      addressDetail: { omit: [''] },
      statuses: {
        param: 'statuses',
        serialize: (value) => (value.length > 0 ? value.join(',') : undefined),
      },
      tagIds: {
        param: 'tagIds',
        serialize: (value) => (value.length > 0 ? value.join(',') : undefined),
      },
      responsibleEmployeeIds: {
        param: 'responsibleEmployeeIds',
        serialize: (value) =>
          value && value.length > 0 ? value.join(',') : undefined,
      },
      note: { omit: [''] },
      customFields: {
        param: 'customFields',
        serialize: (value) => {
          const nonEmpty = Object.fromEntries(
            Object.entries(value).filter(([, item]) => item.trim()),
          );
          return Object.keys(nonEmpty).length > 0
            ? JSON.stringify(nonEmpty)
            : undefined;
        },
      },
    },
  });

  const listParams: CustomerListParams = {
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    search:
      typeof queryParams.search === 'string' ? queryParams.search : undefined,
    fieldFilters: {
      customerCode:
        typeof queryParams.customerCode === 'string'
          ? queryParams.customerCode
          : '',
      name: typeof queryParams.name === 'string' ? queryParams.name : '',
      businessRegistrationCode:
        typeof queryParams.businessRegistrationCode === 'string'
          ? queryParams.businessRegistrationCode
          : '',
      countryCode:
        typeof queryParams.countryCode === 'string'
          ? queryParams.countryCode
          : '',
      region: typeof queryParams.region === 'string' ? queryParams.region : '',
      contactSearch:
        typeof queryParams.contactSearch === 'string'
          ? queryParams.contactSearch
          : '',
      phone: typeof queryParams.phone === 'string' ? queryParams.phone : '',
      email: typeof queryParams.email === 'string' ? queryParams.email : '',
      addressDetail:
        typeof queryParams.addressDetail === 'string'
          ? queryParams.addressDetail
          : '',
      note: typeof queryParams.note === 'string' ? queryParams.note : '',
      customFields: parseCustomFieldFilters(queryParams.customFields),
    } satisfies CustomerListFieldFilters,
    businessTypes:
      typeof queryParams.businessTypes === 'string'
        ? queryParams.businessTypes
            .split(',')
            .filter((value): value is BusinessType =>
              BUSINESS_TYPES.includes(value as BusinessType),
            )
        : undefined,
    statuses:
      typeof queryParams.statuses === 'string'
        ? queryParams.statuses
            .split(',')
            .filter((value): value is CustomerStatus =>
              CUSTOMER_STATUSES.includes(value as CustomerStatus),
            )
        : undefined,
    tagIds:
      typeof queryParams.tagIds === 'string'
        ? queryParams.tagIds.split(',').filter(Boolean)
        : undefined,
    responsibleEmployeeIds:
      typeof queryParams.responsibleEmployeeIds === 'string'
        ? queryParams.responsibleEmployeeIds.split(',').filter(Boolean)
        : undefined,
  };

  const subjectTagFilterQuery = useSubjectTagFilter('customer', {
    moduleCodes: ['customers'],
    enabled: queryEnabled,
  });

  const listQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'list',
      tenantState.tenantId,
      listParams,
    ],
    queryFn: ({ signal }) => {
      if (!tenantState.tenantId) {
        throw new Error('Chưa xác định tenant đang hoạt động.');
      }
      return loadCustomerList(tenantState.tenantId, listParams, signal);
    },
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
  });

  const customerStatsQuery = useQuery({
    queryKey: ['project', 'customers', 'stats', tenantState.tenantId],
    queryFn: ({ signal }) => loadCustomerStats(tenantState.tenantId!, signal),
    enabled: queryEnabled && includeStats,
  });

  const customerResponsibilityFilterOptionsQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'responsibility-filter-options',
      tenantState.tenantId,
    ],
    queryFn: () =>
      loadCustomerResponsibilityFilterOptions(tenantState.tenantId!),
    enabled: queryEnabled && includeResponsibilityFilterOptions,
    staleTime: 60 * 1000,
  });

  const customerPreviousMonthStatsQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'stats',
      'previous-month',
      tenantState.tenantId,
    ],
    queryFn: ({ signal }) =>
      loadCustomerPreviousMonthStats(tenantState.tenantId!, signal),
    enabled: queryEnabled && includeStats,
  });

  return {
    ...listState,
    tenantQuery: tenantState,
    workspaceQuery: listQuery,
    customerStatsQuery,
    customerPreviousMonthStatsQuery,
    customerResponsibilityFilterOptionsQuery,
    customers: listQuery.data?.customers ?? [],
    total: listQuery.data?.total ?? 0,
    customerTagOptions: subjectTagFilterQuery.data?.options ?? [],
    customerTagsByCustomerId: subjectTagFilterQuery.data?.tagsBySubjectId ?? {},
    customerTagOptionsQuery: subjectTagFilterQuery,
  };
}
