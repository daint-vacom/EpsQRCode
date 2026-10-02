# Detail-dialog builder

The detail-dialog builder scaffolds a reusable dialog for local data. Its default
tab layout is a two-column information table. The generated component never
fetches data. Each tab receives the local entity and the current search query so
the feature can render fields or switch a tab to a fully custom layout.

## Spec

```ts
const spec = {
  componentName: 'ContractDetailDialogShell',
  tabs: [
    {
      value: 'general',
      label: 'Thông tin chung',
      icon: 'Info',
      searchTextProp: 'generalSearchText',
    },
    {
      value: 'custom',
      label: 'Tùy biến',
      contentMode: 'custom',
      contentProp: 'customContent',
    },
  ],
} satisfies DetailDialogSpec;
```

Each default `table` tab generates a field renderer prop named `<value>Fields`.
Each `custom` tab generates a content renderer prop named `<value>Content`.
Both receive:

```ts
{
  data,
  searchQuery,
  matches,
}
```

Empty values are rendered as empty cells by default. The builder and the shared
detail-dialog table do not inject placeholder text such as `Chưa cập nhật`;
features may provide explicit copy only when the product requirement calls for it.

Read-only entity dialogs use the `Tra cứu` wording by default. The title should
follow `Tra cứu <đối tượng>: <tên đối tượng>` and the trigger that opens the
dialog should be labeled `Tra cứu`. The builder owns the title slot but does not
invent the entity name or prefix, so each feature must pass the composed title.

The shared search input uses `Tìm kiếm dữ liệu` as its default placeholder.
Feature dialogs should keep this default unless a more specific search scope is
explicitly required.

`matches` uses the shared accent-insensitive fuzzy matcher. All configured tabs
remain visible while searching; table fields are filtered automatically and
custom content remains responsible for its own row-level filtering.

When a tab should show the number of matching items while searching, declare
`searchMatchCountProp`. The callback receives the same context and should return
the number of matching rows/items. The shared dialog renders the count using the
tab trigger's shared styling while a search is active when the count is greater
than zero.

Declare `countProp` when a tab should show its total item count before searching.
The generated wrapper accepts a nullable numeric prop for that count. While
searching, `searchMatchCountProp` takes precedence and only positive match counts
are shown.

Generate with:

```sh
npm run gen:detail-dialog -- src/project/example/detail-dialog.fixture.ts src/project/example/detail-dialog.generated.tsx
```
