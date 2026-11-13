/**
 * Scaffolded by tree-builder from `src/project/material-groups/tree/material-group.tree.fixture.ts`. Run `npm run gen:tree` — do NOT hand-write this file.
 * You own this file now — wire the callback props to screen logic or override the presentation.
 * To change the node shape or action list, edit the spec and re-gen to a scratch path first.
 */
import { useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronRight,
  Folder,
  Pencil,
  Plus,
  Power,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MaterialGroupTreeNode } from '../model/material-group-tree';

export interface MaterialGroupTreeProps {
  nodes: MaterialGroupTreeNode[];
  selectedId: string | null;
  countByNode: Map<string, number>;
  onSelect: (id: string) => void;
  onAdd?: (parentId: string | null) => void;
  onEdit?: (node: MaterialGroupTreeNode) => void;
  onDelete?: (node: MaterialGroupTreeNode) => void;
  onToggleAvailability?: (node: MaterialGroupTreeNode) => void;
  onMove?: (groupId: string, parentId: string | null) => void;
  canMove?: (groupId: string, parentId: string | null) => boolean;
  isMovePending?: boolean;
  pendingAvailabilityIds?: ReadonlySet<string>;
}

export interface MaterialGroupTreePanelProps extends MaterialGroupTreeProps {
  className?: string;
  allCount?: number;
  isAllSelected?: boolean;
  onSelectAll?: () => void;
}

const treeCollisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

export function MaterialGroupTreePanel({
  className,
  allCount,
  isAllSelected = false,
  onSelectAll,
  ...treeProps
}: MaterialGroupTreePanelProps) {
  const [activeGroup, setActiveGroup] = useState<{
    id: string;
    parentId: string | null;
  } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const source = active.data.current as
      | { groupId?: unknown; parentId?: unknown }
      | undefined;
    const groupId = source?.groupId;
    const sourceParentId =
      typeof source?.parentId === 'string' ? source.parentId : null;
    const target = over?.data.current as
      | {
          dropType?: string;
          groupId?: string;
          parentId?: string | null;
          siblingParentId?: string | null;
        }
      | undefined;
    const parentId =
      target?.dropType === 'root'
        ? null
        : target?.dropType === 'group' && typeof target.parentId === 'string'
          ? sourceParentId === target.groupId
            ? (target.siblingParentId ?? null)
            : target.groupId
          : undefined;

    if (
      typeof groupId === 'string' &&
      parentId !== undefined &&
      (treeProps.canMove?.(groupId, parentId) ?? true)
    ) {
      treeProps.onMove?.(groupId, parentId);
    }
    setActiveGroup(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={treeCollisionDetection}
      onDragStart={({ active }) => {
        const source = active.data.current as
          | { groupId?: unknown; parentId?: unknown }
          | undefined;
        setActiveGroup(
          typeof source?.groupId === 'string'
            ? {
                id: source.groupId,
                parentId:
                  typeof source.parentId === 'string' ? source.parentId : null,
              }
            : null,
        );
      }}
      onDragCancel={() => setActiveGroup(null)}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className={cn('min-h-0 flex-1 px-2 pt-2 pb-3', className)}>
        {onSelectAll && allCount !== undefined && (
          <MaterialGroupTreeRootRow
            allCount={allCount}
            isAllSelected={isAllSelected}
            activeGroup={activeGroup}
            onSelectAll={onSelectAll}
            onAdd={treeProps.onAdd}
            onMove={treeProps.onMove}
            canMove={treeProps.canMove}
            isMovePending={treeProps.isMovePending}
          />
        )}
        <MaterialGroupTree {...treeProps} activeGroup={activeGroup} />
      </ScrollArea>
    </DndContext>
  );
}

