import type { CSSProperties, ReactNode, Ref } from 'react';
import { useIntl } from 'react-intl';
import { CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaterialSpecificationsTableHeader } from './material-specifications-table-header';

export type MaterialSpecificationsEditorTableMode = 'model' | 'material';
export type MaterialSpecificationsEditorTableRowProps = {
  edit?: ReactNode;
  visible?: ReactNode;
  rowRef?: Ref<HTMLTableRowElement>;
  rowStyle?: CSSProperties;
  isDragging?: boolean;
};

type SharedTableViewProps = {
  count: number;
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
  onAddRow,
  beforeTable,
  emptyState,
  children,
}: MaterialSpecificationsEditorTableViewProps) {
  const intl = useIntl();
  const columnCount = mode === 'model' ? 5 : 4;
  const headerProps =
    mode === 'model' ? { mode, count, onAddRow } : { mode, count };

  return (
    <>
      <MaterialSpecificationsTableHeader {...headerProps} />
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
                    <TableHead className="sticky top-0 z-20 w-12 bg-muted" />
                  ) : null}
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
    </>
  );
}

export function MaterialSpecificationsEditorTableRow({
  mode,
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
