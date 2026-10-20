import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { UIEvent } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import type { OptionSelectProps, SelectOption } from './select-search';
import { OptionSelect } from './select-search';

export type ApiSelectSearchResult<T = unknown> =
  | Array<SelectOption<T>>
  | {
      options: Array<SelectOption<T>>;
      total?: number;
      hasMore?: boolean;
    };

export type ApiSelectSearchLoadOptions<T = unknown> = (params: {
  search: string;
  page: number;
  pageSize: number;
  signal: AbortSignal;
}) => Promise<ApiSelectSearchResult<T>>;

export interface ApiSelectSearchProps<T = unknown> extends Omit<
  OptionSelectProps<T>,
  'options' | 'loading' | 'loadingMessage' | 'selectedOption' | 'onSearchChange'
> {
  loadOptions: ApiSelectSearchLoadOptions<T>;
  /** Include the loader's data scope and filters; omitted keys are cached per instance. */
  cacheKey?: QueryKey;
  selectedOption?: SelectOption<T>;
  initialQuery?: string;
  reloadKey?: string;
  pageSize?: number;
  debounceMs?: number;
  minSearchLength?: number;
  minSearchMessage?: string;
  loadingMessage?: string;
  errorMessage?: string;
  staleTime?: number;
  gcTime?: number;
}

export type ApiOptionSelectResult<T = unknown> = ApiSelectSearchResult<T>;
export type ApiOptionSelectLoadOptions<T = unknown> =
  ApiSelectSearchLoadOptions<T>;
export type ApiOptionSelectProps<T = unknown> = ApiSelectSearchProps<T>;

function normalizeResult<T>(
  result: ApiSelectSearchResult<T>,
  page: number,
  pageSize: number,
): { options: Array<SelectOption<T>>; hasMore: boolean } {
  if (Array.isArray(result)) return { options: result, hasMore: false };

  const hasMore =
    result.hasMore ??
    (result.total !== undefined ? page * pageSize < result.total : false);
  return { options: result.options, hasMore };
}

export function ApiSelectSearch<T = unknown>({
  loadOptions,
  cacheKey,
  selectedOption,
  initialQuery = '',
  reloadKey,
  pageSize = 30,
  debounceMs = 300,
  minSearchLength = 0,
  minSearchMessage,
  loadingMessage = 'Đang tải...',
  errorMessage: errorMessageProp = 'Không thể tải dữ liệu',
  staleTime = 60_000,
  gcTime = 5 * 60_000,
  onSelect,
  onOpenChange,
  ...props
}: ApiSelectSearchProps<T>) {
  const instanceId = useId();
  const stableCacheKey = cacheKey ?? [
    'api-select-search',
    'instance',
    instanceId,
  ];
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedOptionState, setSelectedOptionState] = useState<
    SelectOption<T> | undefined
  >(selectedOption);
  const loadOptionsRef = useRef(loadOptions);

  useEffect(() => {
    loadOptionsRef.current = loadOptions;
  }, [loadOptions]);

  useEffect(() => {
    setSelectedOptionState(selectedOption);
  }, [selectedOption]);

  useEffect(() => {
    setQuery(initialQuery);
    setDebouncedQuery(initialQuery);
  }, [initialQuery, reloadKey]);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedQuery(query.trim()),
      debounceMs,
    );
    return () => clearTimeout(timeout);
  }, [debounceMs, query]);

  const search = debouncedQuery.trim();
  const searchQuery = useInfiniteQuery({
    queryKey: [
      ...stableCacheKey,
      'options',
      reloadKey ?? null,
      search,
      pageSize,
    ],
    queryFn: async ({ pageParam, signal }) => {
      const result = await loadOptionsRef.current({
        search,
        page: pageParam,
        pageSize,
        signal,
      });
      return normalizeResult(result, pageParam, pageSize);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length + 1 : undefined,
    enabled: isOpen && search.length >= minSearchLength,
    staleTime,
    gcTime,
  });

  const currentQueryMatches = query.trim() === search;
  const options = useMemo(() => {
    const uniqueOptions = new Map<string, SelectOption<T>>();
    const visiblePages = currentQueryMatches
      ? (searchQuery.data?.pages ?? [])
      : [];
    visiblePages.forEach((page) =>
      page.options.forEach((option) => uniqueOptions.set(option.value, option)),
    );
    return [...uniqueOptions.values()];
  }, [currentQueryMatches, searchQuery.data?.pages]);
  const isDebouncing = query.trim() !== search;
  const isLoading =
    isOpen &&
    query.trim().length >= minSearchLength &&
    (isDebouncing || (currentQueryMatches && searchQuery.isPending));
  const visibleError =
    currentQueryMatches && searchQuery.isError && !searchQuery.data
      ? searchQuery.error instanceof Error
        ? searchQuery.error.message
        : errorMessageProp
      : undefined;

  const mergedOptions = useMemo(() => {
    const uniqueOptions = new Map<string, SelectOption<T>>();

    if (selectedOptionState) {
      uniqueOptions.set(selectedOptionState.value, selectedOptionState);
    }

    options.forEach((option) => {
      uniqueOptions.set(option.value, option);
    });

    return [...uniqueOptions.values()];
  }, [options, selectedOptionState]);

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);
    onOpenChange?.(nextOpen);

    if (!nextOpen) {
      setQuery('');
      setDebouncedQuery('');
    }
  };

  const handleSearchChange = (nextQuery: string) => setQuery(nextQuery);

  const handleOptionsScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const list = event.currentTarget;
      const isNearBottom =
        list.scrollTop + list.clientHeight >= list.scrollHeight - 32;
      if (
        !isOpen ||
        !currentQueryMatches ||
        !searchQuery.hasNextPage ||
        !isNearBottom ||
        searchQuery.isFetchingNextPage
      ) {
        return;
      }
      void searchQuery.fetchNextPage();
    },
    [currentQueryMatches, isOpen, searchQuery],
  );

  const handleSelect: NonNullable<OptionSelectProps<T>['onSelect']> = (
    option,
  ) => {
    setSelectedOptionState(option);
    onSelect?.(option);
  };

  const shortQueryMessage =
    minSearchMessage ?? `Nhập ít nhất ${minSearchLength} ký tự để tìm kiếm`;
  const visibleEmptyMessage = visibleError
    ? visibleError
    : query.trim().length < minSearchLength
      ? shortQueryMessage
      : props.emptyMessage;

  return (
    <OptionSelect
      {...props}
      options={mergedOptions}
      selectedOption={selectedOptionState}
      loading={isLoading}
      loadingMessage={loadingMessage}
      loadingMore={searchQuery.isFetchingNextPage}
      loadingMoreMessage={loadingMessage}
      loadMoreErrorMessage={
        searchQuery.isFetchNextPageError ? errorMessageProp : undefined
      }
      emptyMessage={visibleEmptyMessage}
      onSelect={handleSelect}
      onOpenChange={handleOpenChange}
      onSearchChange={handleSearchChange}
      onOptionsScroll={handleOptionsScroll}
    />
  );
}

export const ApiOptionSelect = ApiSelectSearch;
