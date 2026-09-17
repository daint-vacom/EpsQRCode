import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
  FileText,
  Layers3,
  LoaderCircle,
  Search,
  UserRoundSearch,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/inputs/search-input';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLayout } from '@/components/layouts/main-layout/components/context';
import { useGlobalSearch } from '../hooks/use-global-search';
import {
  getGlobalSearchResultPath,
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
  type GlobalSearchItem,
  type GlobalSearchSource,
} from '../model/global-search';

interface SearchSection {
  source: GlobalSearchSource;
  label: string;
  items: GlobalSearchItem[];
}

interface FlattenedSearchItem {
  source: GlobalSearchSource;
  item: GlobalSearchItem;
}

const SOURCE_ICONS: Record<GlobalSearchSource, typeof Users> = {
  customers: UserRoundSearch,
  contracts: FileText,
  contractTemplates: Layers3,
  employees: Users,
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
  uncontacted: 'Chưa liên hệ',
  draft: 'Bản nháp',
  published: 'Đang phát hành',
  archived: 'Đã lưu trữ',
  suspended: 'Tạm dừng',
  expired: 'Hết hạn',
  terminated: 'Đã chấm dứt',
};

function getStatusVariant(
  status: string | null,
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'active' || status === 'published') return 'success';
  if (status === 'suspended' || status === 'uncontacted') return 'warning';
  if (status === 'expired' || status === 'terminated') return 'destructive';
  return 'secondary';
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ value, query }: { value: string; query: string }) {
  if (!query.trim()) return <>{value}</>;

  const parts = value.split(
    new RegExp(`(${escapeRegExp(query.trim())})`, 'ig'),
  );

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded-sm bg-primary/15 px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function StatusLabel({ status }: { status: string | null }) {
  if (!status) return null;

  return (
    <Badge
      variant={getStatusVariant(status)}
      appearance="light"
      size="sm"
      className="shrink-0"
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function ResultLeading({
  source,
  item,
}: {
  source: GlobalSearchSource;
  item: GlobalSearchItem;
}) {
  if (item.imageUrl) {
    return (
      <Avatar className="size-8 rounded-md">
        <AvatarImage src={item.imageUrl} alt="" />
        <AvatarFallback className="rounded-md text-[0.625rem]">
          {getInitials(item.title)}
        </AvatarFallback>
      </Avatar>
    );
  }

  const Icon = SOURCE_ICONS[source];

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

function SearchResultItem({
  source,
  item,
  query,
  active,
  onSelect,
  itemRef,
  optionId,
}: {
  source: GlobalSearchSource;
  item: GlobalSearchItem;
  query: string;
  active: boolean;
  onSelect: (source: GlobalSearchSource, item: GlobalSearchItem) => void;
  itemRef: (element: HTMLButtonElement | null) => void;
  optionId: string;
}) {
  return (
    <button
      ref={itemRef}
      id={optionId}
      type="button"
      role="option"
      aria-selected={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-hidden transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
      )}
      onClick={() => onSelect(source, item)}
    >
      <ResultLeading source={source} item={item} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            <HighlightedText value={item.title} query={query} />
          </span>
          {item.code ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              <HighlightedText value={item.code} query={query} />
            </span>
          ) : null}
        </span>
        {item.subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {item.subtitle}
          </span>
        ) : null}
      </span>
      <StatusLabel status={item.status} />
    </button>
  );
}

export function GlobalSearch() {
  const { shell } = useLayout();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const anchorRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const search = useGlobalSearch(query);

  const sections = useMemo<SearchSection[]>(
    () =>
      [
        {
          source: 'customers',
          label: 'Khách hàng',
          items: search.data.customers,
        },
        {
          source: 'contracts',
          label: 'Hợp đồng',
          items: search.data.contracts,
        },
        {
          source: 'contractTemplates',
          label: 'Mẫu hợp đồng',
          items: search.data.contractTemplates,
        },
        {
          source: 'employees',
          label: 'Nhân viên',
          items: search.data.employees,
        },
      ].filter((section) => section.items.length > 0),
    [search.data],
  );

  const flattenedItems = useMemo<FlattenedSearchItem[]>(
    () =>
      sections.flatMap((section) =>
        section.items.map((item) => ({ source: section.source, item })),
      ),
    [sections],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, flattenedItems.length]);

  useEffect(() => {
    if (!open || flattenedItems.length === 0) return;
    const active = flattenedItems[activeIndex];
    if (!active) return;
    itemRefs.current
      .get(`${active.source}:${active.item.id}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, flattenedItems, open]);

  function handleSelect(source: GlobalSearchSource, item: GlobalSearchItem) {
    setOpen(false);
    setQuery('');
    navigate(getGlobalSearchResultPath(source, item));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        flattenedItems.length === 0
          ? 0
          : Math.min(current + 1, flattenedItems.length - 1),
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const active = flattenedItems[activeIndex];
      if (open && active) {
        event.preventDefault();
        handleSelect(active.source, active.item);
      }
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const hasQuery = query.trim().length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH;
  const hasResults = flattenedItems.length > 0;
  const isDark = shell.headerVariant === 'dark';
  const activeItem = flattenedItems[activeIndex];
  const activeItemId = activeItem
    ? `global-search-option-${activeItem.source}-${activeItem.item.id}`
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="min-w-0">
          <SearchInput
            variant="header"
            value={query}
            onSearch={setQuery}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm kiếm..."
            aria-label="Tìm kiếm khách hàng, hợp đồng, mẫu hợp đồng hoặc nhân viên"
            role="combobox"
            aria-expanded={open}
            aria-controls="global-search-results"
            aria-activedescendant={activeItemId}
            aria-autocomplete="list"
            className={cn('w-52 sm:w-64 lg:w-72', isDark && 'text-white')}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        id="global-search-results"
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[min(42rem,calc(100vw-2rem))] overflow-hidden p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          const target = event.target;
          if (target instanceof Node && anchorRef.current?.contains(target)) {
            event.preventDefault();
          }
        }}
      >
        <ScrollArea
          className={cn(
            'max-h-[min(34rem,calc(100vh-9rem))]',
            hasResults && 'h-[min(34rem,calc(100vh-9rem))]',
          )}
        >
          <div
            id="global-search-results-list"
            role="listbox"
            aria-label="Kết quả tìm kiếm"
            className="p-2"
          >
            {!hasQuery ? (
              <EmptySearchState
                icon={<Search className="size-5" aria-hidden="true" />}
                title="Tìm nhanh trong dữ liệu quản trị"
                description="Tìm theo mã, tên, số điện thoại hoặc khách hàng liên quan."
              />
            ) : search.isFetching ? (
              <LoadingSearchState />
            ) : search.isError ? (
              <EmptySearchState
                icon={<Search className="size-5" aria-hidden="true" />}
                title="Không tải được kết quả"
                description="Vui lòng thử lại sau."
              />
            ) : !hasResults ? (
              <EmptySearchState
                icon={<Search className="size-5" aria-hidden="true" />}
                title="Không tìm thấy dữ liệu phù hợp"
                description="Thử tìm bằng mã hoặc tên chính xác hơn."
              />
            ) : (
              sections.map((section) => (
                <div key={section.source} className="not-first:mt-2">
                  <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-sm font-semibold text-foreground">
                    <span>{section.label}</span>
                    <span className="font-normal">
                      ({section.items.length})
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const index = flattenedItems.findIndex(
                        (candidate) =>
                          candidate.source === section.source &&
                          candidate.item.id === item.id,
                      );
                      const itemKey = `${section.source}:${item.id}`;

                      return (
                        <SearchResultItem
                          key={itemKey}
                          source={section.source}
                          item={item}
                          query={query}
                          active={index === activeIndex}
                          onSelect={handleSelect}
                          optionId={`global-search-option-${section.source}-${item.id}`}
                          itemRef={(element) => {
                            if (element) itemRefs.current.set(itemKey, element);
                            else itemRefs.current.delete(itemKey);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function EmptySearchState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="mb-3 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function LoadingSearchState() {
  return (
    <div className="space-y-1.5 p-2">
      {[0, 1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="flex items-center gap-3 rounded-md px-3 py-2"
        >
          <span className="size-8 animate-pulse rounded-md bg-muted" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-1/2 animate-pulse rounded bg-muted" />
          </span>
          <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}
