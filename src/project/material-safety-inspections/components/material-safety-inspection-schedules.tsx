import { buildPath, ROUTES } from '@/constants/routes';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { Card, CardHeader, CardTable, CardTitle } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useMaterialSafetyInspectionTypesQuery } from '../hooks/use-safety-inspections';
import type { MaterialSafetyInspectionType } from '../model/safety-inspection';
import { useMaterialSafetyInspectionScheduleColumns } from '../table/material-safety-inspection-schedule.columns.generated';

const EMPTY_TYPES: MaterialSafetyInspectionType[] = [];

export function MaterialSafetyInspectionSchedules({
  materialId,
  canManage,
}: {
  materialId: string;
  canManage: boolean;
}) {
  const intl = useIntl();
  const types = useMaterialSafetyInspectionTypesQuery(materialId);
  const items = types.data ?? EMPTY_TYPES;
  const materialPath = buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, {
    id: materialId,
  });
  const columns = useMaterialSafetyInspectionScheduleColumns(
    materialId,
    canManage,
    materialPath,
  );
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.typeId,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility: { start: canManage } },
  });

  return (
    <DataGrid
      table={table}
      recordCount={items.length}
      isLoading={types.isPending}
      isFetching={types.isFetching}
      emptyMessage={intl.formatMessage({
        id: 'project.materials.safetyInspection.schedule.empty',
      })}
      tableLayout={{ dense: true }}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.schedule.title',
            })}
          </CardTitle>
        </CardHeader>
        <CardTable>
          {types.isError ? (
            <ErrorState
              title={intl.formatMessage({
                id: 'project.materials.safetyInspection.schedule.loadTitle',
              })}
              description={getApiErrorMessage(types.error)}
              onRetry={() => void types.refetch()}
            />
          ) : (
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardTable>
      </Card>
    </DataGrid>
  );
}
