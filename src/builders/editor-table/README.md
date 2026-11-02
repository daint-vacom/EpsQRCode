# Editor Table Builder

Use `editor-table` for spreadsheet-like edit tables inside edit/detail pages:
order lines, invoice lines, inventory count rows, and similar
react-hook-form field arrays.

This builder is not a page layout builder. The page owns the header, toolbar
actions, surrounding cards, submit mutation, totals, and any general-information
forms above the table.

Editor-table rows keep a stable background while the pointer moves over cells:
disable `TableRow` hover backgrounds with `hoverable={false}` on empty, data,
and sortable body rows. Do not add background-color changes on row hover; use
explicit states such as dragging or validation when those are part of the
interaction.

## Workflow

1. Ensure the row type and RHF values type exist.
2. Create `<domain>/table/<entity>.editor-table.fixture.ts` exporting an
   `EditorTableSpec` from `@/builders/editor-table`.
3. Generate the component:

   ```bash
   npm run gen:editor-table -- <spec.ts> <out.tsx>
   ```

4. Keep the provenance banner. Fill computed cell stubs, then wire the generated
   component into the page/card layout.
5. Run focused feature tests and `npm run build`.

## Viewport Modes

- `fixed`: best for editable tables. The table keeps a usable height even when
  the page has cards above it. Presets:
  - `sm`: `clamp(320px, 42dvh, 480px)`
  - `md`: `clamp(400px, 52dvh, 600px)`
  - `lg`: `clamp(480px, 62dvh, 760px)`
- `remaining`: best for pages where the table is the primary content and should
  fill the remaining viewport while keeping a usable minimum editing height.
- `natural`: lets the page scroll naturally. Use only for short tables or
  read-mostly detail sections.

For the current order edit pilot, prefer `remaining`.

### Tables inside dialogs

Give a dialog that contains a scrollable editor table a definite height. A
`max-height` alone can leave the nested flex/grid chain content-sized, so the
dialog body takes the wheel event and scrolls the tabs away instead of
scrolling the table.

Keep the dialog header and footer outside the bounded content area. The dialog
body, tabs, active tab content, editor wrapper, and `ScrollArea` must all be
allowed to shrink with `min-h-0`; the active tab content should hide overflow
and the table should own scrolling:

```tsx
<DialogContent className="flex h-[min(90dvh,760px)] flex-col gap-0 overflow-hidden p-0">
  <DialogHeader className="shrink-0">...</DialogHeader>
  <DialogBody className="min-h-0 flex-1 overflow-hidden p-0">
    <Tabs className="flex h-full min-h-0 flex-col">
      <TabsList className="shrink-0">...</TabsList>
      <TabsContent className="min-h-0 flex-1 overflow-hidden">
        <EditorTable />
      </TabsContent>
    </Tabs>
  </DialogBody>
  <DialogFooter className="shrink-0">...</DialogFooter>
</DialogContent>
```

For the dialog's editor-table fixture, set the remaining viewport class to
`h-full min-h-0`. In the owned output, keep the scroll area bounded by a
full-height grid/flex wrapper and use the shared scroll area directly:

```tsx
<div className="grid h-full min-h-0 min-w-0 w-full">
  <ScrollArea type="always" className="h-full min-h-0">
    <div className="min-w-[1160px]">...</div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
</div>
```

The shared `ScrollArea` supplies the vertical scrollbar; retain the horizontal
`ScrollBar` for wide tables. Avoid making the dialog body the desktop scroll
container, or its wheel handling can move the tabbar while the editor grows
past the dialog. If the generated output needs this dialog-specific structure,
regenerate to a scratch path and reconcile the owned component.

## Supported Columns

| Kind               | Output                                                        |
| ------------------ | ------------------------------------------------------------- |
| `index`            | 1-based row number                                            |
| `text`             | compact text/email/tel/url input cell                         |
| `autocomplete`     | shared autocomplete input cell from declared options          |
| `number`           | compact numeric input cell                                    |
| `date`             | compact date input cell                                       |
| `computedCurrency` | read-only VND cell stub for page-owned row calculations       |
| `custom`           | feature-owned cell scaffold for compound/conditional controls |

The builder emits default row actions: duplicate, insert below, and delete. The
action column is pinned to the right so it remains visible during horizontal
scroll. Set `actions.duplicate`, `actions.insert`, or `actions.delete` to
`false` when an editor needs only a subset of those actions.

