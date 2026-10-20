import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { vi } from '@/i18n/messages/vi';
import { hashKey, useInfiniteQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { IntlContext } from 'react-intl';
import type { OptionSelectProps, SelectOption } from './select-search';
import { OptionSelect } from './select-search';

export type ApiSelectSearchResult<T = unknown> =
  | Array<SelectOption<T>>
  | { options: Array<SelectOption<T>>; total?: number; hasMore?: boolean };

export type ApiSelectSearchLoadOptions<
  T = unknown,
  F = Record<string, unknown>,
> = (params: {
  search: string;
  filters: F | undefined;
  page: number;
  pageSize: number;
  signal: AbortSignal;
}) => Promise<ApiSelectSearchResult<T>>;

export interface ApiSelectSearchProps<
  T = unknown,
  F = Record<string, unknown>,
> extends Omit<
  OptionSelectProps<T>,
  | 'options'
  | 'loading'
  | 'loadingMore'
  | 'onRetry'
  | 'onOptionsScroll'
  | 'onSearchChange'
  | 'manualFilter'
  | 'onLoadMore'
  | 'searchValue'
> {
  loadOptions: ApiSelectSearchLoadOptions<T, F>;
  /** Domain prefix including tenant/user/access scope. Omitted keys are instance-local. */
  cacheKey?: QueryKey;
  /** Serializable backend filters; included in the key automatically. */
  filters?: F;
  enabled?: boolean;
  initialQuery?: string;
  pageSize?: number;
  debounceMs?: number;
  minSearchLength?: number;
  minSearchMessage?: string;
  staleTime?: number;
  gcTime?: number;
}

export type ApiOptionSelectResult<T = unknown> = ApiSelectSearchResult<T>;
export type ApiOptionSelectLoadOptions<
  T = unknown,
  F = Record<string, unknown>,
> = ApiSelectSearchLoadOptions<T, F>;
export type ApiOptionSelectProps<
  T = unknown,
  F = Record<string, unknown>,
> = ApiSelectSearchProps<T, F>;

function normalizeResult<T>(
  result: ApiSelectSearchResult<T>,
  page: number,
  pageSize: number,
) {
  if (Array.isArray(result)) return { options: result, hasMore: false };
  return {
    options: result.options,
    // An empty page terminates even if an inconsistent backend advertises more.
    hasMore:
      result.options.length > 0 &&
      (result.hasMore ??
        (result.total !== undefined && page * pageSize < result.total)),
  };
}

/** Shared fetch controller for OptionSelect and presentation wrappers such as avatars. */
export function useApiSelectSearch<T = unknown, F = Record<string, unknown>>({
  loadOptions,
  cacheKey,
  filters,
  enabled = true,
  initialQuery = '',
  selectedOption,
  pageSize = 30,
  debounceMs = 300,
  minSearchLength = 0,
  minSearchMessage,
  loadingMessage,
  loadingMoreMessage,
  errorMessage,
  retryLabel,
  staleTime = 60_000,
  gcTime = 5 * 60_000,
  onSelect,
  onOpenChange,
  ...props
}: ApiSelectSearchProps<T, F>): OptionSelectProps<T> {
  const intl = useContext(IntlContext);
  const message = (id: string) => intl?.formatMessage({ id }) ?? vi[id];
  const instanceId = useId();
  const scopeKey = hashKey([
    cacheKey ?? ['api-select-search', 'instance', instanceId],
    filters,
  ]);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  useEffect(() => {
    setQuery(initialQuery);
    setDebouncedQuery(initialQuery.trim());
  }, [initialQuery]);
  const [picked, setPicked] = useState<{
    scope: string;
    option: SelectOption<T> | undefined;
  }>();
  const loadOptionsRef = useRef(loadOptions);
  // Loader identity is not a fetch dependency; the query key owns data identity.
  useEffect(() => {
    loadOptionsRef.current = loadOptions;
  }, [loadOptions]);
  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedQuery(query.trim()),
      debounceMs,
    );
    return () => clearTimeout(timeout);
  }, [debounceMs, query]);

  const search = debouncedQuery;
  const currentQueryMatches = query.trim() === search;
  const canFetch =
    enabled &&
    !props.disabled &&
    isOpen &&
    currentQueryMatches &&
    search.length >= minSearchLength;
  const searchQuery = useInfiniteQuery({
    queryKey: [
      ...(cacheKey ?? ['api-select-search', 'instance', instanceId]),
      'options',
      filters ?? null,
      search,
      pageSize,
    ],
    queryFn: async ({ pageParam, signal }) =>
      normalizeResult(
        await loadOptionsRef.current({
          search,
          filters,
          page: pageParam,
          pageSize,
          signal,
        }),
        pageParam,
        pageSize,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length + 1 : undefined,
    enabled: canFetch,
    staleTime,
    gcTime,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const options = useMemo(() => {
    const unique = new Map<string, SelectOption<T>>();
    if (currentQueryMatches)
      searchQuery.data?.pages.forEach((page) =>
        page.options.forEach((option) => unique.set(option.value, option)),
      );
    return [...unique.values()];
  }, [currentQueryMatches, searchQuery.data]);
  const value = props.value ?? '';
  const retained =
    picked?.scope === scopeKey && picked.option?.value === value
      ? picked.option
      : undefined;
  const resolvedSelected =
    options.find((option) => option.value === value) ??
    (selectedOption?.value === value ? selectedOption : retained);
  // Keep a selected result through subsequent searches/pages without retaining other scopes.
  useEffect(() => {
    if (resolvedSelected)
      setPicked({ scope: scopeKey, option: resolvedSelected });
  }, [resolvedSelected, scopeKey]);
  const mergedOptions = useMemo(() => {
    if (
      !resolvedSelected ||
      options.some((option) => option.value === resolvedSelected.value)
    )
      return options;
    return [resolvedSelected, ...options];
  }, [options, resolvedSelected]);
  const belowMinimum = query.trim().length < minSearchLength;
  const loading =
    enabled &&
    !props.disabled &&
    isOpen &&
    !belowMinimum &&
    (!currentQueryMatches || (searchQuery.isPending && searchQuery.isFetching));
  const fetchNext = () => {
    if (!canFetch || !searchQuery.hasNextPage || searchQuery.isFetching) return;
    void searchQuery.fetchNextPage({ cancelRefetch: false });
  };
  const handleOptionsScroll = (event: UIEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    if (
      !searchQuery.isError &&
      list.scrollTop + list.clientHeight >= list.scrollHeight - 32
    )
      fetchNext();
  };
  return {
    ...props,
    options: mergedOptions,
    selectedOption: resolvedSelected,
    manualFilter: true,
    loading,
    loadingMessage: loadingMessage ?? message('common.state.loading'),
    loadingMore: searchQuery.isFetchingNextPage,
    loadingMoreMessage:
      loadingMoreMessage ?? message('common.select.loadingMore'),
    onLoadMore:
      canFetch && searchQuery.hasNextPage && !searchQuery.isError
        ? fetchNext
        : undefined,
    loadMoreLabel: props.loadMoreLabel ?? message('common.actions.loadMore'),
    errorMessage:
      currentQueryMatches && !belowMinimum && searchQuery.isError
        ? (errorMessage ?? message('common.select.loadError'))
        : undefined,
    retryLabel: retryLabel ?? message('common.actions.retry'),
    onRetry: () => {
      if (!canFetch || searchQuery.isFetching) return;
      if (searchQuery.isFetchNextPageError) fetchNext();
      else void searchQuery.refetch({ cancelRefetch: false });
    },
    emptyMessage: belowMinimum
      ? (minSearchMessage ??
        intl?.formatMessage(
          { id: 'common.select.minSearch' },
          { count: minSearchLength },
        ) ??
        vi['common.select.minSearch'].replace(
          '{count}',
          String(minSearchLength),
        ))
      : props.emptyMessage,
    onSelect: (option) => {
      setPicked({ scope: scopeKey, option });
      onSelect?.(option);
    },
    onOpenChange: (open) => {
      setIsOpen(open);
      if (!open) {
        setQuery('');
        setDebouncedQuery('');
      }
      onOpenChange?.(open);
    },
    onSearchChange: setQuery,
    searchValue: query,
    onOptionsScroll: handleOptionsScroll,
  };
}

export function ApiSelectSearch<T = unknown, F = Record<string, unknown>>(
  props: ApiSelectSearchProps<T, F>,
) {
  return <OptionSelect {...useApiSelectSearch(props)} />;
}
export const ApiOptionSelect = ApiSelectSearch;
