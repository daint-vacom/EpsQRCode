import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { BadgeButton } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MultiSelect,
  type MultiSelectOption,
  type MultiSelectProps,
} from '@/components/ui/multi-select';
import { loadTagSelectOptions, type TagSelectConfig } from '../api/tags.api';
import type { TagSelectOption } from '../model/tag';
import { TagBadge } from './tag-badge';
import { TagGroupIcon } from './tag-group-icon';

export type TagSelectVariant = 'input' | 'button';

export interface TagSelectProps
  extends
    Omit<
      MultiSelectProps<TagSelectOption>,
      | 'options'
      | 'nestedOptions'
      | 'loading'
      | 'loadingMessage'
      | 'renderSelectedOption'
      | 'showSelectedOptionsInTrigger'
      | 'triggerVariant'
      | 'triggerMode'
      | 'triggerStartIcon'
      | 'triggerEndIcon'
    >,
    TagSelectConfig {
  variant?: TagSelectVariant;
  emptySelectionMessage?: ReactNode;
}

const BUTTON_TRIGGER_CLASS =
  'h-7 min-h-7 w-fit min-w-0 justify-start gap-1.5 border-0 bg-transparent px-2 text-muted-foreground shadow-none hover:bg-accent';

export function TagSelect({
  value = [],
  moduleCodes = [],
  allowCustomGroups = true,
  enabled = true,
  variant = 'input',
  placeholder,
  searchPlaceholder = 'Tìm danh mục...',
  emptyMessage = 'Không tìm thấy danh mục',
  emptySelectionMessage,
  disabled = false,
  className,
  onChange,
  ...props
}: TagSelectProps) {
  const { userId } = useUser();
  const { tenantId } = useTenant();
  const normalizedModuleCodes = useMemo(
    () =>
      Array.from(
        new Set(moduleCodes.map((code) => code.trim()).filter(Boolean)),
      ),
    [moduleCodes],
  );
  const query = useQuery({
    queryKey: [
      'project',
      'tags',
      'select-options',
      userId,
      tenantId,
      normalizedModuleCodes,
      allowCustomGroups,
    ],
    queryFn: () => {
      if (!userId || !tenantId) {
        throw new Error('Chưa xác định tổ chức hiện tại.');
      }
      return loadTagSelectOptions(
        userId,
        {
          moduleCodes: normalizedModuleCodes,
          allowCustomGroups,
        },
        tenantId,
      );
    },
    enabled: Boolean(userId && tenantId && enabled),
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo<MultiSelectOption<TagSelectOption>[]>(
    () =>
      (query.data ?? [])
        .filter((tag) => tag.isActive || value.includes(tag.id))
        .map((tag) => ({
          value: tag.id,
          label: <TagBadge color={tag.color}>{tag.name}</TagBadge>,
          ariaLabel: tag.name,
          searchableText: `${tag.name} ${tag.groupName}`,
          group: tag.groupName,
          disabled: !tag.isActive,
          data: tag,
        })),
    [query.data, value],
  );

  const nestedOptions = useMemo(() => {
    const groups = new Map<
      string,
      {
        label: string;
        groupCode: string;
        moduleCode: string | null;
        isSystem: boolean;
        options: MultiSelectOption<TagSelectOption>[];
      }
    >();

    options.forEach((option) => {
      const groupId = option.data?.groupId ?? option.data?.groupName ?? 'other';
      const group = groups.get(groupId) ?? {
        label: option.data?.groupName ?? 'Khác',
        groupCode: option.data?.groupCode ?? '',
        moduleCode: option.data?.moduleCode ?? null,
        isSystem: option.data?.isSystem ?? false,
        options: [],
      };
      group.options.push(option);
      groups.set(groupId, group);
    });

    return Array.from(groups, ([groupId, group]) => ({
      value: `group:${groupId}`,
      label: (
        <span className="flex min-w-0 items-center gap-2">
          <TagGroupIcon
            groupCode={group.groupCode}
            moduleCode={group.moduleCode}
            isSystem={group.isSystem}
            className="text-muted-foreground"
          />
          <span className="truncate">{group.label}</span>
        </span>
      ),
      searchableText: group.label,
      options: group.options,
    }));
  }, [options]);

  const selectedTags = useMemo(() => {
    const tagsById = new Map(
      options.map((option) => [option.value, option.data]),
    );
    return value.flatMap((tagId) => {
      const tag = tagsById.get(tagId);
      return tag ? [tag] : [];
    });
  }, [options, value]);
  const useButtonVariant = variant === 'button';
  const selectedBadgeSize = props.size === 'sm' ? 'sm' : 'lg';

  return (
    <div className={useButtonVariant ? 'space-y-2' : undefined}>
      <MultiSelect
        {...props}
        value={value}
        onChange={onChange}
        options={options}
        nestedOptions={nestedOptions}
        placeholder={
          placeholder ?? (useButtonVariant ? 'Thêm nhãn' : 'Chọn danh mục')
        }
        searchPlaceholder={searchPlaceholder}
        searchMode="popover"
        emptyMessage={
          query.isError ? getApiErrorMessage(query.error) : emptyMessage
        }
        loading={query.isPending}
        loadingMessage="Đang tải danh sách nhãn..."
        disabled={disabled || !userId || !tenantId || !enabled}
        className={cn(useButtonVariant && BUTTON_TRIGGER_CLASS, className)}
        showSelectedOptionsInTrigger={!useButtonVariant}
        triggerVariant={useButtonVariant ? 'ghost' : 'outline'}
        triggerMode={useButtonVariant ? 'default' : 'input'}
        triggerStartIcon={
          useButtonVariant ? <Plus className="size-3.5 shrink-0" /> : undefined
        }
        triggerEndIcon={useButtonVariant ? null : undefined}
        renderSelectedOption={(option, remove) => {
          const name = option.data?.name ?? option.value;

          return (
            <TagBadge
              color={option.data?.color}
              size={selectedBadgeSize}
              className="max-w-full gap-1.5"
            >
              <span className="min-w-0 truncate">{name}</span>
              <BadgeButton
                aria-label={`Bỏ nhãn ${name}`}
                tabIndex={0}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  remove();
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  event.stopPropagation();
                  remove();
                }}
              >
                <X />
              </BadgeButton>
            </TagBadge>
          );
        }}
      />

      {useButtonVariant ? (
        <>
          {selectedTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map((tag) => (
                <TagBadge
                  key={tag.id}
                  color={tag.color}
                  size="lg"
                  shape="circle"
                  className="max-w-full gap-2"
                >
                  <span className="max-w-56 truncate">{tag.name}</span>
                  <button
                    type="button"
                    aria-label={`Bỏ nhãn ${tag.name}`}
                    className="inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground opacity-75 transition-opacity hover:opacity-100"
                    onClick={() =>
                      onChange?.(value.filter((tagId) => tagId !== tag.id))
                    }
                  >
                    <X className="size-3" />
                  </button>
                </TagBadge>
              ))}
            </div>
          ) : emptySelectionMessage ? (
            <div className="text-sm text-muted-foreground">
              {emptySelectionMessage}
            </div>
          ) : null}

          {query.isError ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {getApiErrorMessage(query.error)}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
              >
                Thử lại
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
