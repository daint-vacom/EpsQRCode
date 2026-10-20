# Form Inputs

> Chi tiết cho các ô nhập liệu. Hub: [`docs/06-component-usage-guide.md`](../06-component-usage-guide.md).
> Nguyên tắc chung (semantic token, default tiếng Việt, không vá style ở page) xem §0 của hub.

Tất cả ô nhập đều dùng nền `bg-field` + trắng khi focus là **default** — không thêm `bg-*` ở page.

## FormItem — field dọc/ngang

`FormItem` mặc định xếp label ở trên input. Khi cần field dạng ngang, dùng cấu hình semantic dùng
chung thay vì tự viết lại grid ở từng form:

```tsx
<FormItem layout="horizontal" labelWidth="md" labelGap="md">
  <FormLabel>Trạng thái</FormLabel>
  <FormControl>{/* input */}</FormControl>
  <FormMessage />
</FormItem>
```

`labelWidth` hỗ trợ `sm | md | lg` và `labelGap` hỗ trợ `sm | md | lg`; các preset được định nghĩa
ở primitive `FormItem` để các form giữ cùng nhịp layout.

Với `layout="horizontal"`, label và control mặc định được căn giữa theo chiều dọc. Dùng
`alignment="start"` cho textarea hoặc control nhiều dòng để đưa label lên đầu vùng nội dung. Với
control ghép có một hàng điều khiển đầu tiên (ví dụ radio chọn cách tạo mã), dùng
`alignment="first-control"` để căn giữa label theo hàng đó. Không thêm padding căn chỉnh riêng cho
checkbox.

---

## Input

Ô input cơ bản; có icon/affix thì bọc `InputWrapper` hoặc `InputGroup` + `InputAddon`.

```tsx
import { Search } from 'lucide-react';
import { Input, InputWrapper } from '@/components/ui/input';

<InputWrapper>
  <Search />
  <Input
    type="search"
    placeholder="Tìm kiếm theo trường"
    value={q}
    onChange={(e) => setQ(e.target.value)}
  />
</InputWrapper>;
```

Variant size: `sm | md | lg` (mặc định `md`). `header` dành cho ô tìm kiếm trên header;
`ghost-underline` dùng nền trong suốt, không shadow và chỉ hiện đường viền dưới, nhấn mạnh đường viền
khi focus. `onChange` giữ chữ ký HTML chuẩn `(e) => e.target.value`.

---

## SearchInput — ô tìm kiếm debounced + nút xóa

Dùng khi cần search debounce (toolbar danh sách). Tự gói icon + nút clear (X). Import từ
`@/components/ui/inputs/search-input`.

```tsx
import { SearchInput } from '@/components/ui/inputs/search-input';

<SearchInput
  value={keyword}
  onSearch={setKeyword}
  placeholder="Tìm theo tên, username"
/>;
```

Dùng `variant="header"` khi đặt ô tìm kiếm trên header; variant này chỉ thay đổi hình thức, không thay
đổi contract debounce của `SearchInput`.

| Prop         | Kiểu                      | Mặc định | Ghi chú                                                          |
| ------------ | ------------------------- | -------- | ---------------------------------------------------------------- |
| `value`      | `string`                  | `''`     | Giá trị hiển thị ban đầu, đồng bộ khi đổi từ ngoài               |
| `onSearch`   | `(value: string) => void` | —        | Gọi **sau debounce**; nút clear gọi ngay với `''`                |
| `debounceMs` | `number`                  | `300`    | Đặt `0` nếu query phía dưới đã tự debounce (vd React Query hook) |

> Lưu ý: nếu hook lấy dữ liệu đã debounce sẵn thì truyền `debounceMs={0}` để khỏi debounce 2 lần.

---

## OptionSelect — Select dữ liệu (single-select)

Async/server selects, cache/filter contracts and catalog-vs-pagination rules:
[Server-side selects](./server-selects.md).

Khác `Select` thô ở chỗ **có ô tìm kiếm bỏ dấu** (qua `searchMatch`). Generic theo `T`.
`OptionSelect` là API single-select dùng cho dữ liệu; `@/components/ui/combobox` vẫn được giữ làm
alias tương thích.

```tsx
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';

const options: SelectOption[] = [
  { value: 'nhan-vien', label: 'Nhân viên' },
  { value: 'quan-ly', label: 'Quản lý' },
];

<OptionSelect
  value={role}
  onChange={setRole}
  options={options}
  placeholder="Chọn vai trò"
/>;
```

`SelectOption<T> = { value: string; label: ReactNode; searchableText?: string; group?: string; data?: T; disabled?: boolean }`

