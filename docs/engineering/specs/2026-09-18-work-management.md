# Module Công việc và Mẫu công việc

**Ngày:** 18/09/2026  
**Trạng thái:** Được chốt để triển khai Phase 1  
**Phạm vi:** Quản lý công việc nội bộ cho doanh nghiệp kế toán dịch vụ

## 1. Mục tiêu

Module này quản lý một công việc có một nhân viên phụ trách chính và các đầu mục con
được giao cho nhiều nhân viên khác nhau. Công việc có thể liên kết tùy chọn với nhiều
khách hàng và nhiều hợp đồng, hoặc không liên kết với đối tượng nghiệp vụ nào.

Phase 1 cung cấp:

- Danh sách công việc.
- Kanban theo trạng thái.
- Calendar theo ngày dự kiến.
- Việc của tôi.
- Công việc cha và đầu mục con.
- Mẫu công việc.
- Liên kết nhiều khách hàng/nhiều hợp đồng theo kiểu many-to-many.
- Ngày bắt đầu và hoàn thành dự kiến; ngày thực tế do hệ thống ghi nhận.

## 2. Quy tắc nghiệp vụ

### 2.1. Công việc và đầu mục

- Một công việc có tối đa một `assignee_employee_id`.
- Một công việc có thể có nhiều đầu mục con.
- Mỗi đầu mục con có tối đa một nhân viên phụ trách chính.
- Nhân viên liên quan khác được thể hiện bằng người theo dõi ở phase sau, không làm mờ
  trách nhiệm chính.
- Đầu mục con kế thừa ngữ cảnh hiển thị của công việc cha nhưng không tự nhân bản liên kết.

### 2.2. Liên kết nghiệp vụ

- Liên kết là optional.
- Một công việc có thể liên kết 0..n khách hàng.
- Một công việc có thể liên kết 0..n hợp đồng.
- Hợp đồng chỉ liên kết ở mức `contract_id`; không liên kết phiên bản, khoản thu hoặc kỳ thanh toán
  trong Phase 1.
- Dùng bảng liên kết riêng có foreign key thay vì `object_type + object_id` không kiểm soát được FK.

### 2.3. Ngày tháng

- `planned_start_date` và `planned_end_date` do người dùng nhập.
- `actual_started_at` tự ghi lần đầu công việc chuyển sang `in_progress`.
- `actual_completed_at` tự ghi khi công việc chuyển sang `completed`.
- Nếu công việc được mở lại, `actual_completed_at` được xóa; lịch sử chi tiết sẽ bổ sung ở phase audit.

### 2.4. Trạng thái và ưu tiên

Trạng thái:

```text
draft → todo → in_progress → completed
                    └──────→ paused
draft/todo/in_progress/paused → cancelled
```

Ưu tiên: `low`, `normal`, `high`, `urgent`.

Quá hạn được tính từ `planned_end_date` khi công việc chưa hoàn thành, không lưu thành một trạng thái
độc lập.

## 3. Mẫu công việc

Mẫu công việc là cấu hình dùng để tạo nhanh các đầu mục chuẩn. Mẫu gồm:

- Mã và tên mẫu.
- Mô tả.
- Trạng thái hoạt động.
- Các bước theo thứ tự.
- Mô tả bước.
- Số ngày dự kiến tương đối.
- Bắt buộc/không bắt buộc.

Khi tạo công việc từ mẫu, các bước được sao chép thành đầu mục độc lập. Thay đổi mẫu không làm thay đổi
các công việc đã tạo trước đó.

Phase 1 cho phép quản lý mẫu và tạo công việc thủ công từ mẫu; tự động sinh công việc theo hợp đồng/kỳ
dịch vụ là phase sau.

## 4. Màn hình

### 4.1. Công việc

- Bộ lọc từ khóa, trạng thái, ưu tiên.
- View `Danh sách`, `Kanban`, `Calendar`.
- Tạo mới, sửa, xóa công việc.
- Hiển thị người phụ trách, ngày dự kiến, tiến độ đầu mục, liên kết khách hàng/hợp đồng.

### 4.2. Việc của tôi

Là cùng danh sách công việc nhưng cố định bộ lọc theo nhân viên đang đăng nhập. Người dùng vẫn được
chuyển giữa danh sách, Kanban và Calendar.

### 4.3. Chi tiết công việc

- Thông tin chung.
- Danh sách đầu mục con.
- Tạo đầu mục con.
- Cập nhật trạng thái/nhân viên phụ trách.
- Danh sách liên kết khách hàng/hợp đồng.

### 4.4. Mẫu công việc

- Danh sách mẫu.
- Tạo/sửa mẫu.
- Quản lý danh sách bước trong mẫu bằng mỗi dòng một bước.

## 5. Mô hình dữ liệu

```text
work_templates
  └─ work_template_steps

work_items
  ├─ work_item_customers ── customers
  └─ work_item_contracts ── contracts
```

`work_items.parent_id` biểu diễn quan hệ công việc cha/con. `work_items.template_id` chỉ lưu nguồn mẫu,
không làm cho công việc phụ thuộc runtime vào mẫu.

Không có liên kết trực tiếp từ công việc sang `finance_obligations`, `finance_vouchers` hoặc
`contract_charges` trong Phase 1. Công việc vận hành và posting tài chính là hai sự kiện riêng.

## 6. API và quyền

Phase 1 dùng RPC tạo công việc để ghi công việc và các liên kết trong một transaction. Đọc danh sách dùng
RPC có scope tenant. Các quyền module riêng sẽ được bổ sung sau khi catalog phân quyền cho Công việc được
chốt; migration vẫn giới hạn dữ liệu theo tenant và nhân viên phụ trách ở UI/API scope.

## 7. Tiêu chí nghiệm thu

- Tạo công việc không có khách hàng/hợp đồng thành công.
- Tạo công việc với nhiều khách hàng và nhiều hợp đồng thành công.
- Tạo đầu mục con cho nhiều nhân viên khác nhau.
- Công việc cha hiển thị tiến độ đầu mục.
- Chuyển trạng thái sang `Đang thực hiện` tự ghi ngày bắt đầu thực tế.
- Chuyển trạng thái sang `Hoàn thành` tự ghi ngày hoàn thành thực tế.
- Danh sách, Kanban và Calendar dùng cùng một nguồn dữ liệu.
- `Việc của tôi` chỉ hiển thị công việc được giao cho nhân viên hiện tại.
- Tạo công việc từ mẫu sao chép bước mà không làm thay đổi mẫu.
- Liên kết khách hàng/hợp đồng không bị trùng.
- Công việc không tạo hoặc thay đổi dữ liệu tài chính.
