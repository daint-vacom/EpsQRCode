# Quy ước nhập và xuất Excel

Tài liệu này áp dụng chung cho các chức năng nhập và xuất Excel trong EpsQRCode.

## Phân chia trách nhiệm

- Frontend đọc workbook, nhận diện trang tính và dòng tiêu đề, ánh xạ cột, chuẩn hóa dữ liệu, kiểm tra lỗi, xem trước kết quả nhập và tạo file xuất.
- Backend nhận DTO đã chuẩn hóa và cung cấp API tạo hàng loạt khi cần. Không chuyển quy tắc ánh xạ theo cột Excel vào backend.
- Mẫu Excel hệ thống có thể được cập nhật mà không đổi mã ánh xạ, miễn là giữ khóa trường trong marker.

## Nhận diện trường và ánh xạ

- Dùng marker ổn định theo trường, ví dụ `__eps_field__:material.code`, để nhận diện ý nghĩa cột. Marker là hợp đồng máy đọc; nhãn hiển thị có thể đổi hoặc dịch.
- Không gắn ý nghĩa nghiệp vụ với chữ cột, số thứ tự cột hoặc địa chỉ ô cố định. Mẫu có thể chuyển vị trí cột mà vẫn giữ nguyên marker.
- Với mẫu không có marker, ánh xạ theo nhãn cột hiện tại và các alias đã biết. Giữ luồng xem trước/xác nhận khi ánh xạ không chắc chắn.
- Có thể thêm nhiều cột cho các trường khác nhau của cùng đối tượng; mỗi cột cần một khóa trường riêng. Không tạo cột đánh số chung nếu đã có tên thuộc tính thực tế.
- Mẫu người dùng tải lên được giữ bố cục riêng. Mẫu hệ thống được sắp xếp theo thứ tự trường chuẩn của chức năng trước khi ghi dữ liệu.

## Nhãn và giá trị nghiệp vụ

- Tên cột xuất phải dùng nhãn nghiệp vụ đang hiển thị trên UI; không đưa tên thuộc tính nội bộ như `Override` hoặc cách gọi sai nghiệp vụ như “Tên vật tư riêng”.
- Giá trị enum xuất dưới dạng nhãn dễ hiểu đã dịch, không xuất mã nội bộ như `good`, `damaged`, `eps` hoặc `warehouse`.
- Khi nhập, chuẩn hóa nhãn đã dịch về enum/DTO chuẩn. Có thể chấp nhận mã enum cũ như alias để đọc lại các file đã phát hành trước đó.
- Tên cột của thuộc tính động, như thông số kỹ thuật, phải là tên thuộc tính thực tế. Marker giữ khóa ổn định của thuộc tính; không dùng “Thông số 1”, “Thông số 2” làm nhãn cuối cùng.
- Thông số màu xuất nhãn màu đã chọn thay vì mã hex. Khi nhập, đổi nhãn khớp với lựa chọn của mẫu về giá trị chuẩn; có thể chấp nhận mã màu cũ để đọc file đã phát hành trước đó.
- Giá trị xuất phải phản ánh dữ liệu người dùng nhìn thấy. Với trường có giá trị kế thừa từ mẫu/đối tượng cha, xuất giá trị hiệu lực thay vì để trống chỉ vì không có override.

## Thứ tự nhóm cột

- Đặt mã định danh của đối tượng ở đầu bảng.
- Gom các trường cốt lõi của đối tượng ngay sau mã định danh: mã mẫu, tên, mô tả, số sê-ri, tình trạng, ghi chú và thuộc tính động.
- Đặt các nhóm liên quan như chủ sở hữu, người mượn hoặc đơn vị quản lý sau nhóm thông tin cốt lõi.
- Thứ tự chuẩn được định nghĩa trong danh sách trường của chức năng; không suy ra thứ tự từ thứ tự cột trong file cũ.

## Bảo toàn biểu mẫu và dữ liệu

- Giữ định dạng ô, trang tính hướng dẫn và cấu trúc cần thiết của biểu mẫu khi xuất.
- Chỉ ghi vào các cột đã ánh xạ; không xóa hoặc ghi đè cột tùy chỉnh không thuộc hợp đồng của chức năng.
- Khi thay nhãn cũ bằng nhãn chuẩn, giữ alias nhận diện cũ để các mẫu đã lưu vẫn dùng được.
- Giới hạn kích thước và số dòng trước khi đọc/ghi; báo lỗi theo dòng khi dữ liệu nhập không hợp lệ.

## Checklist khi thêm hoặc sửa biểu mẫu

- Đổi vị trí hai cột nhưng giữ marker: dữ liệu vẫn vào đúng trường.
- Thêm một cột cho trường đã có: marker/alias ánh xạ đúng và không phụ thuộc vị trí.
- Xuất rồi nhập lại enum và trường động: dữ liệu được chuẩn hóa về đúng giá trị nội bộ.
- Trường kế thừa không có override: file vẫn có giá trị đang hiển thị trên UI.
- Mẫu hệ thống có thứ tự nhóm chuẩn; mẫu người dùng tự tải lên giữ bố cục riêng.
- Nhãn xuất khớp UI, tên thuộc tính động dùng tên thực tế, không lộ mã nội bộ hoặc thuật ngữ kỹ thuật.
