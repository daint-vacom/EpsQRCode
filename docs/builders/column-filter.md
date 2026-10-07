# Column Filter Builder

Use `column-filter` for compact controls rendered in a data-grid header through the column
`headerFilter` slot. It is separate from the `filter` builder because header filters have different
spacing, sizing, and responsive constraints than toolbar filters.

## Supported fields

- `search`
- `selectSearch`
- `multiSelect`
- `numberRange`
- `dateRange`

The generated component owns only control composition and typed value callbacks. Feature code owns
option mapping, badges, entity identity renderers, query state, and backend parameter mapping.

```ts
import type { ColumnFilterSpec } from '@/builders/column-filter';

const spec: ColumnFilterSpec = {
  componentName: 'Employee',
  fields: [
    { type: 'search', name: 'text', placeholder: '', ariaLabel: 'Tìm nhân viên' },
    { type: 'selectSearch', name: 'role', searchPlaceholder: 'Tìm vai trò...' },
    { type: 'multiSelect', name: 'status', maxChips: 0 },
  ],
};
```

Run:

```bash
npm run gen:column-filter -- <spec.ts> <out.tsx>
```

Entity-specific option conversion and renderer slots stay outside the generated file. A feature can
convert its records to `SelectOption` and pass an identity renderer into the generated `OptionSelect`.
`selectSearch` is retained as the builder field name for
backward compatibility; it emits `OptionSelect` with `searchable` enabled.
