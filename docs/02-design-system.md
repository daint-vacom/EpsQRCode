# Design System

This document owns shared UX decisions for Vietnamese admin applications. Component APIs belong in
[`docs/components/`](./components/); UI implementation flow belongs in
[`workflows/implement-ui.md`](./workflows/implement-ui.md).

## Product Character

- Dense, operational, and optimized for repeated desktop work.
- Table-first when users compare or act on many records.
- Quiet visual hierarchy with limited ornament and predictable placement.
- Vietnamese copy that is direct, specific, and consistent with domain vocabulary.
- Efficient at 1366px while making useful use of wider 1920px screens.

## Token Ownership

- Semantic colors, surfaces, borders, foregrounds, and spacing live in `src/styles/globals.css` and
  shared component defaults.
- Feature pages consume semantic classes; they do not hardcode hex colors or recreate shared styling.
- Status colors must preserve meaning across tables, badges, alerts, and forms.
- Shared visual changes are made once at the token or component root.

Use the live tokens as source of truth. This document does not duplicate a color palette that can drift.

## Density And Layout

- Prefer compact controls and spacing without reducing readability or target size.
- Page headers contain title, essential context, and primary actions; avoid marketing hero treatment.
- Top-level project pages use the shared `PageHeader` primitive
  (`src/components/ui/page-header.tsx`) instead of composing a page title with a
  local `h1` and action wrapper. This keeps title typography, wrapping, and
  action alignment consistent.
- List pages prioritize filters, table, pagination, and bulk or row actions.
- Forms group related fields, use a predictable reading order, and avoid decorative containers.
- Dialog width follows task complexity; long or high-context workflows become a page or side panel.
- Fixed-format regions such as tables and toolbars use stable dimensions to prevent layout shift.

## Tables

- Use `DataGrid` for paginated management lists and the table builder for columns.
- Keep headers sticky when the table scrolls.
- Give action columns stable width and position when horizontal scrolling is possible.
- Expose loading, empty, error, and pagination behavior as applicable.
- Align numeric values for scanning and use Vietnamese formatting utilities.
- Keep row actions discoverable without flooding every row with text buttons.

Concrete APIs: [`components/data-grid.md`](./components/data-grid.md).

## Forms And Dialogs

- Labels remain visible; placeholders are examples or hints, not replacements for labels.
- Standard single-select form fields use `Select` with `SelectTrigger`,
  `SelectValue`, `SelectContent`, and `SelectItem`, matching the employee form
  pattern. Use `OptionSelect` only for searchable/combobox behavior; do not use
  it as a visual replacement for a standard select.
- Không ghi text description trừ khi được yêu cầu.
- Không tự ý bọc card các input; gắn input vào form một cách bình thường như các input khác.
- Required state and Vietnamese validation messages are explicit.
- Default to a compact two-column desktop grid and one column on narrow screens.
- Place destructive actions away from the primary submit action.
- Disable duplicate submit while pending and keep user input on recoverable failure.
- Edit dialogs reset values when the selected record changes; create dialogs preserve their draft
  across close/reopen and reset only through an explicit new-task action.
- Khi submit form nhiều tab thất bại do validation, tự chuyển tới tab chứa lỗi đầu tiên,
  focus vào field lỗi sau khi tab đã mount, vẫn hiển thị `FormMessage` tại field và hiển thị
  toast lỗi ngắn gọn. Quy tắc này áp dụng cả lỗi từ schema validation và lỗi nghiệp vụ được
  thêm bằng `form.setError`; không để người dùng phải tự dò tab hoặc chỉ dựa vào viền đỏ.

### Responsive dialog scrolling

- A dialog with a fixed or maximum height must use a flex shell: header and footer are `shrink-0`,
  while the body is `min-h-0 flex-1`.
- When a form is split into columns on desktop but stacks on mobile, the dialog body owns the
  vertical scroll on mobile (`overflow-y-auto`). Switch back to `overflow-hidden` only at the
  desktop breakpoint when each column intentionally owns its own scroll region.
- Do not apply `h-full` or an ancestor `overflow-hidden` unconditionally to a stacked mobile form;
  they can clip the lower tab panel and prevent its content from scrolling. Use `lg:h-full` and
  `lg:overflow-hidden` for desktop-only constraints.
- For tabbed forms, verify every tab with enough content to exceed the small viewport, including
  the tab below the primary information section. A visible tab is not sufficient if its panel is
  trapped by an ancestor's overflow constraint.

Builder workflow: [`builders/form-dialog.md`](./builders/form-dialog.md). Control APIs:
[`components/forms.md`](./components/forms.md).

## Actions And Feedback

- One clear primary action per task region.
- Use icon-only controls only for familiar actions and give them accessible labels or tooltips.
- Keep buttons in the same action group at the same size; an icon-only button next to a text button with `size="sm"` must use `size="sm"` with `mode="icon"`.
- Confirm destructive or difficult-to-reverse operations.
- Show progress near the initiating action when practical.
- Success feedback is concise; failure feedback explains the next useful action.
- Empty states explain what is absent and offer an action only when one is available.

