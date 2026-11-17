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
import { useMaterialGroupModelCountsQuery } from '@/project/material-models/hooks/use-material-models';
import { useMaterialGroupMaterialCountsQuery } from '@/project/materials/hooks/use-materials';
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
  const [isOpen, setIsOpen] = useState(true);
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
        'flex min-h-0 min-w-0 flex-1 flex-col motion-safe:transition-[gap] motion-safe:duration-300 motion-safe:ease-in-out xl:flex-row',
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
  countMode?: 'materials' | 'models';
  countByNode?: Map<string, number>;
  allCount?: number;
  countLabelId?: string;
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
  animateSize?: boolean;
}

export function MaterialGroupFilterSidebar({
  id,
  isOpen,
  animateSize = false,
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
        'grid min-h-0 min-w-0 overflow-hidden xl:h-full xl:shrink-0',
        animateSize
          ? 'motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-in-out xl:grid-rows-[1fr] motion-safe:xl:transition-[width]'
          : 'motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out',
        resolvedIsOpen ? 'grid-rows-[1fr] xl:w-72' : 'grid-rows-[0fr] xl:w-0',
        !animateSize && (resolvedIsOpen ? 'opacity-100' : 'opacity-0'),
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
  countMode = 'materials',
  countByNode: countByNodeOverride,
  allCount: allCountOverride,
  countLabelId: countLabelIdOverride,
  className,
}: MaterialGroupFilterTreeProps) {
  const nodes = useMemo(() => buildMaterialGroupTree([...groups]), [groups]);
  const materialCountsQuery = useMaterialGroupMaterialCountsQuery(
    countByNodeOverride === undefined && countMode === 'materials',
  );
  const modelCountsQuery = useMaterialGroupModelCountsQuery(
    countByNodeOverride === undefined && countMode === 'models',
  );
  const counts =
    countMode === 'models' ? modelCountsQuery.data : materialCountsQuery.data;
  const countByNode = useMemo(
    () => countByNodeOverride ?? new Map(Object.entries(counts?.counts ?? {})),
    [countByNodeOverride, counts?.counts],
  );

  return (
    <MaterialGroupTreePanel
      className={className}
      nodes={nodes}
      selectedId={selectedGroupId}
      countByNode={countByNode}
      countLabelId={
        countLabelIdOverride ??
        (countMode === 'models'
          ? 'materialGroups.tree.modelCount'
          : 'materialGroups.tree.materialCount')
      }
      allCount={allCountOverride ?? counts?.total ?? 0}
      isAllSelected={selectedGroupId === null}
      onSelectAll={() => onSelectGroup(null)}
      onSelect={onSelectGroup}
    />
  );
}
