# Kế hoạch chức năng phiếu nhập vật tư

Ngày: 21/10/2026. Trạng thái: đã triển khai theo hướng thiết kế và các quyết định được duyệt; import Excel để ở giai đoạn sau.

## 1. Phạm vi và nguyên tắc đã chốt

- Phiếu nhập ghi nhận danh sách vật tư vào phần mềm, sở hữu ban đầu thuộc kho.
- Một phiếu nhập liên kết nhiều phiếu bàn giao cho các đơn vị/đối tượng nhận.
- Quản lý kho chủ động phân bổ; đơn vị có quyền được đăng ký nhận, cần kho duyệt.
- Mỗi vật tư có định danh và QR riêng. Nhập theo mẫu với số lượng N tạo N vật tư. UI có thể gom theo mẫu nhưng chứng từ nền tảng xử lý từng vật tư.
- Cho phép khai báo mẫu chưa tồn tại. Import Excel làm sau, thiết kế dữ liệu phải hỗ trợ dòng mẫu + số lượng.
- Tiếp tục dùng mô hình single-workspace, không thêm tenant. Domain/API độc lập với provider Supabase tạm thời.

## 2. Kho

- Thêm module quản lý kho đơn giản: mã kho, tên kho, địa chỉ.
- Phiếu nhập chọn kho; vật tư được tạo có chủ sở hữu ban đầu là kho đó.
- Cần kết nối kho với cơ chế chủ thể sở hữu/đại diện hiện có để dùng chung bàn giao, không nhận diện kho bằng tên.
- Kho là một loại chủ thể `warehouse`; tài khoản phụ trách được gán nhiều-nhiều qua `material_warehouse_accounts` để dùng chung định danh chủ sở hữu và luồng bàn giao.

## 3. Trạng thái phiếu nhập

| Trạng thái | Hành vi |
| --- | --- |
| Nháp | Chỉnh thông tin và danh sách nhập; chưa tạo vật tư thật |
| Bàn giao | Xác nhận nháp tạo vật tư thật; khóa chỉnh trực tiếp danh sách nhập; được tạo phiếu bàn giao |
| Đã hoàn tất | Đóng thao tác bàn giao từ phiếu nhập; không yêu cầu phân bổ 100% |

- Nếu còn phiếu bàn giao liên kết ở trạng thái nháp/chờ xử lý: hiển thị cảnh báo và không cho hoàn tất phiếu nhập. Backend phải kiểm tra lại trong giao dịch đóng phiếu, tránh phát sinh phiếu mới đồng thời.
- Vật tư chưa phân bổ khi hoàn tất vẫn tồn tại, thuộc kho và có thể tạo phiếu bàn giao riêng ngoài phiếu nhập.
- Chỉ hủy toàn bộ khi phiếu còn Nháp. Phiếu đã xác nhận không hủy toàn bộ; dùng hiệu chỉnh theo phần thay đổi và mở lại từ Đã hoàn tất về Bàn giao theo mục 9 đã duyệt. Không lùi về Nháp sau khi đã tạo vật tư thật.
- Xác nhận nhập phải nguyên tử: tạo mẫu cần thiết, tạo vật tư, lưu liên kết nguồn nhập và chuyển trạng thái cùng thành công hoặc cùng rollback. Chống xác nhận lặp tạo trùng.

## 4. Mẫu vật tư và mã liên kết ngoài

- Thêm trường “Các mã liên kết ngoài” trực tiếp vào model mẫu vật tư, dạng danh sách text; UI hiển thị các mã như `ABCXYZ`, `123`.
- Không phân biệt phần mềm nguồn, không xây module quản lý nguồn mã.
- Khi nhập: mã đã liên kết xác định mẫu; mã chưa có cho chọn mẫu có sẵn hoặc khai báo mẫu mới. Không tự ghép theo tên.
- Giữ mã dạng text để bảo toàn số 0 đầu. Một mã chỉ trỏ tới một mẫu; khi so khớp sẽ trim và không phân biệt hoa/thường, còn cách viết đã nhập được giữ để hiển thị.
- Các dòng cùng mẫu mới trong một lần nhập phải tái sử dụng một mẫu, tránh tạo trùng.

## 5. Bàn giao từ kho

