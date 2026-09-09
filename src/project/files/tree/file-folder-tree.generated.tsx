/**
 * Scaffolded by tree-builder from `src/project/files/tree/file-folder.tree.fixture.ts`. Run `npm run gen:tree` — do NOT hand-write this file.
 * You own this file now — wire the callback props to screen logic or override the presentation.
 * To change the node shape or action list, edit the spec and re-gen to a scratch path first.
 */
import { useState } from 'react';
import { ChevronRight, Folder, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FileFolder } from '../model/file-manager';

export interface FileFolderTreeProps {
  nodes: FileFolder[];
  selectedId: string | null;
  countByNode: Map<string, number>;
  onSelect: (id: string) => void;
  onAdd: (parentId: string | null) => void;
}

export interface FileFolderTreePanelProps extends FileFolderTreeProps {
  className?: string;
  allCount?: number;
  isAllSelected?: boolean;
  onSelectAll?: () => void;
}

export function FileFolderTreePanel({
  className,
  allCount,
  isAllSelected = false,
  onSelectAll,
  ...treeProps
}: FileFolderTreePanelProps) {
  return (
    <ScrollArea className={cn('min-h-0 flex-1 px-2 pt-2 pb-3', className)}>
      {onSelectAll && allCount !== undefined && (
        <div className="group relative mb-1 flex w-full items-center rounded-admin-control hover:bg-admin-surface-alt">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={'Tạo thư mục'}
                  className="size-6 text-muted-foreground"
                  onClick={() => treeProps.onAdd(null)}
                >
                  <Plus className="size-3.5 !opacity-100" />
                </Button>
              </TooltipTrigger>
              <TooltipContent variant="light">{'Tạo thư mục'}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
      <FileFolderTree {...treeProps} />
    </ScrollArea>
  );
}

export function FileFolderTree({
  nodes,
  selectedId,
  countByNode,
  onSelect,
  onAdd,
}: FileFolderTreeProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <FileFolderTreeItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          countByNode={countByNode}
          onSelect={onSelect}
          onAdd={onAdd}
        />
      ))}
    </ul>
  );
}

type FileFolderTreeItemProps = Omit<FileFolderTreeProps, 'nodes'> & {
  node: FileFolder;
};

function FileFolderTreeItem({
  node,
  selectedId,
  countByNode,
  onSelect,
  onAdd,
}: FileFolderTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;
  const nodeCount = countByNode.get(node.id) ?? 0;

  return (
    <li>
      <div
        className={cn(
          'group relative flex items-center gap-1 rounded-admin-control py-1.5 pr-3 text-sm hover:bg-admin-surface-alt',
          isSelected && 'bg-admin-surface-alt',
        )}
        style={{ paddingLeft: `${node.depth * 16 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
            className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
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
          <span className="size-5 shrink-0" />
        )}

        <button
          type="button"
          aria-pressed={isSelected}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 text-start',
            isSelected && 'font-medium text-primary',
          )}
          onClick={() => onSelect(node.id)}
        >
          <Folder
            className={cn(
              'size-4 shrink-0 text-admin-blue-dark',
              isSelected && 'text-primary',
            )}
          />
          <span className="truncate">{node.name}</span>
        </button>

        <Badge
          size="sm"
          shape="circle"
          variant={isSelected ? 'primary' : 'secondary'}
          appearance={isSelected ? 'default' : 'light'}
          className="ms-auto shrink-0 group-hover:hidden"
        >
          {nodeCount}
        </Badge>
        <div className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={'Tạo thư mục con'}
                className="size-6 text-muted-foreground"
                onClick={() => onAdd(node.id)}
              >
                <Plus className="size-3.5 !opacity-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent variant="light">{'Tạo thư mục con'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <FileFolderTree
          nodes={node.children}
          selectedId={selectedId}
          countByNode={countByNode}
          onSelect={onSelect}
          onAdd={onAdd}
        />
      )}
    </li>
  );
}
