import { useMemo } from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { MaterialGroup } from '../model/material-group';
import { buildMaterialGroupTree } from '../model/material-group-tree';
import { MaterialGroupTreePanel } from './material-group-tree.generated';

export interface MaterialGroupFilterTreeProps {
  groups: readonly MaterialGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  className?: string;
}

export interface MaterialGroupFilterToggleProps {
  isOpen: boolean;
  onClick: () => void;
  disabled?: boolean;
  controlsId: string;
}

export function MaterialGroupFilterToggle({
  isOpen,
  onClick,
  disabled = false,
  controlsId,
}: MaterialGroupFilterToggleProps) {
  const intl = useIntl();

  return (
    <Button
      type="button"
      variant="outline"
      mode="icon"
      size="md"
      aria-label={intl.formatMessage({
        id: isOpen
          ? 'materialGroups.tree.hideFilter'
          : 'materialGroups.tree.showFilter',
      })}
      aria-expanded={isOpen}
      aria-controls={controlsId}
      disabled={disabled}
      onClick={onClick}
    >
      {isOpen ? (
        <PanelLeftClose aria-hidden="true" />
      ) : (
        <PanelLeft aria-hidden="true" />
      )}
    </Button>
  );
}

export interface MaterialGroupFilterSidebarProps extends MaterialGroupFilterTreeProps {
  id: string;
  isOpen: boolean;
}

export function MaterialGroupFilterSidebar({
  id,
  isOpen,
  ...treeProps
}: MaterialGroupFilterSidebarProps) {
  return (
    <div
      id={id}
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={cn(
        'grid min-h-0 min-w-0 overflow-hidden transition-[grid-template-rows,width,opacity] duration-300 ease-in-out motion-reduce:transition-none xl:h-full xl:shrink-0',
        isOpen
          ? 'grid-rows-[1fr] opacity-100 xl:w-72'
          : 'grid-rows-[0fr] opacity-0 xl:w-0',
      )}
    >
      <div className="min-h-0 min-w-0 overflow-hidden xl:h-full">
        <Card className="h-72 min-h-0 w-full overflow-hidden xl:h-full xl:min-h-0 xl:w-72">
          <MaterialGroupFilterTree {...treeProps} className="h-full" />
        </Card>
      </div>
    </div>
  );
}

export function MaterialGroupFilterTree({
  groups,
  selectedGroupId,
  onSelectGroup,
  className,
}: MaterialGroupFilterTreeProps) {
  const nodes = useMemo(() => buildMaterialGroupTree([...groups]), [groups]);
  const countByNode = useMemo(() => {
    const counts = new Map(groups.map((group) => [group.id, 0]));
    for (const group of groups) {
      if (!group.parentId || !counts.has(group.parentId)) continue;
      counts.set(group.parentId, (counts.get(group.parentId) ?? 0) + 1);
    }
    return counts;
  }, [groups]);

  return (
    <MaterialGroupTreePanel
      className={className}
      nodes={nodes}
      selectedId={selectedGroupId}
      countByNode={countByNode}
      allCount={groups.length}
      isAllSelected={selectedGroupId === null}
      onSelectAll={() => onSelectGroup(null)}
      onSelect={onSelectGroup}
    />
  );
}
