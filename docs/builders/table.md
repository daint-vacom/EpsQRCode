# Table Builder

Use the table builder for paginated or data-table columns. The registry and command source of truth is
[`src/builders/README.md`](../../src/builders/README.md).

## Workflow

Before writing a spec, search existing tables for columns representing the same business concept.
Inspect the cell renderer and its established usage. Prefer a reusable domain cell component inside
a `custom` stub, or a typed column hook/factory when header, sizing, and behavior also match.
Extract repeated complex cells instead of copying JSX. Generated output follows the same reuse
rule. Do not replace an existing badge, identity cell, tooltip, or action with plain text merely
because the new row type differs. Map the canonical read model into the shared renderer's props.
For grouped rows, render `…` for mixed values and `—` for entirely empty values, then use the
established renderer for a common value.

Existing examples include `MaterialIdentity` for image/name/code,
`MaterialConditionBadge` and `MaterialStatusBadge` for material values. Their owning feature
components are the source of presentation behavior.

1. Ensure the row type exists in the feature model.
2. Create `<domain>/table/<entity>.table.fixture.ts` exporting a `TableSpec` from
   `@/builders/table`. Set `specPath` to the fixture path.
3. Generate the columns:

   ```bash
   npm run gen:table -- <spec.ts> <out.tsx>
   ```

4. Keep the provenance banner. Fill `actions` and `custom` `cell: () => null` stubs in the generated
   file using `src/components/ui`.
5. Define explicit `size` values for dense fixed-layout tables.
6. Wire `use<Entity>Columns()` into the feature's existing `useReactTable` and `DataGrid` setup.
7. Run builder tests when builder/spec consistency changes, focused feature tests, and `npm run build`.

## Standard page shell

The table builder owns column definitions only. It must not introduce page-specific padding, toolbar
sizes, card chrome, or pagination markup. Every generated table page should compose the shared shell:

```tsx
<Card className="min-h-0 flex-1 overflow-hidden">
  <CardHeader className="flex-col items-stretch gap-4 xl:flex-row xl:items-center xl:justify-between">
    <CardHeading>...</CardHeading>
    <CardToolbar>...</CardToolbar>
  </CardHeader>
  <CardTable className="min-h-0 flex-1">...</CardTable>
  <CardFooter className="justify-between">
    <DataGridPagination />
  </CardFooter>
</Card>
```

`CardHeader` owns the standard `p-5` padding, so table pages should not repeat it in page-level
classes. Toolbar buttons should use the shared Button default size unless the design explicitly calls
for an icon-only control. This keeps generated table
pages visually consistent; page-specific customization belongs in feature behavior and column cells,
not in arbitrary shell spacing or button sizing.

## Column Kinds

| Kind             | Field    | Output                                                                         |
| ---------------- | -------- | ------------------------------------------------------------------------------ |
| `index`          | no       | 1-based row number                                                             |
| `select`         | no       | row checkbox                                                                   |
| `text`           | yes      | string cell                                                                    |
| `number`         | yes      | Vietnamese number formatting                                                   |
| `currency`       | yes      | VND formatting                                                                 |
| `percent`        | yes      | percentage formatting                                                          |
| `date`           | yes      | date, datetime, or relative formatting                                         |
| `badge`          | yes      | generated `StatusBadge` config                                                 |
| `editableSelect` | yes      | compact Select cell, bound to the row value and committed on change            |
| `actions`        | no       | inline JSX stub, or semantic preset actions when `actionPresets` is configured |
| `custom`         | optional | inline JSX stub                                                                |

Common options include `headerClassName`, `cellClassName`, `size`, `sizePreset`, `pin`, `visibility`,
and `enableSorting`. Prefer `sizePreset` for standard layouts; use numeric `size` only when a column
has a deliberate one-off width. Set `pin: 'left'` or `pin: 'right'` for a data column that must stay
visible while the table scrolls horizontally.

Badge columns accept `badgeSize: 'sm' | 'md' | 'lg'`; use `sm` for compact status/type values when the
default medium badge takes more room than the label needs.

### Column size presets

`sizePreset` keeps fixture sizing semantic and reusable. The builder emits the corresponding numeric
`size` into the generated column module.

| Preset      | Width | Use for                       |
| ----------- | ----- | ----------------------------- |
| `compact`   | 160px | Mã ngắn, quốc gia, mã đơn vị  |
| `date`      | 150px | Ngày                          |
| `number`    | 150px | Số lượng, số liệu ngắn        |
| `badge`     | 170px | Trạng thái, badge đơn         |
| `short`     | 180px | Thông tin ít, số điện thoại   |
| `medium`    | 220px | Thông tin vừa, khu vực        |
| `tags`      | 240px | Nhóm/danh mục, nhiều badge    |
| `long`      | 280px | Email, ghi chú, thông tin dài |
| `identity`  | 320px | Tên/định danh chính           |
| `extraLong` | 360px | Địa chỉ hoặc nội dung rất dài |

`size` and `sizePreset` are mutually exclusive. `actionCount` is also mutually exclusive with both;
action columns derive their width from the number of icon actions.
For icon-only action columns, set `actionCount` instead of `size`; the generated column uses
`getDataGridActionsColumnSize(actionCount)` so its width follows the number of buttons.
Generated columns have sorting disabled by default; set `enableSorting: true` only after the page
connects sorting state and its data/API behavior.

Empty cells remain empty by default. The table builder must not inject placeholder text such as
`Chưa cập nhật` or `Chưa có dữ liệu`; provide explicit cell content only when the product requirement
specifically calls for it. Empty-table messages are a separate table state and may be configured explicitly.

