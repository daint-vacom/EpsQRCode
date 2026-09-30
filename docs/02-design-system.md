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

### Component dùng chung theo nghiệp vụ

- Với một khái niệm nghiệp vụ xuất hiện ở nhiều surface như bảng, select, detail và form, phải tạo
  component nghiệp vụ dùng chung trước khi triển khai từng surface.
- Component đó là nguồn duy nhất cho label, trạng thái, màu sắc, icon và cách trình bày của khái niệm;
  không khai báo lại config tương đương ở từng bảng hoặc từng select.
- Ví dụ `FinanceAccountStatusBadge` là nguồn duy nhất cho trạng thái quỹ/tài khoản. Bảng tài khoản,
  account select và các màn hình tài chính khác phải dùng component này để giữ cùng label và kiểu badge
  solid/outline.
- Khi cần biến thể kích thước hoặc ngữ cảnh, mở rộng prop của component dùng chung; không tạo thêm
  component/config cục bộ chỉ để thay đổi một surface.

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

### Responsive column sizing and browser review

- Size fixed columns from their real content and cell padding. For switches, checkboxes, and icon actions,
  use the known control dimensions; for text columns, account for the header and representative cell values.
  If the value has a known maximum length, size for that bound. If it is unbounded, choose a sensible maximum
  and use intentional truncation rather than allowing that column to grow indefinitely.
- Keep utility columns compact and stable. Designate the main descriptive column (for example, a name/title
  column) to receive the remaining table width so wide screens use the available space without stretching
  every column.
- Calculate the main column width from the table viewport and the widths of the currently visible fixed
  columns: `max(minimumMainWidth, viewportWidth - sum(visibleFixedColumnWidths))`. Keep a minimum width that
  preserves readable content; when the viewport is narrower than the combined minimums, retain horizontal
  scrolling instead of shrinking the main column below that minimum.
- Recalculate the main column when the table viewport resizes or column visibility changes. A `ResizeObserver`
  can track the viewport. Hidden columns must not consume width in the calculation.
