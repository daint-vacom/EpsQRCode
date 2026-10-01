# Kế hoạch rà soát UI state theo menu sidebar

## Trạng thái

Kế hoạch đang tạm dừng theo yêu cầu để chuyển sang công việc khác. Khi tiếp tục, bắt đầu từ module **Khách hàng**.

| # | Menu sidebar | Trạng thái |
| --- | --- | --- |
| 1 | Tổng quan | Hoàn tất |
| 2 | Việc của tôi | Hoàn tất |
| 3 | Khách hàng | Chưa rà soát |
| 4 | Hợp đồng | Chưa rà soát |
| 5 | Mẫu hợp đồng | Chưa rà soát |
| 6 | Công việc | Chưa rà soát |
| 7 | Mẫu công việc | Chưa rà soát |
| 8 | Sổ thu chi | Chưa rà soát |
| 9 | Công nợ | Chưa rà soát |
| 10 | Quỹ & Tài khoản | Chưa rà soát |
| 11 | Báo cáo | Chưa rà soát |
| 12 | Nhân viên | Chưa rà soát |
| 13 | Tệp lưu trữ | Chưa rà soát |
| 14 | Phân quyền | Chưa rà soát |
| 15 | Cấu hình dữ liệu | Chưa rà soát |
| 16 | Danh mục | Chưa rà soát |
| 17 | Cài đặt | Chưa rà soát |

Mỗi menu sidebar cấp cuối là một module. Chỉ rà soát một module trong mỗi lượt; báo cáo kết quả rồi dừng để người dùng xem trước khi chuyển sang module tiếp theo. Không liệt kê chi tiết các trang trong kế hoạch; xác định chúng khi bắt đầu rà soát module tương ứng.

## Quy tắc rà soát mỗi module

- Mở các trang thuộc menu hiện tại, rà soát và cập nhật đủ ba UI state: **Idle**, **loading**, **error**. Giữ page toolbar hiển thị trong cả ba state.
- Khi loading, chỉ dùng skeleton cho nội dung phụ thuộc dữ liệu từ server. Giữ tiêu đề, tên card/section và các đầu mục tĩnh để người dùng vẫn nhận biết cấu trúc trang.
- Dùng `ErrorState` chung cho lỗi tải dữ liệu. Lỗi dữ liệu cốt lõi của một trang chi tiết một đối tượng có thể hiển thị toàn trang; lỗi ở tab, section hoặc cụm UI độc lập phải hiển thị cục bộ. Lỗi trên dashboard luôn giới hạn trong cụm UI bị ảnh hưởng.
- `ErrorState` và empty placeholder dùng chung không tự bọc card. Đặt chúng trực tiếp trên nền trang hoặc trong vùng nội dung của card cha để tránh card lồng card.
- Với trang chi tiết, kiểm tra toolbar có nút back dạng ghost, icon và tiêu đề mặc định khi chưa có dữ liệu; sau khi tải xong hiển thị tiêu đề thật. Chỉ hiện các nút chức năng chính khi đã có dữ liệu.
- Kiểm tra empty placeholder phù hợp với cấu trúc từng trang và từng cột/nhóm dữ liệu khi có áp dụng.
- Nếu dữ liệu thực tế không đủ để kiểm tra UI state, có thể thêm select preview tạm trên toolbar gồm **Idle**, **Đang tải**, **Lỗi** và **Empty**. Preview chỉ điều khiển UI, không sửa dữ liệu server. Sau khi người dùng kiểm tra xong module, gỡ select và logic preview trước khi commit module.
- Giữ nguyên nghiệp vụ và UI không liên quan. Nếu phát hiện thiếu state khi làm trên trang cũ, đề xuất phần bổ sung tập trung trong module hiện tại; không tự mở rộng sang các module khác.
- Sau khi module được người dùng xác nhận, bỏ mock/preview state còn lại, chạy `git diff --check`, kiểm tra hẹp phù hợp và commit. Sau đó báo cáo kết quả và dừng.

## Tiến độ gần nhất

- **Tổng quan** đã được rà soát và commit trước đó.
- **Việc của tôi** đã được rà soát; mock state đã gỡ và thay đổi đã commit trong `2ad814e` (`feat(work): standardize work page states`).
- **Khách hàng** là module tiếp theo khi tiếp tục kế hoạch.