### System column pinning

The table builder automatically emits `<ENTITY>_COLUMN_PINNING` when a spec contains system columns:
`select` is pinned to the left and every `actions` column is pinned to the right. Wire the generated
constant into the page's `useReactTable` state:

```tsx
import {
  EMPLOYEE_COLUMN_PINNING,
  useEmployeeColumns,
} from '../table/employee.columns.generated';

const table = useReactTable({
  columns,
  state: { columnPinning: EMPLOYEE_COLUMN_PINNING },
  // ...other table state and handlers
});
```

Keep pinning in the table spec-generated constant so future tables follow the same system-column
convention without duplicating page-level arrays.

### Semantic action presets

Use `actionPresets` when a table uses the standard row actions. The builder emits typed callbacks and
the shared `DataGridActionButton`, keeping the action color mapping consistent across generated tables:

| Preset              | Meaning                          | Color                 |
| ------------------- | -------------------------------- | --------------------- |
| `primary`           | Thao tác chính, ví dụ Thanh toán | primary (màu chủ đạo) |
| `view`              | Xem                              | blue                  |
| `edit`              | Sửa                              | success               |
| `delete`, `archive` | Xóa / Lưu trữ                    | destructive           |
| `copy`, `other`     | Sao chép / chức năng khác        | info (tím)            |

```ts
{
  kind: 'actions',
  actionPresets: ['primary', 'view', 'edit', 'archive'],
  actionCount: 4,
}
```

The generated hook receives `onPrimary`, `onView`, `onEdit`, and `onArchive` callbacks. Preset actions render as
ghost buttons so color communicates intent without making every table row visually heavy. For
conditional or domain-specific actions, keep the inline cell owned by the feature and use
`DataGridActionButton` directly.

For icon-only row actions, leave the actions header empty (`header: ''`) and use `actionCount` to size
the column. Prefer `actionPresets` for a fixed action set; when actions depend on permissions or row
state, render `DataGridActionButton` in the owned cell and include only the actions the user can take.
Do not use a plain `Button` for row actions because it loses the shared semantic color mapping. Add a
view action or detail dialog only when it exposes information or a workflow that is not already
available in the row or its tooltips.

### `editableSelect`

Use `editableSelect` for Phase 1 inline editing: one cell commits immediately when the user chooses a new
value. The builder can serialize static option lists, but the write handler belongs to the page, so any
table with at least one `editableSelect` column generates a params-bearing hook.

```ts
{
  kind: 'editableSelect',
  id: 'statusSelect',
  header: 'Đổi trạng thái',
  field: 'status',
  placeholder: 'Chọn trạng thái',
  options: [
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'locked', label: 'Đã khóa' },
  ],
}
```

Generated shape:

```tsx
export interface UseEmployeeColumnsParams {
  onStatusSelectEdit: (row: Employee, value: string) => void;
}

export function useEmployeeColumns(
  params: UseEmployeeColumnsParams,
): ColumnDef<Employee>[] {
  // ...
}
```

`optionsFrom` defaults to `'static'`, which requires `options` in the spec and emits
`const <id>Options = [...]`. Set `optionsFrom: 'prop'` when the page must supply options at runtime; the
hook params then also include `<id>Options: { value: string; label: string }[]`.

Wire commits in the page through the existing mutation layer, for example:

```tsx
const updateStatus = useUpdateEmployeeStatusMutation();
const columns = useEmployeeColumns({
  onStatusSelectEdit: (row, status) => {
    updateStatus.mutate({ id: row.id, status });
  },
});
```

For bulk edits over selected rows, compose the `DataGridActionBar` primitive
(`@/components/ui/data-grid-action-bar`) inside `<DataGrid>`: it reads the table from context, floats
while rows are selected, and hosts page-owned bulk controls (e.g. a status `Select` + Áp dụng). See
`src/examples/employees/pages/employees-page.tsx`. Do not model bulk editing with `editableSelect`.
Toolbar selects should pass a context label to `SelectValue` (for example
`<SelectValue label="Trạng thái" />`) so the compact control is self-describing. Form/dialog selects
keep the default without a prefix because their field label is already rendered above the control.

### Group rows and children rows

Add `grouping` to a `TableSpec` when the table renders synthetic group rows followed by child rows:

```ts
grouping: {
  parentIdField: 'groupId',
  isGroupField: 'isGroup',
  expandedField: 'isExpanded',
},
```

The generated module then includes `build<Entity>GroupedRows`, `toggle<Entity>Group`,
`is<Entity>Group`, and `is<Entity>GroupExpanded`. The helper accepts a separate group collection and
child collection, keeps children indexed by the configured parent id field, and omits children for
collapsed groups. The page owns the group-row projection and collapsed-id state:

```tsx
const rows = buildTagGroupedRows(groups, tags, collapsedGroupIds, {
  getGroupId: (group) => group.id,
  toGroupRow: (group, isExpanded) => ({
    ...toTagGroupRow(group),
    isGroup: true,
    isExpanded,
  }),
});

setCollapsedGroupIds((current) => toggleTagGroup(current, groupId));
```

This keeps row composition and expand/collapse state in the feature while the builder owns the
repeatable flattening and grouping contract.

## Ownership

- The spec owns columns, order, sizes, and generated serializable config.
- Generated output is scaffold-and-own. Fill stubs in place.
- The table builder does not own confirmation or mutation state. Pages own the generated callbacks;
  destructive actions should use the shared `ConfirmDialog` instead of `window.confirm`.
- Never regenerate over customized output. Generate to a scratch path and reconcile manually.
- Never hand-write a generated-looking columns file or edit generated badge config directly.