### Clickable stat cards

- Chỉ biến stat card hoặc item count trong card tổng hợp thành clickable khi thao tác có ý nghĩa rõ
  ràng, thường là lọc danh sách hoặc mở trang/chi tiết liên quan; stat chỉ để đọc thì không dùng
  `cursor-pointer` hoặc icon hành động.
- Toàn bộ card hoặc item count clickable là một target duy nhất. Ưu tiên semantic `button` cho
  filter/action và semantic `a` cho điều hướng; nếu primitive card không hỗ trợ phần tử semantic thì
  phải cung cấp đầy đủ button semantics và không đặt thêm control tương tác bên trong.
- Filter card/item phải có affordance nhất quán: con trỏ pointer, hover state nhẹ (đổi nền hoặc
  elevation), focus ring nhìn thấy được, và icon filter/search ở vị trí cố định. Không dùng màu sắc
  đơn lẻ để truyền đạt card có thể click.
- Tên accessible phải mô tả hành động và đối tượng, ví dụ `Lọc hợp đồng: Đang hiệu lực`. Card/item
  có lựa chọn trạng thái dùng `aria-pressed`; trạng thái đang chọn phải phân biệt được, còn trạng thái
  không chọn có thể giảm emphasis nhưng vẫn phải đọc được và vẫn dùng được.
- Card/item đang chọn phải click lại được để bỏ lựa chọn hoặc reset đúng theo contract của bộ lọc. Hành
  vi này phải nhất quán giữa các stat card cùng nhóm.
- Clickable card/item phải dùng được bằng touch và bàn phím (Enter/Space), có target đủ lớn và giữ thứ
  tự Tab tự nhiên. Khi đang loading hoặc action pending, giữ layout ổn định và chặn thao tác lặp.

### Vai trò phụ trách khách hàng

- `Vai trò phụ trách khách hàng` là phân loại nghiệp vụ theo từng quan hệ
  `khách hàng - nhân viên`; không dùng chung entity `roles` hoặc `permission_groups` của module phân
  quyền tenant.
- Một nhân viên có thể có các vai trò khác nhau trên các khách hàng khác nhau và có thể giữ nhiều vai
  trò trên cùng một khách hàng. Assignment luôn phải hiển thị đồng thời tên nhân viên và vai trò đang
  phụ trách.
- Trang phân quyền nhân viên chỉ quản lý quyền global. Các vai trò như `Hợp đồng` hoặc `Công nợ và
  thanh toán` trong quan hệ khách hàng không được hiển thị hoặc chỉnh sửa tại ma trận quyền global.
- Catalog vai trò phải lưu bằng ID/code ổn định; UI chỉ hiển thị `name`. Không lưu tên vai trò trực tiếp
  trong bảng quan hệ và không dùng tên permission group làm khóa nghiệp vụ.
- Khi phân công, một nhân viên đã chọn phải có ít nhất một vai trò. Nhân viên inactive có thể giữ
  assignment cũ để bảo toàn lịch sử nhưng không được chọn mới.
- Bộ lọc `Theo nhóm` và `Theo nhân viên` nằm trong một hàng full-width bên dưới header bảng. Khi đổi
  chế độ, phải xóa lựa chọn quick-filter của chế độ cũ để không tạo bộ lọc ẩn.
- Mỗi chế độ chỉ được chọn một chip view; chọn chip mới phải thay thế chip cũ. `Tất cả` là trạng thái
  reset của chế độ hiện tại. Segment dùng variant `light-neutral`, chip đang chọn dùng kiểu solid; hàng
  filter không dùng separator để ngăn với toolbar gốc của bảng.
- Segment giữ dạng connected và có cùng chiều cao với chip; active dùng light-neutral với nền xám,
  inactive giữ style nền/text bình thường. Chip inactive dùng light-neutral với nền xám. Danh sách chip
  chiếm toàn bộ phần chiều rộng còn lại, luôn nằm trên một dòng và scroll ngang khi vượt quá viewport;
  không wrap xuống dòng.

## Navigation And Interaction

- Keep navigation placement stable across features.
- Preserve keyboard order, visible focus, Escape behavior, and focus return for overlays.
- Avoid surprise context menus or drag-and-drop as the only interaction path.
- The owning content region scrolls; avoid competing nested scroll containers.
- Responsive behavior preserves the workflow, not every desktop decoration.

## Accessibility

- Text and status indicators meet practical contrast requirements.
- Meaning is never communicated by color alone.
- Inputs, buttons, and icon controls have accessible names.
- Validation and async errors are announced or placed where assistive technology can associate them.
- Touch targets remain usable even in dense layouts.

## Shared Change Checklist

- Does the decision belong to a token or shared component rather than a page?
- Does it remain usable at 1366px and on the supported narrow layout?
- Are Vietnamese defaults correct without per-page translation props?
- Are loading, empty, error, disabled, and keyboard states coherent?
- Is the component guide updated without copying its API back into this document?