For a large form field array, set `pagination: { pageSize: 10, sizes: [10, 25, 50] }`
to paginate rows locally while keeping every row in the same React Hook Form
array. Row numbering, validation, and row actions continue to use full-array
indexes. This option is for editable form rows; server-paginated read-only list
tables should use the `table` builder.

The optional toolbar add button uses the primary variant by default. Set
`toolbar.addVariant` for a different button treatment, and set
`toolbar.addShortcut` when the shared application shortcut should activate the
button. The shortcut is emitted through `data-shortcut-action="create"` and a
`ShortcutTooltip`, so `Alt + N` follows the same convention as other create
actions.

Set `reorder.enabled` to add a pinned drag-handle column. The generated table
uses `useFieldArray.move` and supports pointer plus keyboard sorting; the page
still owns the submit mutation so it can persist the resulting array order in a
single request.

Editable cells, bulk action inputs, and optional header inputs reuse the shared
lower-level form-field builder at `src/builders/shared/form-field-builder.ts`.
Add a new control kind there first, then expose it from this builder's spec
instead of duplicating the UI primitive mapping in the editor-table generator.
The column schema extends the matching control schema from
`src/builders/shared/form-field-spec.ts` and keeps table-only metadata such as
`header`, `widthClass`, and `bulkEdit` local to this builder.

Editable-cell validation messages are shown in a tooltip. Field errors take
precedence and use the destructive variant; set `warningExpression` on an
editable column to provide a warning string expression, which uses the warning
variant and warning input styling.

Use `custom` when a cell combines multiple fields, changes its controls based
on another field in the same row, or needs domain-specific presentation. The
builder emits the table cell and an explicit TODO scaffold; the feature owns
the inner controls and validation wiring while the builder continues to own
field-array lifecycle, row actions, sticky headers, and horizontal scrolling.

## Multi Edit

Set `multiEdit.enabled` to emit row selection and the floating action bar,
including when the table has no bulk-editable fields. Its action list defaults
to `copy` and `delete`; the generated component exposes `onCopySelected` for
feature-owned copy behavior, and deletion removes the selected field-array rows.
Add `paste` to `multiEdit.actions` when the feature provides `clipboardCount`
and `onPaste`.

Mark safe editable columns with `bulkEdit: true` to add the “Chỉnh sửa hàng
loạt” action and its field/value controls. When `headerInputs` is true,
bulk-enabled headers also show compact inputs under the label; header inputs
apply only to selected rows.

## Example Spec

```ts
import type { EditorTableSpec } from '@/builders/editor-table';

const spec: EditorTableSpec = {
  entity: 'OrderItem',
  componentName: 'OrderItemsEditorTable',
  modelImport: '../model/order',
  valuesType: 'OrderItemsFormValues',
  valuesImport: '../form/order-items.schema',
  arrayName: 'items',
  tableMinWidthClass: 'min-w-[1760px]',
  viewport: { mode: 'remaining' },
  multiEdit: { enabled: true, headerInputs: true },
  columns: [
    { kind: 'index', header: 'STT', widthClass: 'w-14' },
    { kind: 'text', name: 'sku', header: 'Mã hàng', widthClass: 'w-36' },
    {
      kind: 'text',
      name: 'name',
      header: 'Tên hàng hóa',
      widthClass: 'min-w-56',
    },
    {
      kind: 'number',
      name: 'quantity',
      header: 'Số lượng',
      min: 0,
      widthClass: 'w-32',
    },
    {
      kind: 'number',
      name: 'unitPrice',
      header: 'Đơn giá',
      min: 0,
      widthClass: 'w-40',
    },
    {
      kind: 'number',
      name: 'taxRate',
      header: 'VAT %',
      min: 0,
      widthClass: 'w-28',
      bulkEdit: true,
    },
    {
      kind: 'computedCurrency',
      id: 'lineTotal',
      header: 'Thành tiền',
      widthClass: 'w-40',
    },
  ],
};

export default spec;
```

## Ownership

- The spec owns columns, order, table min width, and viewport mode.
- Generated output is scaffold-and-own. Fill computed stubs in place.
- Re-generate customized files only to a scratch path, then reconcile manually.
- Do not use this builder for paginated list tables; use the `table` builder and
  `DataGridTable`.
