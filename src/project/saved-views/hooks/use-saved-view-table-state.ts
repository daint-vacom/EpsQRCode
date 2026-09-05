import { useCallback } from 'react';
import type { ColumnOrderState, VisibilityState } from '@tanstack/react-table';
import {
  usePersistedColumnOrder,
  usePersistedColumnVisibility,
} from '@/components/ui/data-grid-columns';
import type { SavedViewConfig } from '../model/saved-view';

interface SavedViewTableStateOptions {
  visibilityStorageKey: string;
  orderStorageKey: string;
  defaultColumnVisibility?: VisibilityState;
  defaultColumnOrder?: ColumnOrderState;
}

interface SavedViewTableStateResetOptions {
  columnVisibility?: VisibilityState;
  columnOrder?: ColumnOrderState;
}

export function useSavedViewTableState<TFilters extends object>({
  visibilityStorageKey,
  orderStorageKey,
  defaultColumnVisibility = {},
  defaultColumnOrder = [],
}: SavedViewTableStateOptions) {
  const { columnVisibility, onColumnVisibilityChange } =
    usePersistedColumnVisibility(visibilityStorageKey, defaultColumnVisibility);
  const { columnOrder, onColumnOrderChange } = usePersistedColumnOrder(
    orderStorageKey,
    defaultColumnOrder,
  );

  const applySavedViewTableState = useCallback(
    (
      config: Pick<
        SavedViewConfig<TFilters>,
        'columnVisibility' | 'columnOrder'
      >,
    ) => {
      onColumnVisibilityChange(config.columnVisibility);
      onColumnOrderChange(config.columnOrder);
    },
    [onColumnOrderChange, onColumnVisibilityChange],
  );

  const resetSavedViewTableState = useCallback(
    (overrides: SavedViewTableStateResetOptions = {}) => {
      onColumnVisibilityChange(
        overrides.columnVisibility ?? defaultColumnVisibility,
      );
      onColumnOrderChange(overrides.columnOrder ?? defaultColumnOrder);
    },
    [
      defaultColumnOrder,
      defaultColumnVisibility,
      onColumnOrderChange,
      onColumnVisibilityChange,
    ],
  );

  return {
    columnVisibility,
    onColumnVisibilityChange,
    columnOrder,
    onColumnOrderChange,
    applySavedViewTableState,
    resetSavedViewTableState,
  };
}