| Prop                                                 | Kiểu                                          | Mặc định                                  |
| ---------------------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| `value` / `onChange`                                 | `string` / `(v: string) => void`              | `''`                                      |
| `onSelect`                                           | `(opt: SelectOption<T> \| undefined) => void` | —                                         |
| `options`                                            | `SelectOption<T>[]`                           | —                                         |
| `placeholder` / `searchPlaceholder` / `emptyMessage` | `string`                                      | `Chọn...` / `Tìm...` / `Không có kết quả` |
| `searchable`                                         | `boolean`                                     | `true` — ẩn ô tìm kiếm khi đặt `false`    |
| `manualFilter`                                       | `boolean`                                     | `false` — bật khi tự lọc (async/server)   |
| `size`                                               | `sm \| md \| lg`                             | `md`                                      |
| `variant`                                            | `normal \| ghost`                             | `normal`                                  |
| `renderOption` / `triggerContent`                    | render fn                                     | —                                         |

Chọn lại đúng giá trị đang chọn = bỏ chọn (`''`). Dùng `canDeselect={false}` cho field bắt buộc phải
giữ giá trị. Dùng `OptionSelect` thay cho `Select` thô khi danh sách là dữ liệu; chỉ giữ `Select`
thô cho các menu cần tự compose layout.

### Nội dung option và giá trị đã chọn

- `renderOption` có thể hiển thị thông tin nhận diện bổ sung như mã để người dùng phân biệt các lựa chọn; chỉ thêm mô tả khi domain yêu cầu rõ.
- `triggerContent` mặc định chỉ hiển thị tên chính; nếu domain cần metadata phụ thì chỉ hiển thị đúng trường được yêu cầu, không tự ghép mô tả hoặc trường khác. Có thể kèm ảnh đại diện khi kích thước cho phép, theo mẫu `CustomerSelect`.
- Với select có ảnh, ẩn ảnh ở `size="sm"`. Ở `size="md"`, giới hạn ảnh trong chiều cao control (thường `size-7`); không để ảnh làm trigger tràn hoặc cao hơn select bên cạnh.
- `variant="ghost"` là kiểu select không viền/nền mặc định, phù hợp với ô trong editor table hoặc inline editor; trạng thái hover vẫn có thể dùng nền accent nhẹ.
- Dùng `size="lg"` khi trigger cần thêm một dòng thông tin phụ; select vật tư hiển thị tên và mã, không hiển thị mô tả hoặc số serial.
- `Textarea` mặc định dùng `variant="md"`. Bật `autoResize` cho nội dung theo dòng để chiều cao ban đầu gọn và tự tăng khi người dùng nhập nhiều dòng.

---

## MultiSelect — chọn nhiều + chip

Form field chọn nhiều: trigger hiển thị các lựa chọn (`+N` khi quá `maxChips`), dropdown có tìm
kiếm + nhóm + "Chọn tất cả / Bỏ chọn tất cả". Import từ `@/components/ui/multi-select`.

```tsx
import {
  MultiSelect,
  type MultiSelectOption,
} from '@/components/ui/multi-select';

const options: MultiSelectOption[] = [
  { value: 'nhan-vien', label: 'Nhân viên', group: 'Vai trò' },
  { value: 'quan-ly', label: 'Quản lý', group: 'Vai trò', count: 12 },
];

<MultiSelect
  value={roles}
  onChange={setRoles}
  options={options}
  placeholder="Tất cả vai trò"
/>;
```

`MultiSelectOption<T> = { value: string; label: ReactNode; searchableText?: string; group?: string; count?: number; data?: T; disabled?: boolean }`

| Prop                                                 | Kiểu                                 | Mặc định                                                                    |
| ---------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| `value` / `onChange`                                 | `string[]` / `(v: string[]) => void` | `[]`                                                                        |
| `options`                                            | `MultiSelectOption<T>[]`             | —                                                                           |
| `maxChips`                                           | `number`                             | `2` — dư thì gom `+N` (giữ trigger 1 dòng)                                  |
| `showSelectedOptionWrapper`                          | `boolean`                            | `false` — bật chip wrapper và nút xóa mặc định                              |
| `placeholder` / `searchPlaceholder` / `emptyMessage` | `string`                             | `Chọn...` / `Tìm...` / `Không có kết quả`                                   |
| `searchMode`                                         | `'popover' \| 'inline'`              | `'popover'` — tìm trong dropdown; `inline` hiển thị ô tìm ngay trên trigger |