function MaterialGroupTreeRootRow({
  allCount,
  isAllSelected,
  activeGroup,
  onSelectAll,
  onAdd,
  onMove,
  canMove,
  isMovePending,
}: {
  allCount: number;
  isAllSelected: boolean;
  activeGroup: { id: string; parentId: string | null } | null;
  onSelectAll: () => void;
  onAdd?: (parentId: string | null) => void;
  onMove?: (groupId: string, parentId: string | null) => void;
  canMove?: (groupId: string, parentId: string | null) => boolean;
  isMovePending?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'material-group-drop-root',
    data: { dropType: 'root', parentId: null },
    disabled:
      !onMove ||
      isMovePending ||
      (activeGroup !== null && !(canMove?.(activeGroup.id, null) ?? true)),
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative mb-1 flex w-full items-center rounded-admin-control hover:bg-admin-surface-alt',
        isOver && 'bg-primary/5 ring-2 ring-inset ring-primary',
      )}
    >
      <button
        type="button"
        aria-pressed={isAllSelected}
        className={cn(
          'flex w-full items-center rounded-admin-control px-3 py-1.5 text-start text-sm',
          isAllSelected ? 'font-medium text-primary' : 'text-foreground',
        )}
        onClick={onSelectAll}
      >
        <span>{'Tất cả'}</span>
      </button>
      <Badge
        size="sm"
        shape="circle"
        variant={isAllSelected ? 'primary' : 'secondary'}
        appearance={isAllSelected ? 'default' : 'light'}
        className="absolute end-3 top-1/2 -translate-y-1/2 group-hover:hidden"
      >
        {allCount}
      </Badge>
      <div className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {onAdd && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={'Thêm nhóm'}
                className="size-6 text-muted-foreground"
                onClick={() => onAdd(null)}
              >
                <Plus className="size-3.5 !opacity-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent variant="light">{'Thêm nhóm'}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

type MaterialGroupTreeListProps = MaterialGroupTreeProps & {
  activeGroup: { id: string; parentId: string | null } | null;
};

export function MaterialGroupTree({
  nodes,
  selectedId,
  countByNode,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onToggleAvailability,
  onMove,
  canMove,
  isMovePending,
  pendingAvailabilityIds,
  activeGroup,
}: MaterialGroupTreeListProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node, index) => (
        <MaterialGroupTreeItem
          key={node.id}
          node={node}
          isLastSibling={index === nodes.length - 1}
          selectedId={selectedId}
          countByNode={countByNode}
          onSelect={onSelect}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleAvailability={onToggleAvailability}
          onMove={onMove}
          canMove={canMove}
          isMovePending={isMovePending}
          activeGroup={activeGroup}
          pendingAvailabilityIds={pendingAvailabilityIds}
        />
      ))}
    </ul>
  );
}

type MaterialGroupTreeItemProps = Omit<MaterialGroupTreeProps, 'nodes'> & {
  node: MaterialGroupTreeNode;
  isLastSibling: boolean;
  activeGroup: { id: string; parentId: string | null } | null;
};

