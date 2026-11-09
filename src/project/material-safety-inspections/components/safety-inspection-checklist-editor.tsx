import { useState } from 'react';
import type { ComponentProps, ReactElement, Ref } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  SafetyInspectionChecklistGroup,
  SafetyInspectionCriterion,
} from '../model/safety-inspection-checklist';

const groupDndId = (groupId: string) => `group:${groupId}`;
const criterionDndId = (groupId: string, criterionId: string) =>
  `criterion:${groupId}:${criterionId}`;
const inspectionCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);
  const groupId = activeId.startsWith('criterion:')
    ? activeId.split(':')[1]
    : null;
  const droppableContainers = args.droppableContainers.filter((container) => {
    const id = String(container.id);
    return groupId
      ? id.startsWith(`criterion:${groupId}:`)
      : id.startsWith('group:');
  });

  return closestCenter({ ...args, droppableContainers });
};

interface SafetyInspectionChecklistEditorProps {
  groups: SafetyInspectionChecklistGroup[];
  onChange: (groups: SafetyInspectionChecklistGroup[]) => void;
  fillHeight?: boolean;
}

function SortableCriterionRow({
  group,
  groupIndex,
  criterion,
  criterionIndex,
  onChange,
  onRemove,
}: {
  group: SafetyInspectionChecklistGroup;
  groupIndex: number;
  criterion: SafetyInspectionCriterion;
  criterionIndex: number;
  onChange: (content: string) => void;
  onRemove: () => void;
}) {
  const intl = useIntl();
  const [touched, setTouched] = useState(false);
  const sortable = useSortable({
    id: criterionDndId(group.id, criterion.id),
  });
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  const criterionNumber = `${groupIndex + 1}.${criterionIndex + 1}`;
  const isInvalid = touched && !criterion.content.trim();
  const SortableTableRow = TableRow as typeof TableRow & {
    (
      props: ComponentProps<typeof TableRow> & {
        ref?: Ref<HTMLTableRowElement>;
      },
    ): ReactElement;
  };

  return (
    <SortableTableRow
      ref={sortable.setNodeRef}
      style={style}
      hoverable={false}
      className={cn(
        sortable.isDragging && 'relative z-10 bg-background shadow-sm',
      )}
    >
      <TableCell className="w-12 border-e border-border px-1 py-1 text-center">
        <Button
          {...sortable.attributes}
          {...sortable.listeners}
          type="button"
          variant="ghost"
          mode="icon"
          size="icon"
          aria-label={intl.formatMessage(
            {
              id: 'project.materials.safetyInspection.checklist.reorderCriterion',
            },
            { criterion: criterionNumber, group: groupIndex + 1 },
          )}
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical />
        </Button>
      </TableCell>
      <TableCell className="w-20 border-e border-border px-2 py-2 text-center">
        <span className="text-sm tabular-nums text-foreground">
          {criterionNumber}
        </span>
      </TableCell>
      <TableCell className="border-e border-border px-2 py-1">
        <div className="space-y-1">
          <Input
            value={criterion.content}
            variant="ghost"
            className="h-9 min-w-0 w-full rounded-none"
            aria-label={intl.formatMessage(
              {
                id: 'project.materials.safetyInspection.checklist.criterionNumber',
              },
              { group: groupIndex + 1, criterion: criterionIndex + 1 },
            )}
            aria-invalid={isInvalid}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          {isInvalid && (
            <p className="px-1 text-xs text-destructive">
              {intl.formatMessage({
                id: 'project.materials.safetyInspection.checklist.criterionRequired',
              })}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="w-20 px-1 py-1">
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="destructive"
            appearance="ghost"
            mode="icon"
            size="icon"
            aria-label={intl.formatMessage(
              {
                id: 'project.materials.safetyInspection.checklist.removeCriterion',
              },
              { criterion: criterionNumber, group: groupIndex + 1 },
            )}
            onClick={onRemove}
            disabled={group.criteria.length <= 1}
          >
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </SortableTableRow>
  );
}

function SortableChecklistGroup({
  group,
  groupIndex,
  collapsed,
  onToggleCollapsed,
  onChange,
  onRemove,
  onAddCriterion,
  onChangeCriterion,
  onRemoveCriterion,
}: {
  group: SafetyInspectionChecklistGroup;
  groupIndex: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onChange: (group: SafetyInspectionChecklistGroup) => void;
  onRemove: () => void;
  onAddCriterion: () => void;
  onChangeCriterion: (criterionId: string, content: string) => void;
  onRemoveCriterion: (criterionId: string) => void;
}) {
  const intl = useIntl();
  const [nameTouched, setNameTouched] = useState(false);
  const sortable = useSortable({ id: groupDndId(group.id) });
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  const groupNumber = groupIndex + 1;
  const nameIsInvalid = nameTouched && !group.name.trim();
  const SortableTableBody = TableBody as typeof TableBody & {
    (
      props: ComponentProps<typeof TableBody> & {
        ref?: Ref<HTMLTableSectionElement>;
      },
    ): ReactElement;
  };

  return (
    <SortableTableBody
      ref={sortable.setNodeRef}
      style={style}
      className={cn(sortable.isDragging && 'relative z-10 opacity-90')}
    >
      <TableRow hoverable={false} className="bg-background">
        <TableCell className="w-12 border-e border-border px-1 py-1 text-center">
          <Button
            {...sortable.attributes}
            {...sortable.listeners}
            type="button"
            variant="ghost"
            mode="icon"
            size="icon"
            aria-label={intl.formatMessage(
              {
                id: 'project.materials.safetyInspection.checklist.reorderGroup',
              },
              { group: groupNumber },
            )}
            className="cursor-grab text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical />
          </Button>
        </TableCell>
        <TableCell className="w-20 border-e border-border px-2 py-2 text-center">
          <div className="flex items-center justify-center gap-0.5">
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {groupNumber}
            </span>
            <Button
              type="button"
              variant="primary"
              appearance="ghost"
              mode="icon"
              size="icon"
              aria-label={intl.formatMessage(
                {
                  id: collapsed
                    ? 'project.materials.safetyInspection.checklist.expandGroup'
                    : 'project.materials.safetyInspection.checklist.collapseGroup',
                },
                { group: groupNumber },
              )}
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
            >
              <ChevronUp
                className={cn(
                  'transition-transform duration-200 ease-in-out motion-reduce:transition-none',
                  collapsed && 'rotate-180',
                )}
              />
            </Button>
          </div>
        </TableCell>
        <TableCell className="border-e border-border px-2 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <Input
                value={group.name}
                variant="ghost"
                aria-label={intl.formatMessage(
                  {
                    id: 'project.materials.safetyInspection.checklist.groupName',
                  },
                  { group: groupNumber },
                )}
                aria-invalid={nameIsInvalid}
                onChange={(event) =>
                  onChange({ ...group, name: event.target.value })
                }
                onBlur={() => setNameTouched(true)}
                className="h-9 min-w-0 w-full rounded-none font-semibold text-foreground"
              />
              {nameIsInvalid && (
                <p className="px-1 pt-1 text-xs text-destructive">
                  {intl.formatMessage({
                    id: 'project.materials.safetyInspection.checklist.groupNameRequired',
                  })}
                </p>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  appearance="light"
                  size="sm"
                  tabIndex={0}
                  className="cursor-help"
                  aria-label={intl.formatMessage(
                    {
                      id: 'project.materials.safetyInspection.checklist.criteriaCount',
                    },
                    { count: group.criteria.length },
                  )}
                >
                  {group.criteria.length}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {intl.formatMessage(
                  {
                    id: 'project.materials.safetyInspection.checklist.criteriaCount',
                  },
                  { count: group.criteria.length },
                )}
              </TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
        <TableCell className="w-20 px-1 py-1 text-center">
          <div className="flex items-center justify-end gap-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="success"
                  appearance="ghost"
                  mode="icon"
                  size="icon"
                  aria-label={intl.formatMessage({
                    id: 'project.materials.safetyInspection.checklist.addCriterion',
                  })}
                  onClick={onAddCriterion}
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {intl.formatMessage({
                  id: 'project.materials.safetyInspection.checklist.addCriterion',
                })}
              </TooltipContent>
            </Tooltip>
            <Button
              type="button"
              variant="destructive"
              appearance="ghost"
              mode="icon"
              size="icon"
              aria-label={intl.formatMessage(
                {
                  id: 'project.materials.safetyInspection.checklist.removeGroup',
                },
                { group: groupNumber },
              )}
              onClick={onRemove}
            >
              <Trash2 />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {!collapsed && (
        <SortableContext
          items={group.criteria.map((criterion) =>
            criterionDndId(group.id, criterion.id),
          )}
          strategy={verticalListSortingStrategy}
        >
          {group.criteria.map((criterion, criterionIndex) => (
            <SortableCriterionRow
              key={criterion.id}
              group={group}
              groupIndex={groupIndex}
              criterion={criterion}
              criterionIndex={criterionIndex}
              onChange={(content) => onChangeCriterion(criterion.id, content)}
              onRemove={() => onRemoveCriterion(criterion.id)}
            />
          ))}
        </SortableContext>
      )}
    </SortableTableBody>
  );
}

export function SafetyInspectionChecklistEditor({
  groups,
  onChange,
  fillHeight = false,
}: SafetyInspectionChecklistEditorProps) {
  const intl = useIntl();
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set(),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const criteriaCount = groups.reduce(
    (count, group) => count + group.criteria.length,
    0,
  );

  const updateGroup = (
    groupId: string,
    update: (
      group: SafetyInspectionChecklistGroup,
    ) => SafetyInspectionChecklistGroup,
  ) => {
    onChange(
      groups.map((group) => (group.id === groupId ? update(group) : group)),
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('group:') && overId.startsWith('group:')) {
      const activeGroupId = activeId.slice('group:'.length);
      const overGroupId = overId.slice('group:'.length);
      const oldIndex = groups.findIndex((group) => group.id === activeGroupId);
      const newIndex = groups.findIndex((group) => group.id === overGroupId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = [...groups];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      onChange(reordered);
      return;
    }

    if (activeId.startsWith('criterion:') && overId.startsWith('criterion:')) {
      const [, activeGroupId, activeCriterionId] = activeId.split(':');
      const [, overGroupId, overCriterionId] = overId.split(':');
      if (activeGroupId !== overGroupId) return;
      updateGroup(activeGroupId, (group) => {
        const oldIndex = group.criteria.findIndex(
          (criterion) => criterion.id === activeCriterionId,
        );
        const newIndex = group.criteria.findIndex(
          (criterion) => criterion.id === overCriterionId,
        );
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
          return group;
        }
        const criteria = [...group.criteria];
        const [moved] = criteria.splice(oldIndex, 1);
        criteria.splice(newIndex, 0, moved);
        return { ...group, criteria };
      });
    }
  };

  const addGroup = () => {
    const id = crypto.randomUUID();
    onChange([
      ...groups,
      {
        id,
        name: '',
        criteria: [{ id: crypto.randomUUID(), content: '' }],
      },
    ]);
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const addCriterion = (groupId: string) => {
    updateGroup(groupId, (group) => ({
      ...group,
      criteria: [...group.criteria, { id: crypto.randomUUID(), content: '' }],
    }));
  };

  const removeGroup = (groupId: string) => {
    onChange(groups.filter((group) => group.id !== groupId));
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      next.delete(groupId);
      return next;
    });
  };

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3',
        fillHeight && 'h-full min-h-0',
      )}
    >
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm text-foreground">
          {intl.formatMessage(
            { id: 'project.materials.safetyInspection.checklist.count' },
            { groups: groups.length, criteria: criteriaCount },
          )}
        </span>
      </div>

      <ScrollArea
        className={cn(
          fillHeight && 'h-full min-h-0 flex-1',
          groups.length > 0 && 'rounded-md border border-border',
          groups.length > 0 && 'bg-background',
        )}
        viewportClassName={cn(fillHeight && 'h-full')}
      >
        {groups.length === 0 ? (
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 text-sm text-muted-foreground',
              fillHeight ? 'h-full min-h-32' : 'min-h-32',
            )}
          >
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.checklist.empty',
            })}
            <Button
              type="button"
              variant="primary"
              appearance="ghost"
              size="sm"
              onClick={addGroup}
            >
              <Plus />
              {intl.formatMessage({
                id: 'project.materials.safetyInspection.checklist.addGroup',
              })}
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={inspectionCollisionDetection}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={groups.map((group) => groupDndId(group.id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="min-w-[760px] pb-1 pe-2">
                <table className="w-full table-fixed border-collapse bg-background text-foreground text-sm">
                  <TableHeader>
                    <TableRow hoverable={false}>
                      <TableHead className="sticky top-0 z-20 w-12 border-e border-border bg-background px-1 text-center" />
                      <TableHead className="sticky top-0 z-20 w-20 border-e border-border bg-background px-2 text-center">
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.checklist.rowNumber',
                        })}
                      </TableHead>
                      <TableHead className="sticky top-0 z-20 border-e border-border bg-background px-3">
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.checklist.criterion',
                        })}
                      </TableHead>
                      <TableHead className="sticky top-0 z-20 w-20 bg-background px-1 text-center" />
                    </TableRow>
                  </TableHeader>
                  {groups.map((group, groupIndex) => (
                    <SortableChecklistGroup
                      key={group.id}
                      group={group}
                      groupIndex={groupIndex}
                      collapsed={collapsedGroupIds.has(group.id)}
                      onToggleCollapsed={() =>
                        setCollapsedGroupIds((current) => {
                          const next = new Set(current);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        })
                      }
                      onChange={(updatedGroup) =>
                        onChange(
                          groups.map((item) =>
                            item.id === group.id ? updatedGroup : item,
                          ),
                        )
                      }
                      onRemove={() => removeGroup(group.id)}
                      onAddCriterion={() => addCriterion(group.id)}
                      onChangeCriterion={(criterionId, content) =>
                        updateGroup(group.id, (item) => ({
                          ...item,
                          criteria: item.criteria.map((criterion) =>
                            criterion.id === criterionId
                              ? { ...criterion, content }
                              : criterion,
                          ),
                        }))
                      }
                      onRemoveCriterion={(criterionId) =>
                        updateGroup(group.id, (item) => ({
                          ...item,
                          criteria: item.criteria.filter(
                            (criterion) => criterion.id !== criterionId,
                          ),
                        }))
                      }
                    />
                  ))}
                  <TableFooter className="bg-background">
                    <TableRow hoverable={false}>
                      <TableCell
                        colSpan={4}
                        className="border-t border-border px-2 py-2"
                      >
                        <Button
                          type="button"
                          variant="primary"
                          appearance="ghost"
                          size="sm"
                          onClick={addGroup}
                        >
                          <Plus />
                          {intl.formatMessage({
                            id: 'project.materials.safetyInspection.checklist.addGroup',
                          })}
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </table>
              </div>
            </SortableContext>
          </DndContext>
        )}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
