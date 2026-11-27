# Nhiều loại kiểm tra an toàn cho vật tư

## Phạm vi

Một vật tư có thể có nhiều loại kiểm tra đồng thời. Mỗi loại có tên, bảng kiểm, quy tắc lặp, hạn hiện tại và lịch sử phiếu riêng. Ví dụ, kiểm tra thường xuyên lặp mỗi tháng và kiểm tra chuyên sâu thực hiện theo quý dương lịch.

## Cấu hình và kế thừa

| Cấp | Thao tác |
|---|---|
| Nhóm vật tư | Tạo nhiều loại mặc định, cấu hình bảng kiểm và lịch cho từng loại. |
| Mẫu vật tư | Kế thừa từ nhóm, sửa bảng kiểm hoặc lịch của từng loại, tắt loại kế thừa, tạo loại riêng. |
| Vật tư | Kế thừa từ mẫu, chỉnh chu kỳ hoặc hạn đầu tiên, tắt loại kế thừa, tạo loại riêng kèm bảng kiểm. Nội dung bảng kiểm kế thừa được quản lý ở cấp định nghĩa hoặc cấp mẫu. |

Mỗi loại có ID ổn định. Sửa tên, bảng kiểm hoặc chu kỳ giữ nguyên ID. Loại mới có ID mới dù trùng tên. Hợp nhất cấu hình theo ID với ưu tiên vật tư, mẫu, rồi nhóm. Nếu có cây nhóm, nhóm gần mẫu nhất được ưu tiên. Trường không được ghi đè tiếp tục kế thừa. Loại tắt hoặc lưu trữ ngừng xuất hiện trong danh sách cần kiểm tra và vẫn có lịch sử. Hiển thị nguồn và cho phép trả về cấu hình kế thừa khi phù hợp.

## Quy tắc hạn

- Lịch lặp tiếp tục hỗ trợ các đơn vị hiện có. Hạn tiếp theo = ngày hoàn tất cộng chu kỳ. Khi tháng đích thiếu ngày tương ứng, dùng ngày cuối tháng đó.
- Lịch theo quý dương lịch sử dụng hạn cuối quý. Ngày hoàn tất trong một quý xác lập hạn cho cuối quý kế tiếp. Kiểm tra sớm cho kỳ tương lai không được làm lùi hạn hiện có. So sánh theo ngày địa phương của ứng dụng.
- Khi thêm loại cho vật tư, cho phép đặt hạn đầu tiên. Với cấu hình chung, dùng ngày bắt đầu áp dụng làm mốc mặc định khi tạo lịch cho vật tư. Lưu mốc tính hạn và hạn hiện hành theo từng cặp vật tư, loại.
- Khi chưa có phiếu hoàn tất, người dùng có thể đổi trực tiếp hạn đầu tiên của một vật tư. Checkbox tính lại chu kỳ dùng mốc của lịch đang theo dõi.
- Khi sửa chu kỳ, mặc định giữ hạn đang theo dõi. Chỉ khi hoàn tất phiếu của loại đó mới dùng chu kỳ có hiệu lực mới để tính hạn kế tiếp. Bản nháp và phiếu bị hủy không thay đổi hạn.
- Hiển thị checkbox **Tính lại hạn hiện tại cho các vật tư áp dụng chu kỳ này**, mặc định bỏ chọn. Khi chọn, xem trước vật tư bị ảnh hưởng, hạn cũ và hạn mới. Lấy ngày hoàn tất gần nhất hoặc mốc bắt đầu khi chưa có phiếu hoàn tất để tính lại. Giữ nguyên vật tư có chu kỳ ghi đè ở cấp dưới, loại đang tắt và lịch của loại khác. Khi đổi chu kỳ riêng tại vật tư, áp dụng cùng quy tắc giữ hạn và cho phép tính lại ngay cho đúng vật tư.
- Xác nhận cập nhật cấu hình và tính lại hạn trong cùng giao dịch. Server kiểm tra quyền, cấu hình hiệu lực và tính lại phạm vi thay đổi khi lưu. Nếu phạm vi hoặc hạn khác bản xem trước do thay đổi đồng thời, yêu cầu xem lại trước khi áp dụng.

## Màn hình

