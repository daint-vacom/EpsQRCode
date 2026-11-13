import { useMemo, useState } from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { searchMatch } from '@/lib/search';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { OptionSelect } from '@/components/ui/option-select';
import type {
  OptionSelectProps,
  SelectOption,
} from '@/components/ui/option-select';
import { useAvailableMaterialGroupsQuery } from '../hooks/use-material-groups';
import type { MaterialGroup } from '../model/material-group';
import { ROOT_MATERIAL_GROUP_PARENT } from '../model/material-group';
import {
  buildMaterialGroupTree,
  getMaterialGroupPath,
  type MaterialGroupTreeNode,
} from '../model/material-group-tree';

type MaterialGroupSelectItem =
  | { kind: 'root'; name: string }
  | {
      kind: 'group';
      group: MaterialGroup;
      depth: number;
      path: string;
      hasChildren: boolean;
    };

const EMPTY_MATERIAL_GROUPS: MaterialGroup[] = [];

export type MaterialGroupSelectProps = Omit<
  OptionSelectProps<MaterialGroupSelectItem>,
  | 'options'
  | 'selectedOption'
  | 'renderOption'
  | 'optionContentClassName'
  | 'loading'
  | 'loadingMessage'
  | 'emptyMessage'
  | 'manualFilter'
> & {
  sourceMode?: 'fetch' | 'options';
  groups?: readonly MaterialGroup[];
  includeRootOption?: boolean;
};

function materialGroupOption(
  group: MaterialGroup,
  groups: readonly MaterialGroup[],
  depth: number,
  hasChildren: boolean,
): SelectOption<MaterialGroupSelectItem> {
  const path = getMaterialGroupPath(groups, group.id);
  return {
    value: group.id,
    label: path,
    searchableText: `${path} ${group.name} ${group.code}`,
    data: { kind: 'group', group, depth, path, hasChildren },
  };
}

function flattenTree(
  nodes: readonly MaterialGroupTreeNode[],
  groups: readonly MaterialGroup[],
  collapsedIds: ReadonlySet<string>,
  forceExpanded = false,
): SelectOption<MaterialGroupSelectItem>[] {
  const options: SelectOption<MaterialGroupSelectItem>[] = [];

  for (const node of nodes) {
    options.push(
      materialGroupOption(node, groups, node.depth, node.children.length > 0),
    );
    if (forceExpanded || !collapsedIds.has(node.id)) {
      options.push(
        ...flattenTree(node.children, groups, collapsedIds, forceExpanded),
      );
    }
  }

  return options;
}

function filterTree(
  nodes: readonly MaterialGroupTreeNode[],
  groups: readonly MaterialGroup[],
  query: string,
): MaterialGroupTreeNode[] {
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, groups, query);
    const path = getMaterialGroupPath(groups, node.id);
    const matches = searchMatch(`${path} ${node.name} ${node.code}`, query);
    return matches || children.length > 0 ? [{ ...node, children }] : [];
  });
}

function GroupOption({
  item,
  expanded,
  onToggle,
  expandLabel,
  collapseLabel,
}: {
  item: Extract<MaterialGroupSelectItem, { kind: 'group' }>;
  expanded: boolean;
  onToggle: (groupId: string) => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <span
      className="flex min-w-0 items-center gap-2"
      style={{ paddingInlineStart: `${item.depth * 16}px` }}
    >
      {item.hasChildren ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tabIndex={-1}
          aria-label={expanded ? collapseLabel : expandLabel}
          aria-expanded={expanded}
          className="size-5 shrink-0 rounded-sm p-0 text-muted-foreground hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle(item.group.id);
          }}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-3.5 transition-transform',
              expanded && 'rotate-90',
            )}
          />
        </Button>
      ) : (
        <span aria-hidden="true" className="size-5 shrink-0" />
      )}
      <Folder aria-hidden="true" className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 truncate">{item.group.name}</span>
    </span>
  );
}

