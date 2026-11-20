# Kế hoạch triển khai nhập kho và bàn giao từ Excel

Đặc tả nghiệp vụ nằm tại [Nhập kho và bàn giao từ Excel](../superpowers/specs/2026-11-19-material-receipt-excel-allocation.md).

- [x] Rà RPC phiếu nhập, hồ sơ đại diện, xác nhận/hủy bàn giao, quyền và toàn bộ đường đọc vật tư. Giữ các thay đổi Excel và editor đang có trong workspace.
- [x] Viết migration cho đơn vị nhận theo dòng, tính lặp an toàn và thao tác ghi nhận nguyên tử. Tái sử dụng nghiệp vụ bàn giao và lịch sử, bảo vệ phân bổ đồng thời, giữ tương thích phiếu nháp cũ.
- [x] Đồng bộ phạm vi danh sách vật tư, danh sách nhóm, thống kê/báo cáo và tồn kho. Đối chiếu bản ghi, số đếm và thứ tự theo quyền kho, bên nhận và ngoài phạm vi.
- [x] Nối dialog Excel, editor và trang chi tiết với API. Giữ thông tin khi đọc lại, hiển thị số lượng chờ, lỗi theo dòng và bản dịch Việt/Anh.
- [x] Chạy [kiểm thử phiếu nhập](../../supabase/tests/material_receipt_excel_allocation.sql) và kiểm tra phạm vi danh sách trên PostgreSQL cô lập. Kịch bản có hai đơn vị nhận, một vật tư để lại kho, thử lại cùng yêu cầu và xác nhận sau khi kết thúc phân bổ.
- [x] Xác minh build, import lint và 6 test hồi quy có mục tiêu. Kiểm tra TypeScript của ứng dụng còn lỗi nền, phần triển khai không thêm chẩn đoán mới. Ba test schema bàn giao thất bại tương tự trên HEAD.
- [ ] Sau khi triển khai vào môi trường Supabase phù hợp, chạy kịch bản hai đơn vị qua trình duyệt và thử hai yêu cầu đồng thời từ hai kết nối riêng.

## Migration

1. [Ghi nhận nhập và bàn giao từ Excel](../../supabase/migrations/20261119085350_material_receipt_excel_allocation.sql)
2. [Phạm vi danh sách và thống kê mặc định](../../supabase/migrations/20261119091150_exclude_warehouse_materials_from_default_reads.sql)