- After every change to column sizing, visibility, or table layout, inspect the affected page in a browser
  before finishing. Check the actual table with representative content at the target wide viewport (use the
  product's 1366px and 1920px reference widths when applicable), and also check a narrower viewport when the
  change can affect horizontal scrolling.
- In the browser, confirm headers and body cells share the same column boundaries, headers are fully visible,
  truncation is intentional, fixed columns remain compact, and no large blank strip remains inside the table
  because the table stopped before the available viewport. Recheck after each sizing adjustment rather than
  relying only on source inspection or a build.

### Editor table có reorder và focus

- Với editor table có kéo thả, `DndContext` và `SortableContext` phải bao quanh toàn bộ
  `<table>` từ bên ngoài. Không đặt `DndContext` trực tiếp giữa `<table>` và `<thead>`/
  `<tbody>` vì DnD có thể render node hỗ trợ dạng `div`, làm HTML không hợp lệ; trình duyệt
  sẽ tự sửa cây DOM và gây lỗi layout hoặc làm focus bật về dialog.
- Cell có input phải giữ control thật làm target tương tác. Chỉ bọc control bằng `Tooltip`
  khi thực sự có message lỗi/cảnh báo; trạng thái bình thường không nên có wrapper tooltip
  thừa can thiệp vào pointer/focus.
- Sau mỗi thay đổi ở editor table, kiểm tra chuyển focus liên tiếp qua nhiều loại input trong
  nhiều dòng, bao gồm text, URL, mật khẩu và date. Console không được có cảnh báo nested DOM
  trong `<table>`, và cấu trúc con trực tiếp của bảng phải giữ đúng `THEAD` và `TBODY`.

Concrete APIs: [`components/data-grid.md`](./components/data-grid.md).

## Forms And Dialogs

- Labels remain visible; placeholders are examples or hints, not replacements for labels.
- Standard single-select form fields use `Select` with `SelectTrigger`,
  `SelectValue`, `SelectContent`, and `SelectItem`, matching the employee form
  pattern. Use `OptionSelect` only for searchable/combobox behavior; do not use
  it as a visual replacement for a standard select.
- Không ghi text description trừ khi được yêu cầu.
- Không tự ý bọc card các input; gắn input vào form một cách bình thường như các input khác.
- Placeholder và empty state không cần bọc trong `Card`; chỉ hiển thị text trực tiếp
  trên nền trang, trừ khi nội dung đó cần một container có cấu trúc riêng.
- Required state and Vietnamese validation messages are explicit.
- Default to a compact two-column desktop grid and one column on narrow screens.
- Place destructive actions away from the primary submit action.
- Disable duplicate submit while pending and keep user input on recoverable failure.
- Edit dialogs reset values when the selected record changes; create dialogs preserve their draft
  across close/reopen and reset only through an explicit new-task action.
- Dialog chỉnh sửa phải hiển thị tên đối tượng ngay trong `DialogTitle`, theo mẫu
  `Sửa [loại đối tượng]: [tên đối tượng]`. Tên đối tượng dùng `font-semibold text-primary` để
  phân biệt ngữ cảnh đang chỉnh sửa; giữ toàn bộ nội dung trong một tiêu đề accessible và dùng
  fallback tên loại đối tượng khi dữ liệu tên chưa sẵn sàng. Dialog thêm mới không áp dụng quy tắc
  này vì chưa có đối tượng cụ thể.
- Khi submit form nhiều tab thất bại do validation, tự chuyển tới tab chứa lỗi đầu tiên,
  focus vào field lỗi sau khi tab đã mount, vẫn hiển thị `FormMessage` tại field và hiển thị
  toast lỗi ngắn gọn. Quy tắc này áp dụng cả lỗi từ schema validation và lỗi nghiệp vụ được
  thêm bằng `form.setError`; không để người dùng phải tự dò tab hoặc chỉ dựa vào viền đỏ.

### Dialog shell và khoảng cách form

- Dialog có form phải dùng một shell nhất quán: `DialogContent` dùng `flex flex-col gap-0
  overflow-hidden p-0`, `DialogHeader` dùng `shrink-0` cùng padding ngang/dọc, phần form đặt
  trong `DialogBody` (hoặc wrapper tương đương) dùng `min-h-0 flex-1 overflow-y-auto px-6 py-5`,
  và `DialogFooter` dùng `shrink-0 px-6 py-4`.
- Không đặt trực tiếp `<Form>` hoặc `<form>` ngay sau `DialogHeader` trong `DialogContent` mặc định.
  `DialogContent` có padding ngoài nhưng không tạo khoảng cách giữa các sibling, vì vậy form sẽ bị
  dính sát header; body wrapper là nơi sở hữu spacing và vùng scroll.
- Dialog ngắn vẫn giữ body wrapper để khoảng cách header–form–footer nhất quán. Chỉ bỏ `max-height`
  hoặc `overflow-y-auto` khi dialog thực sự không cần scroll; không bỏ padding body để sửa nhanh khoảng
  cách.

### Password và input có ẩn/hiện

- Mặc định dùng `Input` với `type="password"` cho mật khẩu khởi tạo, đổi mật khẩu và các secret
  không cần xem lại. Đây là cùng pattern với màn hình đăng nhập và không tự chèn nút con mắt.
- `PasswordInput` là primitive opt-in: chỉ dùng khi UX đã yêu cầu người dùng chủ động ẩn/hiện giá trị.
  Primitive này cố ý thêm nút con mắt, nên không dùng cho mọi input password theo mặc định.
- Dùng `autoComplete="new-password"` khi tạo/đặt lại mật khẩu; dùng `current-password` cho mật khẩu
  hiện tại hoặc đăng nhập. Không đổi mật khẩu thành input text để né hành vi ẩn/hiện.
- Với các input nhạy cảm khác cần ẩn/hiện, dùng cùng một pattern có kiểm soát: nút phải có
  `type="button"`, accessible label/tooltip rõ ràng (ví dụ `Xem mật khẩu` và `Ẩn mật khẩu`), không
  làm mất giá trị hoặc thông báo lỗi của field, và không được vô tình submit form.

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

## Page States And Loading

- Every page has three UI states: **Idle**, **loading**, and **error**. Idle is the loaded page, including a purposeful empty state when there is no data. Loading and error preserve the page's location and navigation context.
- While loading, use skeletons only for content that depends on pending server data. Keep static structure visible, including the page toolbar, section and card titles, field or metric labels, tabs, table headers, and other known headings. Users should still be able to understand what the page contains before its data arrives.
- Match each skeleton to its data region and preserve the surrounding layout. Do not replace a whole page, section, or card with one undifferentiated skeleton when its static structure is already known.
- For pages composed of independent server queries, show loading and error feedback in the affected section while keeping unrelated sections and their headings visible. Use a page-wide loading surface only when the page structure genuinely cannot render before its initial data is available; keep the page toolbar outside that surface.
- A page-wide error is reserved for a detail page centered on one object when that object's core data could not be loaded. On multi-tab detail pages, a core-object failure may replace the detail content with a page-wide error, while a failure in one tab or UI cluster stays inside that tab or cluster. Dashboards always show errors within the affected data cluster; one failed query must not replace the whole dashboard.
- Error states explain what failed and offer a relevant retry or recovery action when available. Use the shared `ErrorState` for data-load failures. It has no card or surface of its own: place it on the page background or directly in the content area of an existing parent card, and never wrap it in another card. Keep the page toolbar and static section/card headings visible.

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
