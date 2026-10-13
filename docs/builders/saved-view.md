# Saved-view builder

`saved-view` scaffolds the typed persistence adapter for a shared list view.
It normalizes legacy or incomplete JSON from the database back to the feature's initial
filter shape, validates enum arrays, and preserves column visibility/order.

```bash
npm run gen:saved-view -- <spec.ts> <out.ts>
```

The generated adapter does not own query state or UI. Feature hooks own filter state,
React Query and table state; `useSavedViews`, `SavedViewsToolbar` and
`SavedViewFormDialog` provide the shared runtime behavior.

## Apply a view to a table

List pages that support saved views must use
`src/project/saved-views/hooks/use-saved-view-table-state.ts` for persisted column
visibility and order. This keeps the saved-view selection flow consistent across
tables:

- Call `applySavedViewTableState(config)` when selecting a named view.
- Call `resetSavedViewTableState()` when selecting `null` (`Tất cả`) so the table
  returns to its page defaults instead of retaining the last named view.
- If a page has dynamic columns, pass their complete baseline visibility through
  `resetSavedViewTableState({ columnVisibility })` so newly loaded columns also
  return to the intended default.
- Pass the page's explicit default visibility and order when they differ from the
  natural table definition. An empty order means the order declared by the table
  columns.

The hook is intentionally a runtime composition layer around the lower-level
persisted column hooks. The builder owns the persisted contract and normalization;
the feature page still owns filters, query state, and the table instance.

Use one spec next to each domain model. Edit the spec and regenerate only when the
persisted filter contract changes; generated files are scaffold-and-own outputs.
