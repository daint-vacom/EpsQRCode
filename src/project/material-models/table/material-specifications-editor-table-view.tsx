import type { CSSProperties, ReactNode, Ref } from 'react';
import { useIntl } from 'react-intl';
import { CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaterialSpecificationsActionBar } from './material-specifications-action-bar';
import { MaterialSpecificationsTableHeader } from './material-specifications-table-header';

export type MaterialSpecificationsEditorTableMode = 'model' | 'material';
export type MaterialSpecificationsEditorTableRowProps = {
  selection?: ReactNode;
  edit?: ReactNode;
  visible?: ReactNode;
  rowRef?: Ref<HTMLTableRowElement>;
  rowStyle?: CSSProperties;
  isDragging?: boolean;
};

type SharedTableViewProps = {
  count: number;
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  clipboardCount?: number;
  onPaste?: () => void;
  onToggleAll: (checked: boolean) => void;
  selectionAction: string;
  onSelectionActionChange: (action: string) => void;
  onApplySelectionAction: (action: string) => void;
  onClearSelection: () => void;
  beforeTable?: ReactNode;
  emptyState?: ReactNode;
  children: ReactNode;
};

type MaterialSpecificationsEditorTableViewProps =
  | (SharedTableViewProps & {
      mode: 'model';
      onAddRow: () => void;
    })
  | (SharedTableViewProps & {
      mode: 'material';
    });

export function MaterialSpecificationsEditorTableView({
  mode,
  count,
  selectedCount,
  allSelected,
  someSelected,
  clipboardCount = 0,
  onPaste,
  onToggleAll,
  selectionAction,
  onSelectionActionChange,
  onApplySelectionAction,
  onClearSelection,
  onAddRow,
  beforeTable,
  emptyState,
  children,
}: MaterialSpecificationsEditorTableViewProps) {
  const intl = useIntl();
  const columnCount = mode === 'model' ? 6 : 5;
  const headerProps =
    mode === 'model' ? { mode, count, onAddRow } : { mode, count };

  return (
    <>
      <MaterialSpecificationsTableHeader
        {...headerProps}
        clipboardCount={mode === 'model' ? clipboardCount : 0}
        onPaste={mode === 'model' ? onPaste : undefined}
      />
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
        {beforeTable}
        <ScrollArea
          type="always"
          className="min-h-0 min-w-0 flex-1"
          viewportClassName="h-full min-w-0 overflow-y-auto"
        >
          <div className="min-w-[768px]">
            <table className="w-full caption-bottom text-foreground text-sm">
              <TableHeader>
                <TableRow hoverable={false}>
                  {mode === 'model' ? (
                    <TableHead className="sticky top-0 z-20 w-12 min-w-12 max-w-12 bg-muted px-2 text-center align-middle" />
                  ) : null}
                  <TableHead className="sticky top-0 z-20 w-12 min-w-12 max-w-12 bg-muted px-2 py-2 text-center align-middle">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={
                          allSelected
                            ? true
                            : someSelected
                              ? 'indeterminate'
                              : false
                        }
                        aria-label={intl.formatMessage({
                          id: 'materialModels.specifications.selection.selectAll',
                        })}
                        onCheckedChange={(checked) =>
                          onToggleAll(checked === true)
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 w-24 bg-muted text-center">
                    {intl.formatMessage({
                      id: 'project.materials.fields.specificationVisible',
                    })}
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 min-w-[260px] bg-muted">
                    {intl.formatMessage({
                      id: 'materialModels.specifications.column',
                    })}
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 min-w-[360px] bg-muted">
                    {intl.formatMessage({
                      id: 'materialModels.specifications.values',
                    })}
                  </TableHead>
                  {mode === 'material' ? (
                    <TableHead className="sticky top-0 z-20 w-20 bg-muted text-center">
                      {intl.formatMessage({
                        id: 'project.materials.fields.specificationEdit',
                      })}
                    </TableHead>
                  ) : null}
                  {mode === 'model' ? (
                    <TableHead className="sticky top-0 right-0 z-30 w-24 bg-muted text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {count === 0 ? (
                  <TableSpecificationsStateRow
                    colSpan={columnCount}
                    className="h-28"
                  >
                    {emptyState ?? (
                      <span className="text-muted-foreground">
                        {intl.formatMessage({
                          id: 'materialModels.specifications.empty',
                        })}
                      </span>
                    )}
                  </TableSpecificationsStateRow>
                ) : null}
                {children}
              </TableBody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
      <MaterialSpecificationsActionBar
        selectedCount={selectedCount}
        allowCopy={mode === 'model'}
        action={selectionAction}
        onActionChange={onSelectionActionChange}
        onApply={onApplySelectionAction}
        applyDisabled={false}
        onClear={onClearSelection}
      />
    </>
  );
}

export function MaterialSpecificationsEditorTableRow({
  mode,
  selection,
  children,
  name,
  value,
  edit,
  visible,
  rowRef,
  rowStyle,
  isDragging,
}: MaterialSpecificationsEditorTableRowProps &
  (
    | { mode: 'model'; children: ReactNode }
    | {
        mode: 'material';
        name: ReactNode;
        value: ReactNode;
        visible: ReactNode;
        edit: ReactNode;
      }
  )) {
  return (
    <TableRow
      ref={rowRef}
      style={rowStyle}
      data-dragging={isDragging || undefined}
      hoverable={false}
    >
      {mode === 'model' ? (
        children
      ) : (
        <>
          <TableCell className="w-12 min-w-12 max-w-12 px-2 py-2 text-center align-middle">
            <div className="flex justify-center">{selection}</div>
          </TableCell>
          <TableCell className="w-24 px-2 py-2 text-center align-top">
            {visible}
          </TableCell>
          <TableCell className="px-2 py-2 align-top">{name}</TableCell>
          <TableCell className="px-2 py-2 align-top">{value}</TableCell>
          <TableCell className="w-20 px-2 py-2 text-center align-top">
            {edit}
          </TableCell>
        </>
      )}
    </TableRow>
  );
}

export function TableSpecificationsStateRow({
  colSpan,
  className,
  children,
}: {
  colSpan: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TableRow hoverable={false}>
      <TableCell colSpan={colSpan} className={className}>
        {children}
      </TableCell>
    </TableRow>
  );
}