export function MaterialGroupSelect({
  value = '',
  placeholder,
  onOpenChange,
  onSearchChange,
  searchValue,
  sourceMode = 'fetch',
  groups: providedGroups,
  includeRootOption = false,
  ...props
}: MaterialGroupSelectProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const shouldFetch = sourceMode === 'fetch';
  const query = useAvailableMaterialGroupsQuery(
    shouldFetch && !props.disabled && (open || Boolean(value)),
  );
  const groupList =
    sourceMode === 'options'
      ? (providedGroups ?? EMPTY_MATERIAL_GROUPS)
      : (query.data ?? EMPTY_MATERIAL_GROUPS);
  const searchQuery = searchValue ?? localSearchValue;
  const isSearching = Boolean(searchQuery.trim());
  const rootLabel = intl.formatMessage({ id: 'materialGroups.fields.root' });
  const tree = useMemo(
    () => buildMaterialGroupTree([...groupList]),
    [groupList],
  );
  const allOptions = useMemo(() => {
    const groupOptions = flattenTree(tree, groupList, new Set(), true);
    if (!includeRootOption) return groupOptions;
    return [
      {
        value: ROOT_MATERIAL_GROUP_PARENT,
        label: rootLabel,
        searchableText: rootLabel,
        data: { kind: 'root', name: rootLabel } as const,
      },
      ...groupOptions,
    ];
  }, [groupList, includeRootOption, rootLabel, tree]);
  const options = useMemo(() => {
    const visibleTree = isSearching
      ? filterTree(tree, groupList, searchQuery)
      : tree;
    const groupOptions = flattenTree(
      visibleTree,
      groupList,
      collapsedIds,
      isSearching,
    );
    if (!includeRootOption) return groupOptions;

    const rootOption = allOptions[0];
    return isSearching && !searchMatch(rootLabel, searchQuery)
      ? groupOptions
      : [rootOption, ...groupOptions];
  }, [
    allOptions,
    collapsedIds,
    groupList,
    includeRootOption,
    isSearching,
    rootLabel,
    searchQuery,
    tree,
  ]);
  const selectedOption = allOptions.find((option) => option.value === value);
  const selectPlaceholder =
    placeholder ??
    intl.formatMessage({ id: 'materialGroups.select.placeholder' });

  return (
    <OptionSelect
      {...props}
      value={value}
      options={options}
      selectedOption={selectedOption}
      placeholder={selectPlaceholder}
      searchPlaceholder={intl.formatMessage({
        id: 'materialGroups.select.search',
      })}
      emptyMessage={intl.formatMessage({ id: 'materialGroups.select.empty' })}
      manualFilter
      searchValue={searchQuery}
      onSearchChange={(nextQuery) => {
        if (searchValue === undefined) setLocalSearchValue(nextQuery);
        onSearchChange?.(nextQuery);
      }}
      loading={shouldFetch && query.isPending && query.isFetching}
      loadingMessage={intl.formatMessage({ id: 'common.state.loading' })}
      errorMessage={
        shouldFetch && query.isError
          ? getApiErrorMessage(query.error)
          : undefined
      }
      retryLabel={intl.formatMessage({ id: 'common.actions.retry' })}
      onRetry={() => {
        if (shouldFetch && !query.isFetching)
          void query.refetch({ cancelRefetch: false });
      }}
      optionContentClassName="whitespace-normal"
      triggerContentClassName="overflow-hidden"
      renderOption={(option) => {
        const item = option.data;
        if (!item) return option.label;
        if (item.kind === 'root') {
          return (
            <span className="flex min-w-0 items-center gap-2">
              <Folder
                aria-hidden="true"
                className="size-4 shrink-0 text-primary"
              />
              <span className="truncate">{item.name}</span>
            </span>
          );
        }

        const expanded = isSearching || !collapsedIds.has(item.group.id);
        return (
          <GroupOption
            item={item}
            expanded={expanded}
            expandLabel={intl.formatMessage(
              { id: 'materialGroups.select.expand' },
              { name: item.group.name },
            )}
            collapseLabel={intl.formatMessage(
              { id: 'materialGroups.select.collapse' },
              { name: item.group.name },
            )}
            onToggle={(groupId) => {
              setCollapsedIds((current) => {
                const next = new Set(current);
                if (next.has(groupId)) next.delete(groupId);
                else next.add(groupId);
                return next;
              });
            }}
          />
        );
      }}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
    />
  );
}