function MaterialGroupTreeItem({
  node,
  isLastSibling,
  selectedId,
  countByNode,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onToggleAvailability,
  onMove,
  canMove,
  isMovePending,
  pendingAvailabilityIds,
  activeGroup,
}: MaterialGroupTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;
  const nodeCount = countByNode.get(node.id) ?? 0;
  const draggable = useDraggable({
    id: `material-group-drag:${node.id}`,
    data: { groupId: node.id, parentId: node.parentId },
    disabled: !onMove || isMovePending,
  });
  const droppable = useDroppable({
    id: `material-group-drop:${node.id}`,
    data: {
      dropType: 'group',
      groupId: node.id,
      parentId: node.id,
      siblingParentId: node.parentId,
    },
    disabled:
      !onMove ||
      isMovePending ||
      (activeGroup !== null &&
        !(
          canMove?.(
            activeGroup.id,
            activeGroup.parentId === node.id ? node.parentId : node.id,
          ) ?? true
        )),
  });
  const setRowRef = (element: HTMLDivElement | null) => {
    draggable.setNodeRef(element);
    droppable.setNodeRef(element);
  };

  return (
    <li>
      <div
        ref={setRowRef}
        className={cn(
          'group relative z-10 isolate flex items-center gap-1 rounded-admin-control py-1.5 pr-3 text-sm hover:bg-admin-surface-alt',
          isSelected && 'bg-admin-surface-alt',
          droppable.isOver && 'bg-primary/5 ring-2 ring-inset ring-primary',
        )}
        style={{
          paddingLeft: `${node.depth * 16 + 4}px`,
          transform: CSS.Translate.toString(draggable.transform),
          opacity: draggable.isDragging ? 0.45 : undefined,
        }}
      >
        {node.depth > 0 && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 z-0 w-px bg-border"
              style={{
                left: `${node.depth * 16 - 2}px`,
                bottom: isLastSibling ? '50%' : '-2px',
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 z-0 h-px bg-border"
              style={{
                left: `${node.depth * 16 - 2}px`,
                width: '30px',
              }}
            />
          </>
        )}
        {hasChildren && isExpanded && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 z-0 w-px bg-border"
            style={{
              left: `${node.depth * 16 + 14}px`,
              bottom: '-2px',
            }}
          />
        )}
        {hasChildren ? (
          <button
            type="button"
            aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
            className="relative z-10 flex size-5 shrink-0 items-center justify-center text-muted-foreground"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            <ChevronRight
              className={cn(
                'size-4 transition-transform',
                isExpanded && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="relative z-10 size-5 shrink-0" />
        )}

        <button
          ref={onMove ? draggable.setActivatorNodeRef : undefined}
          type="button"
          aria-label={
            onMove
              ? `Kéo để di chuyển nhóm ${node.name}`
              : `Chọn nhóm ${node.name}`
          }
          aria-pressed={isSelected}
          className={cn(
            'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-sm',
            isSelected ? 'text-primary' : 'text-admin-blue-dark',
            onMove &&
              !isMovePending &&
              'cursor-grab touch-none active:cursor-grabbing',
          )}
          onClick={() => onSelect(node.id)}
          {...(onMove ? draggable.attributes : {})}
          {...(onMove ? draggable.listeners : {})}
        >
          <Folder className="size-4 shrink-0" />
        </button>

        <button
          type="button"
          aria-pressed={isSelected}
          className={cn(
            'relative z-10 flex min-w-0 flex-1 items-center gap-2 text-start',
            isSelected && 'font-medium text-primary',
          )}
          onClick={() => onSelect(node.id)}
        >
          <span className="truncate">{node.name}</span>
          {!node.isActive && (
            <Badge size="sm" variant="secondary" appearance="light">
              Ngừng dùng
            </Badge>
          )}
        </button>

        <Badge
          size="sm"
          shape="circle"
          variant={isSelected ? 'primary' : 'secondary'}
          appearance={isSelected ? 'default' : 'light'}
          className="ms-auto shrink-0 group-hover:hidden"
          aria-label={`${nodeCount} nhóm con`}
        >
          {nodeCount}
        </Badge>
        <div className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 group-hover:opacity-100">
          {onAdd && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={'Thêm nhóm con'}
                  className="size-6 text-muted-foreground"
                  onClick={() => onAdd(node.id)}
                >
                  <Plus className="size-3.5 !opacity-100" />
                </Button>
              </TooltipTrigger>
              <TooltipContent variant="light">{'Thêm nhóm con'}</TooltipContent>
            </Tooltip>
          )}
          {onEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={'Sửa nhóm'}
                  className="size-6 text-primary"
                  onClick={() => onEdit(node)}
                >
                  <Pencil className="size-3.5 !opacity-100" />
                </Button>
              </TooltipTrigger>
              <TooltipContent variant="light">{'Sửa nhóm'}</TooltipContent>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={'Xóa nhóm'}
                  className="size-6 text-destructive"
                  onClick={() => onDelete(node)}
                >
                  <Trash2 className="size-3.5 !opacity-100" />
                </Button>
              </TooltipTrigger>
              <TooltipContent variant="light">{'Xóa nhóm'}</TooltipContent>
            </Tooltip>
          )}
          {onToggleAvailability && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={
                    node.isActive
                      ? `Ngừng sử dụng nhóm ${node.name}`
                      : `Bật sử dụng nhóm ${node.name}`
                  }
                  className="size-6 text-muted-foreground"
                  disabled={pendingAvailabilityIds?.has(node.id)}
                  onClick={() => onToggleAvailability(node)}
                >
                  <Power className="size-3.5 !opacity-100" />
                </Button>
              </TooltipTrigger>
              <TooltipContent variant="light">
                {node.isActive ? 'Ngừng sử dụng' : 'Bật sử dụng'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <MaterialGroupTree
          nodes={node.children}
          selectedId={selectedId}
          countByNode={countByNode}
          onSelect={onSelect}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleAvailability={onToggleAvailability}
          onMove={onMove}
          canMove={canMove}
          activeGroup={activeGroup}
          pendingAvailabilityIds={pendingAvailabilityIds}
        />
      )}
    </li>
  );
}
