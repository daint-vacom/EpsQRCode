import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { SafetyInspectionTypeConfigView } from '../model/safety-inspection-type-config';
import {
  SAFETY_INSPECTION_TYPE_CONFIG_VIEW_COLUMN_PINNING,
  useSafetyInspectionTypeConfigColumns,
} from '../table/safety-inspection-type-config.columns.generated';

export function SafetyInspectionTypeConfigTable({
  items,
  onEdit,
}: {
  items: SafetyInspectionTypeConfigView[];
  onEdit?: (item: SafetyInspectionTypeConfigView) => void;
}) {
  const columns = useSafetyInspectionTypeConfigColumns({ onEdit });
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.typeId,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnPinning: SAFETY_INSPECTION_TYPE_CONFIG_VIEW_COLUMN_PINNING,
      columnVisibility: { actions: Boolean(onEdit) },
    },
  });

  return (
    <DataGrid
      table={table}
      recordCount={items.length}
      tableLayout={{ dense: true, columnsPinnable: true }}
    >
      <ScrollArea>
        <DataGridTable />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </DataGrid>
  );
}