- Thêm mode “Nhận vật tư từ kho”, dùng chung nền tảng phiếu bàn giao.
- Bên giao cố định là kho, UI không cho sửa và backend xác thực.
- Có trường liên kết phiếu nhập khi áp dụng. Mở từ phiếu nhập thì điền và khóa liên kết này.
- Phiếu có liên kết chỉ chọn vật tư của phiếu nhập đó, đang đủ điều kiện tại kho và chưa được giữ chỗ/phân bổ cho phiếu khác.
- Phiếu riêng không liên kết chọn vật tư đủ điều kiện thuộc kho.
- Kho phân bổ: kho lập phiếu → gửi → đơn vị xác nhận nhận.
- Đơn vị đăng ký: đơn vị chọn vật tư → gửi yêu cầu → kho duyệt hoặc từ chối → đơn vị xác nhận nhận một phần. Đơn vị chỉ sửa/hủy khi yêu cầu còn Nháp; sau khi kho duyệt, kho có thể hủy trước khi đơn vị xác nhận.
- Từ danh sách bàn giao có lối vào độc lập để kho phân bổ hoặc đơn vị đăng ký nhận, không cần liên kết phiếu nhập.
- Người đăng ký chỉ thao tác cho đơn vị mình được đại diện và có quyền tương ứng; không được tự chọn đơn vị tùy ý.
- Nhập tình trạng từng vật tư giống bàn giao. Lưu tình trạng lúc nhập độc lập với tình trạng hiện tại.
- Hỗ trợ nhận một phần: 5 vật tư trên phiếu có thể chỉ nhận 4; lưu kết quả theo từng vật tư, chỉ chuyển sở hữu các vật tư thực nhận; phần không nhận giải phóng giữ chỗ.

## 6. Chống trùng và tiến độ

- Tái sử dụng cơ chế reservation hiện có, kiểm tra tại backend lúc lưu/gửi/duyệt/xác nhận; khóa đồng thời để chỉ một phiếu giữ chỗ một vật tư.
- Bỏ dòng, hủy hoặc từ chối phải giải phóng reservation theo kết quả từng vật tư.
- Tiến độ = số vật tư riêng biệt thực nhận trong phiếu bàn giao đã hoàn tất / tổng vật tư nhập.
- Không tính phiếu nháp, chờ, hủy, từ chối hoặc vật tư không nhận. Không đếm trùng qua nhiều chứng từ.
- Ví dụ: nhập 10; phiếu hoàn tất gồm 5 nhưng thực nhận 4 → 40%.
- Tiến độ tính mỗi vật tư tối đa một lần theo kết quả `received` của phiếu bàn giao liên kết đã hoàn tất. Số liệu là lịch sử của phiếu nhập và không giảm sau thu hồi hoặc bàn giao lại.

## 7. Giao diện

### Quản lý phiếu nhập

- DataGrid theo pattern danh sách bàn giao: mã phiếu, ngày tạo, số lượng vật tư, trạng thái bàn giao (%), action xem.
- Đề xuất thêm badge trạng thái phiếu nhập để phân biệt Nháp/Bàn giao/Đã hoàn tất.
- Toolbar tạo mới, tìm kiếm và bộ lọc phù hợp; mặc định ngày tạo giảm dần, ID ổn định.

### Chi tiết phiếu nhập

- Toolbar có quay lại, mã phiếu sau tải, hành động theo trạng thái/quyền.
- Hai tab: “Chi tiết phiếu”, “Bàn giao vật tư”.
- Tab chi tiết: hai card thông tin phía trên theo bố cục bàn giao hiện có; phía dưới là card bảng vật tư đã nhập.
- Bảng thể hiện vật tư/mẫu, sê-ri, tình trạng lúc nhập, ghi chú và thông tin phân bổ phù hợp.
- Tab bàn giao dùng component bảng bàn giao chung, lọc theo phiếu nhập; có tạo phiếu/đăng ký nhận theo quyền.
- Tách bảng từ HandoversPage hiện tại nếu chưa có component dùng chung; không nhân bản trang nguyên khối.
- Idle/loading/error cho từng phần; giữ toolbar và tiêu đề tĩnh. ErrorState tại vùng lỗi, tab bàn giao lỗi không che chi tiết phiếu.
- Dùng builder registry khi triển khai, shared selectors và form ngang; copy mới có đủ vi/en.

## 8. Các phần dữ liệu và triển khai dự kiến

