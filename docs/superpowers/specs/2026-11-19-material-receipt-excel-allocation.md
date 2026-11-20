# Đặc tả nhập kho và bàn giao từ Excel

## Lưu phiếu nhập

- Import dùng dialog vật tư hiện có. Dữ liệu trong editor có thể được chuẩn bị khi chưa chọn kho. Khi ghi nhận nhập kho, bắt buộc chọn kho và kiểm tra quyền nhập vào kho đó.
- Giữ đầy đủ hồ sơ vật tư qua preview, lưu phiếu và đọc lại. Đơn vị trong Excel là đơn vị nhận dự kiến, lưu riêng theo dòng; chủ sở hữu sau khi nhập luôn là kho. Đơn vị bỏ trống là hàng giữ lại kho; đơn vị có giá trị nhưng không nhận diện duy nhất là lỗi trên dòng.
- Vật tư có trạng thái ngừng sử dụng trong Excel được lưu với đúng trạng thái đó. Dòng có trạng thái này chỉ có thể nhập vào kho vì bàn giao yêu cầu vật tư đang hoạt động.
- Mã nội bộ hiện hữu trong Excel là mã chính. Mã từ hệ thống ngoài được lưu ở trường mã liên kết tương ứng; dòng thiếu mã chính dùng cơ chế sinh mã hiện có. Với dòng số lượng lớn hơn một, chỉ gán mã chính được cung cấp cho vật tư đại diện, các vật tư còn lại nhận mã riêng do hệ thống sinh. Kiểm tra trùng trong file và toàn bộ danh mục gồm tồn kho; báo dòng và mã xung đột, chỉ hiện chi tiết vật tư nếu người dùng có quyền đọc. Ràng buộc DB kiểm soát ghi đồng thời.
- Thao tác lưu ghi nhận phiếu, dòng, vật tư, liên kết truy vết và một bàn giao chờ xác nhận cho mỗi đơn vị nhận trong cùng giao dịch. Lỗi làm rollback toàn bộ. Dùng khóa yêu cầu bền qua lần thử lại, ràng buộc theo người gọi và đối chiếu nội dung; cùng yêu cầu trả về cùng phiếu, khác nội dung với cùng khóa bị từ chối. Giữ khả năng xử lý phiếu nháp đã tồn tại; không tự chuyển trạng thái hàng loạt.

## Bàn giao và kết thúc phân bổ

- Vật tư đang chờ nhận hiển thị trong tồn kho và được giữ cho bàn giao đang mở. Backend bảo đảm các thao tác song song không thể giữ cùng vật tư hai lần. Chỉ người có quyền của bên nhận xác nhận, sau khi kiểm tra vật tư vẫn thuộc kho nguồn. Xác nhận đổi chủ sở hữu và ghi lịch sử trong cùng giao dịch.
- Kết thúc phân bổ chỉ đóng việc lập thêm bàn giao từ phiếu nhập. Hiển thị số vật tư chờ nhận. Bàn giao đã gửi vẫn có thể xác nhận hoặc hủy theo quyền hiện có. Hủy giải phóng phần đang giữ; vật tư còn lại vẫn thuộc kho. Luồng xóa thủ công dùng quyền và lịch sử hiện có, bảo vệ vật tư có liên kết nghiệp vụ.
- Với phiếu nhập đã kết thúc, thao tác thủ công hiện có là mở lại phiếu và dùng điều chỉnh dòng kèm lý do. Hệ thống lưu vết và vô hiệu hóa vật tư đủ điều kiện.
- Một bảng materials dùng chung. Kho lấy vật tư thuộc kho hiện tại; danh sách vật tư, danh sách nhóm và thống kê/báo cáo mặc định loại vật tư thuộc kho bằng điều kiện phía máy chủ trước phân nhóm, đếm và phân trang. Tra cứu trùng mã áp dụng toàn danh mục. Giữ nguyên quyền đọc và kiểm tra từng hành động.

## Tiêu chí nghiệm thu

- Một file có hai đơn vị và một dòng để lại kho tạo đúng hai bàn giao và ghi nhận đủ vật tư ngay khi lưu, giữ đủ hồ sơ sau tải lại.
- Xác nhận đơn vị A, kết thúc phân bổ, sau đó xác nhận B. Vật tư đổi phạm vi danh sách và thống kê ở đúng từng bước. Dòng để lại kho giữ nguyên.
- Kiểm tra hủy bàn giao, mã trùng giữa kho và đơn vị, đơn vị sai, rollback khi tạo bàn giao thất bại, thử lại cùng yêu cầu, hai yêu cầu đồng thời và tài khoản ngoài phạm vi.
