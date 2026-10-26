/**
 * Calculates the width needed by an icon-only action column in any DataGrid.
 * `col.actions` applies 20px of horizontal cell padding at every density, so
 * the formula includes 28px buttons, 4px gaps, and that compact padding.
 */
export function getDataGridActionsColumnSize(actionCount: number): number {
  const count = Number.isFinite(actionCount)
    ? Math.max(1, Math.floor(actionCount))
    : 1;

  return count * 28 + Math.max(0, count - 1) * 4 + 20;
}