Nhóm 1 cấp qua `group`; số đếm qua `count`. Với `nestedOptions`, group và leaf đều được hiển thị,
group có thể chọn/bỏ chọn toàn bộ leaf. Search fuzzy giữ lại group cha khi leaf con khớp. Popover
**giữ mở** khi toggle (đúng UX multi-select).

### EntityMultiSelect — chọn danh sách liên kết có nhận diện

Dùng `EntityMultiSelect` khi cần hiển thị các bản ghi đã chọn thành từng hàng có avatar, tên và mô tả,
ví dụ các hồ sơ được liên kết trong một quy trình. `title`, `description` và `avatar` nhận
`ReactNode`; `tooltip` tùy chọn nhận `ReactNode` để giải thích đầy đủ danh tính khi di chuột qua hàng.
`searchText` cung cấp nội dung tìm kiếm ổn định khi các node hiển thị phức tạp.

```tsx
import { EntityMultiSelect } from '@/components/ui/entity-multi-select';

<EntityMultiSelect
  value={linkedIds}
  onChange={setLinkedIds}
  size="lg"
  options={[
    {
      value: employee.id,
      title: employee.displayName,
      description: employee.employeeCode,
      avatar: employee.avatarUrl ? (
        <img src={employee.avatarUrl} alt="" />
      ) : (
        employee.displayName[0]
      ),
      tooltip: `${employee.employeeCode} - ${employee.displayName}`,
      searchText: `${employee.displayName} ${employee.employeeCode}`,
    },
  ]}
/>;
```

`size="md"` giữ hàng ở chiều cao 34px như select nhân viên, chỉ hiển thị title. `size="lg"` dùng hàng
cao hơn và hiển thị description. Nút bỏ chọn dùng ghost mờ, không tạo nền khi hover.

### TagSelect — chọn nhiều nhãn theo nhóm

Dùng `TagSelect` từ `@/project/tags/components/tag-select` khi dữ liệu lấy từ danh mục nhãn dùng chung:

```tsx
<TagSelect
  value={tagIds}
  onChange={setTagIds}
  moduleCodes={['organization']}
  variant="button"
/>
```

`variant="input"` (mặc định) hiển thị badge đã chọn ngay trong select input. `variant="button"` hiển thị
nút ghost **Thêm nhãn** và badge đã chọn bên dưới. Cả hai dạng đều hỗ trợ tìm kiếm, chọn nhiều và chọn/bỏ
chọn toàn bộ nhãn trong nhóm. `allowCustomGroups` bật (mặc định) để lấy thêm nhóm nhãn tenant tự tạo
(`module_code = null`) bên cạnh các nhóm trong `moduleCodes`.

---

## NumericInput — ô số định dạng VN

Bọc `react-number-format`, phân tách nghìn `.` / thập phân `,` kiểu VN. Cặp với
[`formatCurrencyVND`](../07-lib-utilities.md#format). Import từ `@/components/ui/inputs/numeric-input`.

```tsx
import { NumericInput } from '@/components/ui/inputs/numeric-input';

<NumericInput value={luong} onValueChange={setLuong} allowNegative={false} />;
```

| Prop                                     | Kiểu                                   | Mặc định               |
| ---------------------------------------- | -------------------------------------- | ---------------------- |
| `value`                                  | `number \| string \| null`             | —                      |
| `onValueChange`                          | `(value: number \| undefined) => void` | — (rỗng → `undefined`) |
| `thousandSeparator` / `decimalSeparator` | `string`                               | `.` / `,`              |
| `allowNegative` / `decimalScale`         | `boolean` / `number`                   | —                      |

---

## Select / Textarea / Checkbox / Switch

- `OptionSelect searchable={false}` cho dropdown ngắn cố định, không cần tìm kiếm; dùng `OptionSelect`
  với `searchable` mặc định cho danh sách dữ liệu cần tìm. `Select` thô chỉ dành cho composition đặc biệt.
- `SelectTrigger` dùng `variant="outline"` mặc định; dùng `variant="ghost"` cho select gọn nằm trong cell hoặc inline editor.
- `FilterToolbar` dùng `OptionSelect` với `triggerContent` để hiển thị nhãn và giá trị trong một
  control compact. `SelectValue` vẫn hỗ trợ `label` cho các composition low-level tùy biến.
- `Textarea`, `Checkbox`, `Switch`, `RadioGroup`: dùng primitive cùng tên trong `@/components/ui/*`.
- Validate form: ráp `Form*` (react-hook-form) + schema từ [`docs/07` validation factory](../07-lib-utilities.md#validation).
