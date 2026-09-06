import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSavedViewTableState } from './use-saved-view-table-state';

describe('useSavedViewTableState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('applies a named view and restores the default table state', () => {
    const { result } = renderHook(() =>
      useSavedViewTableState<{ status: string }>({
        visibilityStorageKey: 'test.saved-view.visibility',
        orderStorageKey: 'test.saved-view.order',
        defaultColumnVisibility: { name: true, status: false },
        defaultColumnOrder: ['name', 'status'],
      }),
    );

    act(() => {
      result.current.applySavedViewTableState({
        columnVisibility: { name: false, status: true },
        columnOrder: ['status', 'name'],
      });
    });

    expect(result.current.columnVisibility).toEqual({
      name: false,
      status: true,
    });
    expect(result.current.columnOrder).toEqual(['status', 'name']);

    act(() => {
      result.current.resetSavedViewTableState();
    });

    expect(result.current.columnVisibility).toEqual({
      name: true,
      status: false,
    });
    expect(result.current.columnOrder).toEqual(['name', 'status']);
  });

  it('supports dynamic default visibility for columns loaded after mount', () => {
    const { result } = renderHook(() =>
      useSavedViewTableState<{ status: string }>({
        visibilityStorageKey: 'test.saved-view.dynamic-visibility',
        orderStorageKey: 'test.saved-view.dynamic-order',
        defaultColumnVisibility: { name: true },
      }),
    );

    act(() => {
      result.current.applySavedViewTableState({
        columnVisibility: { name: false, customField: true },
        columnOrder: [],
      });
      result.current.resetSavedViewTableState({
        columnVisibility: { name: true, customField: false },
      });
    });

    expect(result.current.columnVisibility).toEqual({
      name: true,
      customField: false,
    });
  });

  it('persists inline filter visibility with the table settings', () => {
    const options = {
      visibilityStorageKey: 'test.saved-view.inline-visibility',
      orderStorageKey: 'test.saved-view.inline-order',
      inlineFiltersStorageKey: 'test.saved-view.inline-filters',
    };
    const first = renderHook(() => useSavedViewTableState(options));

    expect(first.result.current.showInlineFilters).toBe(false);

    act(() => {
      first.result.current.onShowInlineFiltersChange(true);
    });

    expect(first.result.current.showInlineFilters).toBe(true);
    expect(localStorage.getItem(options.inlineFiltersStorageKey)).toBe('true');

    first.unmount();
    const second = renderHook(() => useSavedViewTableState(options));

    expect(second.result.current.showInlineFilters).toBe(true);
  });
});
