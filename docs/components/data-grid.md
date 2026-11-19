# DataGrid — bảng danh sách phân trang

> Chi tiết bảng dữ liệu. Hub: [`docs/06-component-usage-guide.md`](../06-component-usage-guide.md).
> Dùng cho **mọi danh sách quản lý có phân trang**. Bảng nhỏ không phân trang (top-5) → primitive `Table`.

Diện mạo admin (header sticky nền `bg-muted`, nhãn **chữ thường** xanh lam `text-secondary-foreground`,
cell `px-6 py-3`, row hover `bg-field`, selected row nền `bg-background`) là **default** — chỉ cần `<DataGrid>`, không truyền
`tableLayout`/`tableClassNames` để dựng lại. Đổi look chung = sửa `data-grid-table.tsx` / token.

---

## 1. Khung chuẩn

```tsx
import { useMemo, useState } from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const [pagination, setPagination] = useState<PaginationState>({
  pageIndex: 0,
  pageSize: 10,
});
const columns = useEmployeeColumns(); // xem mục 2

const table = useReactTable({
  columns,
  data,
  pageCount: Math.ceil(total / pagination.pageSize),
  state: { pagination },
  onPaginationChange: setPagination,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
});

return (
  <DataGrid table={table} recordCount={total}>
    <Card>
      <CardTable>
        <ScrollArea>
          <DataGridTable />
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardTable>
      <CardFooter className="justify-between">
        <DataGridPagination /> {/* default tiếng Việt — xem mục 3 */}
      </CardFooter>
    </Card>
  </DataGrid>
);
```

---

## 2. Column factory — `createColumnHelpers<TRow>()`

Thay vì viết `ColumnDef` thủ công, dùng factory thuần (gói trong **một** `useMemo`) để có cột typed,
nhất quán, tự nối `lib/date` + `lib/format`. Import từ `@/components/ui/data-grid-columns`.

```tsx
import { useMemo } from 'react';
import {
  createColumnHelpers,
  type StatusBadgeConfig,
} from '@/components/ui/data-grid-columns';

const statusConfig: StatusBadgeConfig<EmployeeStatus> = {
  active: {
    label: 'Hoạt động',
    className: 'bg-admin-success-bg text-admin-success-text',
    dotClassName: 'bg-admin-success-dot',
  },
  locked: {
    label: 'Đã khóa',
    variant: 'outline',
    dotClassName: 'bg-admin-neutral-400',
  },
};

export function useEmployeeColumns() {
  return useMemo(() => {
    const col = createColumnHelpers<Employee>();
    return [
      col.index(),
      col.text({
        id: 'name',
        header: 'Họ tên',
        get: (r) => r.name,
        tooltipOnTruncate: true,
      }),
      col.currency({ id: 'salary', header: 'Lương', get: (r) => r.salary }),
      col.date({
        id: 'createdAt',
        header: 'Ngày tạo',
        get: (r) => r.createdAt,
        mode: 'relative',
      }),
      col.badge({
        id: 'status',
        header: 'Trạng thái',
        get: (r) => r.status,
        config: statusConfig,
      }),
      col.actions({ header: 'Thao tác', cell: (r) => <RowActions row={r} /> }),
    ];
  }, []);
}
```

Builder (đều trả `ColumnDef<TRow>`, accessor `get: (row) => value`):

| Builder                             | Dùng cho                                            |
| ----------------------------------- | --------------------------------------------------- |
| `text({ get, tooltipOnTruncate? })` | chuỗi, truncate + tooltip tùy chọn                  |
| `number({ get, options? })`         | số, căn phải, qua `formatNumber`                    |
| `currency({ get })`                 | tiền VND qua `formatCurrencyVND`                    |
| `percent({ get, fractionDigits? })` | % (input là tỉ lệ, `0.125` → `12,5%`)               |
| `date({ get, mode? })`              | `'date' \| 'datetime' \| 'relative'` qua `lib/date` |
| `badge({ get, config })`            | `StatusBadge` theo `StatusBadgeConfig`              |
| `index()`                           | số thứ tự 1-based (theo trang)                      |
| `select()`                          | checkbox chọn dòng                                  |
| `actions({ cell })`                 | cột thao tác (cell căn phải, padding ngang compact) |
| `custom({ cell })`                  | cell tùy biến (escape hatch)                        |

