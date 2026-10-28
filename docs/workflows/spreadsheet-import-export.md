# Quy ước nhập và xuất Excel

Tài liệu này áp dụng chung cho các chức năng nhập và xuất Excel trong EpsQRCode.

## Phân chia trách nhiệm

- Frontend đọc workbook, nhận diện trang tính và dòng tiêu đề, ánh xạ cột, chuẩn hóa dữ liệu, kiểm tra lỗi, xem trước kết quả nhập và tạo file xuất.
- Backend nhận DTO đã chuẩn hóa và cung cấp API tạo hàng loạt khi cần. Không chuyển quy tắc ánh xạ theo cột Excel vào backend.
- Mẫu Excel hệ thống có thể được cập nhật mà không đổi mã ánh xạ, miễn là giữ khóa trường trong marker.

## Nhận diện trường và ánh xạ

- Dùng marker ổn định theo trường, ví dụ `__eps_field__:material.code`, để nhận diện ý nghĩa cột. Marker là hợp đồng máy đọc; nhãn hiển thị có thể đổi hoặc dịch.
- Tất cả marker của cùng một danh sách trên một trang tính phải nằm trên cùng một hàng. Kiểm tra điều kiện này khi đọc hoặc thay mẫu; không nhận mẫu có marker rải ở nhiều hàng.
- Không gắn ý nghĩa nghiệp vụ với chữ cột, số thứ tự cột hoặc địa chỉ ô cố định. Người dùng có thể đặt marker ở bất kỳ hàng nào sau phần nội dung tĩnh và để trống khoảng cách giữa các cột. Cột của từng marker xác định cột dữ liệu tương ứng.
- Dòng tiêu đề chỉ phục vụ trình bày, không tham gia ánh xạ khi mẫu có marker. Giữ nguyên nhãn do người dùng nhập.
- Dữ liệu được ghi từ hàng ngay sau hàng marker. Với xuất vật tư có marker ở hàng 2, hàng 3 được để trống và ẩn để dữ liệu bắt đầu ở hàng 4. Hàng marker được giữ trong tệp xuất nhưng ẩn đi để bảo toàn ánh xạ cho lần nhập lại.
- Khi xuất, lấy style của từng ô marker và áp dụng xuống các ô cùng cột cho từng bản ghi. Nội dung tĩnh phía trên hàng dữ liệu và ở các cột không được đánh dấu được giữ nguyên.
- Không thêm hàng mẫu dữ liệu riêng: style của ô marker là mẫu cho dữ liệu, nên workbook mặc định chỉ cần hàng tiêu đề và hàng marker.
- Xuất vật tư gom các thông số đang có giá trị vào một cột `Thông số kỹ thuật`, mỗi dòng theo dạng `Tên thông số: Giá trị`; thông số không được chọn thì không xuất. Marker của cột này là `material.specifications`.
- Biểu mẫu nhập cũ có thể tiếp tục dùng marker slot như `material.specification.slot.1`; ứng dụng ánh xạ slot đó tới thông số tương ứng của danh mục hiện tại.
- Mẫu mặc định vật tư dùng Times New Roman cỡ 14, có viền rõ ở tiêu đề, hàng marker và các ô dữ liệu.
- Với mẫu không có marker, ánh xạ theo nhãn cột hiện tại và các alias đã biết. Giữ luồng xem trước/xác nhận khi ánh xạ không chắc chắn.
- Có thể thêm nhiều cột cho các trường khác nhau của cùng đối tượng; mỗi cột cần một khóa trường riêng. Không tách thông số vật tư thành cột đánh số khi xuất vì mỗi vật tư có thể có tập thông số khác nhau.
- Giữ nguyên vị trí marker, kể cả với mẫu hệ thống. Thứ tự trường trong danh sách trường dùng để tạo mẫu mặc định, không được dùng để dồn hoặc sắp xếp lại cột trong mẫu đã chọn.

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
- Chỉ ghi từ hàng sau marker trở xuống trong các cột đã ánh xạ; vùng này dành cho dữ liệu kết xuất. Không xóa hoặc ghi đè nội dung tĩnh ở các cột không được ánh xạ.
- Ẩn hàng marker trong file xuất nhưng giữ nguyên giá trị marker để nhận diện trường khi nhập lại.
- Khi thay nhãn cũ bằng nhãn chuẩn, giữ alias nhận diện cũ để các mẫu đã lưu vẫn dùng được.
- Giới hạn kích thước và số dòng trước khi đọc/ghi; báo lỗi theo dòng khi dữ liệu nhập không hợp lệ.

## Checklist khi thêm hoặc sửa biểu mẫu

- Đổi vị trí hai cột nhưng giữ marker: dữ liệu vẫn vào đúng trường.
- Đặt marker cách nhau nhiều cột trên cùng một hàng: dữ liệu giữ nguyên vị trí và khoảng trống.
- Đặt marker ở hàng khác nhau: mẫu bị từ chối trước khi thay thế mẫu đang dùng.
- Đặt marker ở hàng tùy chọn: dữ liệu bắt đầu ở hàng kế tiếp, mỗi cột kế thừa style từ ô marker của nó.
- Xuất rồi nhập lại: hàng marker được ẩn nhưng vẫn giữ ánh xạ.
- Thêm một cột cho trường đã có: marker/alias ánh xạ đúng và không phụ thuộc vị trí.
- Xuất rồi nhập lại enum và trường động: dữ liệu được chuẩn hóa về đúng giá trị nội bộ.
- Xuất rồi nhập lại cột thông số gộp: nhãn và giá trị được ghép về đúng thông số của mẫu vật tư.
- Trường kế thừa không có override: file vẫn có giá trị đang hiển thị trên UI.
- Mẫu mặc định có thứ tự nhóm chuẩn; cả mẫu hệ thống và mẫu tải lên đều giữ vị trí marker đã cấu hình.
- Nhãn xuất khớp UI, tên thuộc tính động dùng tên thực tế, không lộ mã nội bộ hoặc thuật ngữ kỹ thuật.
