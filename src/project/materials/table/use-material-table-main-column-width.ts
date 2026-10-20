import { useEffect, useRef } from 'react';
import type { Table } from '@tanstack/react-table';

const MAIN_COLUMN_ID = 'identity';
const MIN_MAIN_COLUMN_WIDTH = 260;

export function useMaterialTableMainColumnWidth<TData extends object>(
  table: Table<TData>,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const fixedColumnsWidth = table
    .getVisibleLeafColumns()
    .filter((column) => column.id !== MAIN_COLUMN_ID)
    .reduce((total, column) => total + column.getSize(), 0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateMainColumnWidth = () => {
      const width = Math.max(
        MIN_MAIN_COLUMN_WIDTH,
        viewport.clientWidth - fixedColumnsWidth,
      );
      table.setColumnSizing((current) =>
        current[MAIN_COLUMN_ID] === width
          ? current
          : { ...current, [MAIN_COLUMN_ID]: width },
      );
    };

    updateMainColumnWidth();
    const observer = new ResizeObserver(updateMainColumnWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fixedColumnsWidth, table]);

  return viewportRef;
}