- Tab **Kiểm tra an toàn** ở nhóm, mẫu và vật tư hiển thị các loại, chu kỳ và nguồn. Ở vật tư hiển thị thêm hạn, trạng thái và thao tác lập phiếu. Dùng trình chỉnh bảng kiểm hiện có cho loại được phép sửa.
- Các loại gắn với hồ sơ đã lưu. Trong màn hình tạo mới, tab hướng dẫn lưu nhóm, mẫu hoặc vật tư trước khi thêm cấu hình riêng. Bản nháp nhập kho hiển thị cấu hình kế thừa từ mẫu. Các vật tư tạo từ phiếu nhập nhận lịch kế thừa khi được ghi nhận.
- **Vật tư cần kiểm tra** hiển thị một dòng cho mỗi cặp vật tư và loại. Giữ tìm kiếm, bộ lọc, phân trang, trạng thái tải/lỗi và các hành động hiện có. Hành động trên dòng truyền đúng loại sang màn lập phiếu. Nếu vào từ chi tiết vật tư, cho chọn loại đang áp dụng, tự chọn khi chỉ có một loại.
- Danh sách và lịch sử phiếu có cột/bộ lọc loại kiểm tra. Chi tiết và bản nháp hiển thị bảng kiểm đã lưu tại thời điểm lập phiếu. Các điểm hiển thị trạng thái tổng hợp theo vật tư dùng hạn gần nhất và trạng thái cần xử lý nhất. Thống kê theo lịch phân biệt số lượt kiểm tra với số vật tư.
- Dùng workflow và registry builder cho các bề mặt được hỗ trợ. Giữ DataGrid và các renderer nghiệp vụ sẵn có, toolbar xuyên suốt các trạng thái, và cập nhật hai bộ thông điệp.

## Dữ liệu và quyền

- Lưu định nghĩa loại, cấu hình kế thừa/ghi đè và lịch hiệu lực theo vật tư. Phiếu lưu ID loại, tên và nội dung phiên bản bảng kiểm tại lúc lập. Khóa duy nhất theo vật tư và loại cho lịch, cập nhật hạn nguyên tử với hoàn tất phiếu, bảo vệ trước lưu lặp và hoàn tất đồng thời.
- Migration chuyển chuỗi cấu hình cũ thành loại **Kiểm tra an toàn** tương ứng với phạm vi hiện có, nối phiếu cũ với loại và giữ nguyên bảng kiểm đã lưu, chu kỳ có hiệu lực, hạn, kết quả và bản nháp. Giữ khác biệt do snapshot hoặc ghi đè nếu dữ liệu thực tế có chênh lệch. Frontend dùng hợp đồng mới.
- API/RPC áp dụng quyền hiện có cho đọc, sửa cấu hình, xem trước phạm vi và lập phiếu. Tính hạn, lọc, đếm và phân trang ở server. Tách thao tác xem trước khỏi thao tác lưu. Kiểm tra các đường đọc liên quan gồm hàng đợi kiểm tra, chi tiết vật tư, dashboard và cảnh báo nếu đang dùng cấu hình một lịch.

## Tiêu chí nghiệm thu

1. Vật tư kế thừa hai loại từ nhóm. Mẫu ghi đè một loại và thêm loại thứ ba. Vật tư có thể tắt một loại và tạo loại riêng. Mỗi loại xuất hiện một lần với đúng nguồn, bảng kiểm và chu kỳ.
2. Hai loại cùng vật tư có thể có hạn và trạng thái khác nhau. Hoàn tất một loại chỉ đổi hạn loại đó. Luồng mở từ hàng đợi và từ chi tiết cho ra đúng bảng kiểm.
3. Đổi chu kỳ với checkbox bỏ chọn giữ nguyên hạn của mọi vật tư. Chọn checkbox cho ra hạn xem trước đúng và cập nhật đúng phạm vi. Lần sau sửa cấu hình, checkbox trở về mặc định bỏ chọn.
4. Trường hợp qua cuối tháng, qua quý, chưa có lần hoàn tất và loại có ghi đè được kiểm tra. Phiếu cũ và phiếu nháp giữ nội dung gốc khi cấu hình thay đổi.
5. Dữ liệu chuyển đổi giữ hạn và lịch sử. Kiểm tra quyền và kết quả lọc/phân trang tương ứng. Chạy kiểm tra tập trung, kiểm tra import, TypeScript và production build cho lần triển khai này.
