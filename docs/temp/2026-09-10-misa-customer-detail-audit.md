# Audit trang chi tiết khách hàng MISA và phạm vi P0 cho KTDV Vacom

Ngày audit: 2026-09-10

## Nguồn kiểm tra

- MISA ASP: trang Khách hàng, panel chi tiết một khách hàng mẫu đang mở trên Edge.
- KTDV Vacom: trang danh sách và trang chi tiết khách hàng hiện tại trong workspace.
- Phạm vi lượt này: ghi nhận audit và triển khai nhóm P0 trong phần Thông tin chung; chưa triển khai dịch vụ, công nợ, tài chính hoặc tài khoản phần mềm.

## Cấu trúc thông tin chi tiết trên MISA

MISA chia chi tiết khách hàng thành các nhóm:

- **Thông tin chung:** logo, loại hình đơn vị, mã số thuế/QHNS/ĐKKD, tên khách hàng, nhóm khách hàng, ngày thành lập, kỳ kê khai GTGT, trạng thái, địa chỉ theo nhiều cấp, người liên hệ, chức danh, điện thoại và email.
- **Thông tin mở rộng:** các trường bổ sung có thể cấu hình.
- **Thông tin tài chính:** bộ dữ liệu, doanh thu, chi phí, số lượng hóa đơn đầu vào/đầu ra, kỳ kê khai, kỳ kê khai tiếp theo, nhân viên phụ trách.
- **Dịch vụ cung cấp:** tên dịch vụ, mô tả, phí, kỳ tính phí, kỳ bắt đầu/kết thúc, tài liệu đính kèm.
- **Tài khoản phần mềm:** tên phần mềm, địa chỉ truy cập, tài khoản, mật khẩu, loại tài khoản, ngày hết hạn.
- **Công nợ:** ngày, diễn giải, công nợ, thanh toán, số dư.
- **Ghi chú:** ngày, nội dung, người tạo, tài liệu đính kèm.
- **Thông tin gói sản phẩm:** gói sản phẩm, ngày bắt đầu, hạn sử dụng.

## Khoảng trống P0 đã xác định cho Vacom

Vacom đã có mã khách hàng, tên, loại hình, mã số thuế, quốc gia, tỉnh/thành phố, địa chỉ chi tiết, điện thoại, email, trạng thái và ghi chú. Các trường P0 cần trở thành dữ liệu chuẩn trong **Thông tin chung**:

- Người liên hệ và chức danh.
- Ngày thành lập.
- Kỳ kê khai thuế GTGT.
- Địa chỉ có cấu trúc: quận/huyện, phường/xã, số nhà/tên đường; vẫn giữ địa chỉ đầy đủ hiện có.

Theo quyết định cập nhật sau audit, **Trạng thái quan hệ** không đưa vào form và domain contract của Vacom ở lượt này.

Nhóm khách hàng/nhãn và nhân viên phụ trách đã có các điểm tích hợp riêng trong Vacom, nên không nhân bản thêm vào form P0 ở lượt này.

## Nguyên tắc triển khai

- Trường P0 là cột dữ liệu riêng trong `customers`, không đẩy vào `customFields`, vì đây là dữ liệu nghiệp vụ lõi và cần dùng lại ở màn chi tiết/lọc/báo cáo sau này.
- Các trường địa chỉ quận/huyện, phường/xã và số nhà/tên đường được bổ sung dưới dạng text trước; chưa mở rộng catalog địa giới khi chưa có nguồn dữ liệu tương ứng.
- Kỳ kê khai thuế dùng tập giá trị chuẩn: theo tháng, theo quý, theo năm; form bắt buộc chọn một giá trị. `unspecified` chỉ giữ cho dữ liệu cũ chưa cập nhật.
- Cột `relationship_status` trong migration đã áp dụng được giữ lại để tương thích dữ liệu/migration, nhưng không còn được model, payload hoặc UI đọc/ghi.
- Không đưa tài khoản/mật khẩu phần mềm vào lượt P0; nếu triển khai sau cần thiết kế lưu trữ và phân quyền bảo mật riêng.

## Checklist lượt triển khai

- [x] Migration mở rộng bảng `customers` và giữ tương thích dữ liệu cũ.
- [x] Cập nhật model, schema, mapper và payload API.
- [x] Bổ sung các trường vào form Thông tin chung.
- [x] Hiển thị các trường mới ở thẻ thông tin chi tiết và dialog chi tiết.
- [x] Bổ sung test schema/mapping và chạy TypeScript, import lint, build.

## Kết quả triển khai lượt này

Đã bổ sung các trường P0:

- Quận/Huyện, Phường/Xã, Số nhà/tên đường, Địa chỉ đầy đủ.
- Người liên hệ, Chức danh.
- Ngày thành lập.
- Kỳ kê khai thuế GTGT: theo tháng, theo quý, theo năm; bắt buộc chọn trên form.
- Tab **Thông tin chung** đã chia thành ba nhóm: **Thông tin cơ bản**, **Thông tin người liên hệ**, **Thông tin địa chỉ**.
- Mã số thuế / QHNS / ĐKKD đã chuyển sang cột trái, ngay phía trên số điện thoại.
- Đã bỏ trường **Trạng thái quan hệ** khỏi form, model, payload API và các màn hình chi tiết.

## Cập nhật tiếp theo

- Kỳ kê khai thuế GTGT đổi sang radio bắt buộc với ba lựa chọn: theo quý, theo tháng, theo năm.
- Bổ sung loại hình **Hộ kinh doanh**, thứ tự hiển thị: Cá nhân, Hộ kinh doanh, Doanh nghiệp.
- Bỏ input Ghi chú khỏi thông tin chung; ghi chú sẽ được triển khai thành bảng riêng.
- Bổ sung Nhóm khách hàng ở cột trái bằng TagSelect, chỉ nạp các nhãn thuộc group/module `customers`; assignment được lưu qua `tag_assignments`.
- Cập nhật migration `20260911010000_customer_business_type_and_vat_period.sql` và đã xác minh remote enum `business_type` cùng constraint kỳ kê khai.

Kiểm tra đã đạt: `tsc --noEmit`, import lint cho các file thay đổi, 2 file test/3 test customer, `npm run build`, `git diff --check`. Build vẫn in cảnh báo chunk lớn vốn có của bundle; không có lỗi build.

Migration đã được tạo trong repo và đã áp dụng lên database remote qua session pooler. Đã xác nhận migration `20260910020000` trong `supabase_migrations.schema_migrations` và đủ 8 cột P0 trên `public.customers`; trong đó `relationship_status` được giữ lại tương thích nhưng không còn thuộc contract ứng dụng.
