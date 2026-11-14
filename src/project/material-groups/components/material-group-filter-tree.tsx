import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { MaterialGroup } from '../model/material-group';
import { buildMaterialGroupTree } from '../model/material-group-tree';
import {
  debugMaterialGroupTree,
  isMaterialGroupTreeDebugEnabled,
} from '../utils/material-group-tree-debug';
import { MaterialGroupTreePanel } from './material-group-tree.generated';

interface MaterialGroupFilterLayoutState {
  isOpen: boolean;
  toggle: () => void;
}

const MaterialGroupFilterLayoutContext =
  createContext<MaterialGroupFilterLayoutState | null>(null);

export function MaterialGroupFilterLayoutProvider({
  children,
}: PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleStartedAt = useRef<number | null>(null);
  const toggle = useCallback(() => {
    const startedAt = performance.now();
    toggleStartedAt.current = startedAt;
    debugMaterialGroupTree('sidebar:toggle', {
      fromOpen: isOpen,
      toOpen: !isOpen,
    });
    setIsOpen((current) => !current);
  }, [isOpen]);
  const value = useMemo(() => ({ isOpen, toggle }), [isOpen, toggle]);

  useEffect(() => {
    if (!isMaterialGroupTreeDebugEnabled()) return;
    const startedAt = toggleStartedAt.current;
    if (startedAt === null) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        debugMaterialGroupTree('sidebar:two-frames-after-toggle', {
          open: isOpen,
          elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
        });
        toggleStartedAt.current = null;
      });
    });
  }, [isOpen]);

  return (
    <MaterialGroupFilterLayoutContext.Provider value={value}>
      {children}
    </MaterialGroupFilterLayoutContext.Provider>
  );
}

function useMaterialGroupFilterLayoutState() {
  const state = useContext(MaterialGroupFilterLayoutContext);
  if (!state) {
    throw new Error(
      'Material group filter controls must be inside MaterialGroupFilterLayoutProvider.',
    );
  }
  return state;
}

export function MaterialGroupFilterLayout({ children }: PropsWithChildren) {
  const { isOpen } = useMaterialGroupFilterLayoutState();

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row',
        isOpen ? 'gap-3' : 'gap-0',
      )}
    >
      {children}
    </div>
  );
}

export interface MaterialGroupFilterTreeProps {
  groups: readonly MaterialGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  className?: string;
}

export interface MaterialGroupFilterToggleProps {
  isOpen?: boolean;
  onClick?: () => void;
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
  const layoutState = useContext(MaterialGroupFilterLayoutContext);
  const resolvedIsOpen = isOpen ?? layoutState?.isOpen ?? false;
  const handleClick = onClick ?? layoutState?.toggle;

  return (
    <Button
      type="button"
      variant="outline"
      mode="icon"
      size="md"
      aria-label={intl.formatMessage({
        id: resolvedIsOpen
          ? 'materialGroups.tree.hideFilter'
          : 'materialGroups.tree.showFilter',
      })}
      aria-expanded={resolvedIsOpen}
      aria-controls={controlsId}
      disabled={disabled}
      onClick={handleClick}
    >
      {resolvedIsOpen ? (
        <PanelLeftClose aria-hidden="true" />
      ) : (
        <PanelLeft aria-hidden="true" />
      )}
    </Button>
  );
}

export interface MaterialGroupFilterSidebarProps extends MaterialGroupFilterTreeProps {
  id: string;
  isOpen?: boolean;
}

export function MaterialGroupFilterSidebar({
  id,
  isOpen,
  ...treeProps
}: MaterialGroupFilterSidebarProps) {
  const layoutState = useContext(MaterialGroupFilterLayoutContext);
  const resolvedIsOpen = isOpen ?? layoutState?.isOpen ?? false;
  const transitionStartedAt = useRef(new Map<string, number>());

  return (
    <div
      id={id}
      aria-hidden={!resolvedIsOpen}
      inert={!resolvedIsOpen}
      className={cn(
        'grid min-h-0 min-w-0 overflow-hidden transition-opacity duration-150 ease-out motion-reduce:transition-none xl:h-full xl:shrink-0',
        resolvedIsOpen
          ? 'grid-rows-[1fr] opacity-100 xl:w-72'
          : 'grid-rows-[0fr] opacity-0 xl:w-0',
      )}
      onTransitionRun={(event) => {
        if (event.target !== event.currentTarget) return;
        const startedAt = performance.now();
        transitionStartedAt.current.set(event.propertyName, startedAt);
        debugMaterialGroupTree('transition:start', {
          property: event.propertyName,
          open: resolvedIsOpen,
        });
      }}
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        const startedAt = transitionStartedAt.current.get(event.propertyName);
        transitionStartedAt.current.delete(event.propertyName);
        debugMaterialGroupTree('transition:end', {
          property: event.propertyName,
          open: resolvedIsOpen,
          elapsedMs:
            startedAt === undefined
              ? undefined
              : Number((performance.now() - startedAt).toFixed(1)),
          cssElapsedMs: Number((event.elapsedTime * 1000).toFixed(1)),
        });
      }}
      onTransitionCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        transitionStartedAt.current.delete(event.propertyName);
        debugMaterialGroupTree('transition:cancel', {
          property: event.propertyName,
          open: resolvedIsOpen,
        });
      }}
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