Cột `actions` tự dùng padding ngang `px-2.5` ở mọi mật độ bảng. Khi kết hợp với
`getDataGridActionsColumnSize(actionCount)`, chiều rộng sẽ khớp nút icon 28px, khoảng cách 4px
và padding 20px. Tránh ghi đè padding ngang của cell khi dùng helper này.

Tham số chung: `id`, `header`, `headerClassName`, `cellClassName`, `visibility`, `enableSorting`, `size`.

---

## 3. DataGridPagination

Default **tiếng Việt sẵn** → thường chỉ cần `<DataGridPagination />` (xem hub §0.2):
`sizesLabel=''`, `sizesDescription='dòng'`, `info='{count} kết quả'`. `info` hỗ trợ placeholder
`{from} {to} {count}`. Chỉ truyền prop khi **thật sự khác** mặc định (vd `info="{from}-{to} trên {count}"`).

---

## 4. Persist ẩn/hiện cột — `usePersistedColumnVisibility`

Lưu trạng thái ẩn/hiện cột vào `localStorage` qua adapter an toàn (`src/lib/storage.ts`).

```tsx
import { usePersistedColumnVisibility } from '@/components/ui/data-grid-columns';

const { columnVisibility, onColumnVisibilityChange } =
  usePersistedColumnVisibility('examples.employees.columnVisibility');

const table = useReactTable({
  /* ... */,
  state: { pagination, columnVisibility },
  onColumnVisibilityChange,
});
```

---

## 5. Co giãn bảng cạnh sidebar hoặc cây lọc

Khi sidebar hoặc cây lọc thu mở, chiều rộng vùng bảng có thể đổi ở từng khung hình. Gọi
`table.setColumnSizing` từ `ResizeObserver` trong lúc đó khiến toàn bộ bảng có thể render lại liên tục.
Chi phí tăng rõ khi mỗi dòng có QR SVG, công tắc hoặc menu thao tác.

- Dùng CSS cho kích thước phát sinh từ layout. Với bảng có chiều rộng cột cố định, cấu hình
  `tableLayout={{ fillColumn: { id: 'identity', minWidth: 260 } }}` khi cần một cột hấp thụ phần chiều
  rộng còn lại. Chọn cột lá không ghim. `DataGridTable` cộng chiều rộng tối thiểu của cột đó với kích
  thước các cột đang hiện để bảng cuộn ngang trong `ScrollArea` khi thiếu chỗ.
- Tránh nối thay đổi chiều rộng của container vào state React hoặc TanStack Table theo từng khung
  hình. Giữ tham chiếu dữ liệu, cột và callback ổn định khi nội dung bảng không đổi. Nếu hook tạo
  cột dùng `useMemo`, các callback truyền vào hook cũng cần ổn định để hàm render ô được tái sử dụng.
- Giữ transition ở khung sidebar/cây lọc và khoảng cách layout nếu có. Tôn trọng
  `prefers-reduced-motion`. Trước khi bật hiệu ứng đổi kích thước trên panel dùng chung, kiểm tra các
  trang đang dùng panel xem có còn đo lại bảng rồi cập nhật state hay không.
- Khi đổi layout này, thử thu mở theo cả hai chiều với dữ liệu thật trước khi kết luận đã mượt.
  Kiểm tra cột tối thiểu, cuộn ngang và cột ghim ở 1366 px và 1920 px. Nếu vẫn thấy giật, dùng React
  Profiler để đo render và Performance của trình duyệt để xem layout, paint và tác vụ dài.

Tham chiếu triển khai: [trang Quản lý vật tư](../../src/project/materials/pages/material-list-page.tsx)
và [khung cây nhóm vật tư](../../src/project/material-groups/components/material-group-filter-tree.tsx).

---

## Ghi chú

- Width/căn lề cột đặt qua `meta.headerClassName` / `meta.cellClassName`, **không** style trực tiếp `<th>/<td>`.
- Nội dung cell tự xuống dòng và giới hạn tối đa 3 dòng; chỉ thêm kiểu hiển thị riêng khi cột có yêu cầu nghiệp vụ khác.
- Empty/loading của bảng có default tiếng Việt (`Không có dữ liệu` / `Đang tải...`) — không cần truyền.
- Tham chiếu sống: `src/examples/employees/` (DataGrid + column factory + persist + React Query mock).