1. Chốt các quyết định mục 9 cùng hợp đồng trạng thái/quyền (đã hoàn tất).
2. Module kho và liên kết chủ thể sở hữu/đại diện.
3. Mã liên kết ngoài trong mẫu, validation và lookup.
4. Phiếu nhập + dòng nhập + liên kết tới vật tư thật + lịch sử thay đổi.
5. API xác nhận nhập, hoàn tất, hiệu chỉnh/hủy/mở lại theo quy tắc được duyệt.
6. Mode nhận từ kho, liên kết phiếu nhập, luồng đơn vị đề nghị/kho duyệt, nhận một phần.
7. Component bảng bàn giao chung; trang danh sách, editor và chi tiết phiếu nhập.
8. Kiểm tra trọng tâm: giao dịch nguyên tử, chống trùng khi đồng thời, phân quyền, nhận một phần, chặn đóng khi còn phiếu mở, bảo toàn phiếu không bị ảnh hưởng khi hiệu chỉnh.
9. Import Excel ở giai đoạn sau.

Đây là thứ tự dự kiến, không phải quyết định schema/API đã chốt. Không thay đổi code hoặc database trong giai đoạn lập plan.

## 9. Hiệu chỉnh theo phần thay đổi — đã duyệt ngày 21/10/2026

Thay vì hủy toàn bộ phiếu bàn giao và tạo lại toàn bộ vật tư, dùng thao tác “Hiệu chỉnh danh sách vật tư nhập vào” theo phần thay đổi, giữ ID vật tư và chứng từ không bị ảnh hưởng.

| Loại thay đổi | Quy tắc |
| --- | --- |
| Thêm vật tư | Tạo vật tư bổ sung thuộc kho; giữ nguyên toàn bộ phiếu bàn giao hiện có; cập nhật mẫu số tiến độ |
| Bớt vật tư chưa có phiếu bàn giao và chưa có giao dịch khác | Cho phép loại khỏi danh sách nhập sau xác nhận, đánh dấu vật tư vô hiệu, lưu lý do và lịch sử; không xóa bản ghi |
| Bớt/thay mẫu vật tư đang được giữ trong phiếu nháp/chờ | Liệt kê đúng phiếu bị ảnh hưởng; chỉ hủy các phiếu đó sau xác nhận rõ ràng, không tự sửa chứng từ |
| Bớt/thay mẫu vật tư đã thực nhận | Không xóa hoặc viết lại lịch sử; cần thu hồi/điều chỉnh nghiệp vụ trước |
| Sửa dữ liệu mô tả | Phân biệt lỗi nhập liệu với dữ liệu lịch sử/chủ sở hữu/tình trạng; không cập nhật ngược snapshot chứng từ đã hoàn tất |

- Dialog preview nêu số vật tư thêm/bớt, phiếu bị ảnh hưởng, phiếu được giữ nguyên và trường hợp bị chặn trước khi xác nhận.
- Preview cần version; lúc áp dụng kiểm tra lại toàn bộ điều kiện trong giao dịch, nếu có thay đổi đồng thời thì yêu cầu tải lại.
- Ghi lịch sử hiệu chỉnh gồm người, thời gian, lý do, trước/sau; không âm thầm xóa chứng từ đã hoàn tất.
- Hiệu chỉnh ở trạng thái Bàn giao, không lùi về Nháp sau khi đã tạo vật tư thật. Phiếu đã hoàn tất cần “Mở lại bàn giao” trước; thao tác này giữ nguyên phiếu cũ.
- Người dùng đã duyệt phương án này; thay thế đề xuất cũ “hiệu chỉnh hủy tất cả phiếu bàn giao”.
- Ví dụ: nhập 100, đã bàn giao thực nhận 60, bổ sung 20 → tổng 120, giữ nguyên các phiếu cũ và 60 vật tư đã bàn giao, tiến độ trở thành 50%.

## 10. Căn cứ code đã khảo sát

- `src/project/handover/pages/handovers-page.tsx`: bảng quản lý và các trạng thái tải/lỗi.
- `src/project/handover/pages/handover-detail-page.tsx`: thông tin, tình trạng giao/nhận và action.
- `src/project/handover/model/handover.ts`: loại phiếu, trạng thái và danh sách vật tư.
- `src/project/materials/model/material.ts`: vật tư riêng, chủ sở hữu, reservation và snapshot mẫu.
- `src/project/material-models/model/material-model.ts`: model mẫu hiện tại.
- `supabase/migrations/20261020041315_handover_item_shared_note.sql`: giữ chỗ khi lưu nháp, kiểm tra đại diện và chuyển sở hữu khi xác nhận.
- web-template: tab lịch sử bàn giao vật tư đang là placeholder; không coi đó là hợp đồng nghiệp vụ hoàn chỉnh.
