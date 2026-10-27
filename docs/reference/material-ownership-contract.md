# Hợp đồng nghiệp vụ: đối tượng sở hữu vật tư

Ngày cập nhật: 27/10/2026. Phạm vi: EpsQRCode, một workspace, không tenant.

Đây là tài liệu nguồn cho cách chọn, lưu và báo cáo đối tượng sở hữu vật tư. Nội dung về owner trong các kế hoạch vật tư/bàn giao cũ phải theo tài liệu này nếu có khác biệt.

## 1. Phạm vi sở hữu

Vật tư có thể thuộc sở hữu EPS hoặc ngoài EPS. Chủ sở hữu trực tiếp là một trong bốn loại sau:

| Loại | Cách chọn | Dữ liệu danh mục |
| --- | --- | --- |
| Đơn vị EPS | Ba cấp chọn: đơn vị, tổ/nhóm trực thuộc, nhân viên thuộc đơn vị hoặc tổ/nhóm | Danh mục đơn vị, tổ/nhóm và nhân viên EPS |
| Đơn vị ngoài | Chọn một đơn vị ngoài | Danh mục đơn vị ngoài |
| Kho | Chọn một kho | Danh mục kho |
| Khác | Nhập thông tin đối tượng | Không bắt buộc có bản ghi danh mục |

Với EPS, đơn vị là cấp gốc bắt buộc. Có thể dừng ở đơn vị để ghi nhận đơn vị sở hữu trực tiếp, dừng ở tổ/nhóm để ghi nhận tổ/nhóm sở hữu trực tiếp, hoặc chọn nhân viên để ghi nhận cá nhân sở hữu trực tiếp. Tổ/nhóm phải thuộc đơn vị đã chọn; nhân viên phải thuộc đơn vị hoặc tổ/nhóm đã chọn theo dữ liệu danh mục. Nếu nhân viên chưa thuộc tổ/nhóm, vẫn chọn được nhân viên và đơn vị.

Nhân viên là bản ghi từ danh mục nhân viên EPS, không phải tài khoản đăng nhập. Nhân viên không cần có tài khoản EpsQRCode để được ghi nhận là chủ sở hữu hoặc người nhận bàn giao. Người dùng được phân quyền trong EpsQRCode thao tác và xác nhận thay mặt theo quyền/phạm vi được cấp; không tạo tài khoản QRCode giả cho nhân viên.

## 2. Snapshot và metadata danh mục

Mỗi lần ghi nhận chủ sở hữu lưu một snapshot của đối tượng tại thời điểm nghiệp vụ. Snapshot chứa loại đối tượng, mã/tên và các thông tin hiển thị liên quan; với EPS, lưu các cấp đơn vị, tổ/nhóm, nhân viên đã chọn cùng mã/tên hiển thị của từng cấp. Các loại khác lưu thông tin tương ứng như đơn vị ngoài/kho hoặc tên đối tượng tự nhập, đại diện, điện thoại và email khi có.

Khi chọn từ danh mục, giao diện điền sẵn thông tin. Mã chủ thể lấy từ danh mục và chỉ hiển thị, không cho sửa; tên, người đại diện và thông tin liên hệ vẫn được lưu thành snapshot có thể sửa mà không làm đổi bản ghi danh mục. Với loại Khác, người dùng có thể nhập mã cùng các thông tin snapshot khác. Backend không tạo bản ghi chủ thể, UUID hoặc mã giả cho thông tin này; `ownerPartyId`/ID bên giao-bên nhận để trống và chỉ snapshot được lưu. Lưu thêm metadata ID nguồn cho từng cấp đã chọn (EPS department/team/employee, đơn vị ngoài hoặc kho) để đối chiếu và báo cáo. Không suy ra metadata bằng cách so tên. Đối tượng tự nhập không có ID danh mục thì metadata ID để trống; nếu người dùng chọn một bản ghi danh mục thì giữ ID bản ghi đó dù nội dung snapshot đã được sửa. Với loại Khác, `scopePartyId` chỉ là phạm vi quyền quản lý/đường dẫn lưu ảnh; nó không phải metadata chủ sở hữu và không được tính vào cây EPS.

Snapshot của chủ sở hữu vật tư là dữ liệu nghiệp vụ, không phải bản sao toàn bộ hồ sơ nhân sự. Đổi tên hoặc đổi tổ chức trong danh mục không được âm thầm viết lại snapshot vật tư hay snapshot của phiếu bàn giao đã hoàn tất.

## 3. Tổng hợp báo cáo EPS

Báo cáo tính tài sản theo cấp trực tiếp và các cấp cha từ snapshot/metadata đã ghi nhận:

- Chủ sở hữu trực tiếp là nhân viên: vật tư xuất hiện ở báo cáo nhân viên, tổ/nhóm nếu có, và đơn vị.
- Chủ sở hữu trực tiếp là tổ/nhóm: vật tư xuất hiện ở báo cáo tổ/nhóm và đơn vị.
- Chủ sở hữu trực tiếp là đơn vị: vật tư xuất hiện ở báo cáo đơn vị.
- Đơn vị ngoài, kho và Khác không được cộng vào cây tổ chức EPS.

Một vật tư có thể xuất hiện trong nhiều cấp báo cáo cha nhưng chỉ được đếm một lần trong cùng một cấp thống kê. Báo cáo theo nhân viên dùng ID nhân viên danh mục, không dùng `auth.users` hoặc ID tài khoản QRCode. Lịch sử bàn giao giữ snapshot của mỗi lần giao nhận; thay đổi tổ chức hiện tại không sửa ngược các phiếu đã hoàn tất.

## 4. Tính nhất quán giữa các bề mặt

Form tạo vật tư và dialog chọn bên giao/bên nhận của phiếu bàn giao dùng chung contract lựa chọn, model snapshot và quy tắc metadata. Cả hai có cùng bốn loại, cùng nguồn danh mục, cùng quy tắc mã danh mục chỉ đọc và cùng khả năng nhập mã cho loại Khác. Không để mỗi trang có một biến thể riêng của loại EPS, đơn vị ngoài hoặc thông tin liên hệ.

Ở EPS, cả hai bề mặt phải cung cấp ba cấp chọn đơn vị → tổ/nhóm → nhân viên. Đổi cấp cha phải xóa lựa chọn cấp con không còn hợp lệ. Chọn đơn vị hoặc tổ/nhóm không yêu cầu chọn nhân viên.

Quy tắc vòng đời owner vẫn tách biệt với khả năng sửa snapshot: lúc tạo vật tư có thể sửa các trường snapshot đã điền từ danh mục, ngoại trừ mã chủ thể; khi sửa hồ sơ vật tư đã tồn tại, card sở hữu chỉ đọc. Thay đổi chủ sở hữu hiện tại đi qua phiếu bàn giao; khi phiếu hoàn tất, owner hiện tại nhận snapshot và metadata của bên nhận. Snapshot của phiếu đã hoàn tất không bị đổi khi thông tin danh mục hoặc owner hiện tại thay đổi.

Quyền tạo, gửi và xác nhận phiếu là quyền của tài khoản thao tác theo vai trò/phạm vi. Không bắt buộc người nhận là nhân viên EPS phải có tài khoản. Trường người đại diện hiển thị trên snapshot không được dùng để suy diễn rằng người đó có quyền đăng nhập hoặc quyền hệ thống.

## 5. Yêu cầu dữ liệu và triển khai

- API/form phải truyền snapshot owner và metadata ID danh mục; chỉ lưu một UUID `ownerPartyId` không đủ để đáp ứng contract. Đối tượng tự nhập lưu `ownerPartyId = null`; người mượn tự nhập lưu `borrowerPartyId = null`; bên giao/bên nhận tự nhập lưu party ID tương ứng bằng `null`. `scopePartyId` chỉ phục vụ quyền thao tác.
- Lưu snapshot, metadata nguồn, lịch sử thay đổi owner và cập nhật owner sau khi hoàn tất bàn giao trong cùng giao dịch nghiệp vụ.
- Các truy vấn, bộ lọc và báo cáo phải hỗ trợ tổng hợp EPS theo ID nguồn đơn vị/tổ/nhân viên trong snapshot. Cần giữ ổn định số liệu lịch sử khi danh mục đổi.
- Nguồn danh sách nhân viên phải là danh mục nhân viên EPS và không lọc bỏ nhân viên vì thiếu liên kết tài khoản QRCode. API chỉ dành cho màn hình quản lý/tạo tài khoản không mặc nhiên là API phù hợp cho selector sở hữu.
- Quyền của tài khoản thao tác phải được kiểm tra riêng ở backend. Người có quyền phù hợp phải chọn và xác nhận thay mặt nhân viên được quản lý; không bắt buộc nhân viên đó phải có tài khoản QRCode hoặc `canRepresent` gắn trực tiếp với tài khoản nhân viên.
- Kiểm tra nghiệm thu tối thiểu: bốn loại đối tượng ở cả hai bề mặt; chọn đủ ba cấp EPS; nhân viên không có tài khoản; sửa snapshot vẫn giữ metadata ID; nhập đối tượng mới không có ID; roll-up nhân viên → tổ/nhóm → đơn vị; hoàn tất bàn giao cập nhật owner hiện tại nhưng giữ nguyên snapshot lịch sử.

## 6. Trạng thái hiện tại

Mã nguồn triển khai contract qua các phần sau:

- Form tạo vật tư và dialog bên giao/bên nhận có bốn loại đối tượng. EPS có selector đơn vị → tổ/nhóm → nhân viên; nhân viên được tìm trong danh mục EPS độc lập với tài khoản QRCode.
- Mã chủ thể được điền từ danh mục và chỉ hiển thị; tên, người đại diện và liên hệ vẫn là snapshot có thể sửa. Loại Khác cho phép nhập mã nhưng không tạo bản ghi hay UUID chủ thể; party ID để trống và chỉ snapshot được lưu. ID nguồn danh mục được giữ để đối chiếu. Card sở hữu trên form sửa vật tư là chỉ đọc; chuyển chủ sở hữu hiện tại thực hiện qua phiếu bàn giao.
- Migration `20261026170000_material_owner_party_snapshots.sql` bổ sung snapshot vật tư, backfill dữ liệu cũ, cập nhật snapshot khi hoàn tất bàn giao và cho phép lọc vật tư theo ID đơn vị/tổ/nhân viên cha trong snapshot.
- Migration `20261027110000_manual_other_party_snapshots.sql` chuyển chủ sở hữu, người mượn và bên giao/nhận tự nhập sang snapshot-only; mọi party ID của loại Khác để `null`. Migration giữ ID catalog trong `scopePartyId` chỉ để kiểm tra quyền và chuẩn hóa các dữ liệu ID tự sinh cũ ra khỏi bản ghi nghiệp vụ. Migration đã được áp dụng vào Supabase dev project `uopmkpcorjhsppdowmab`; đã xác nhận version lịch sử, schema snapshot, các party ID liên quan để trống và function chọn đối tượng trả về cấu trúc mới.
- Các kế hoạch cũ dẫn về contract này; phần owner mâu thuẫn không còn là nguồn nghiệp vụ độc lập.

Migration `20261026170000_material_owner_party_snapshots.sql` đã được áp dụng lên Supabase dev và schema/backfill/RPC đã được kiểm tra. RPC `list_materials` hỗ trợ lọc theo ID chủ thể nội bộ qua `ownerPartyId` và ID nguồn danh mục qua `ownerCatalogId`; với cả hai kiểu, điều kiện snapshot bao gồm các cấp cha EPS và mỗi vật tư chỉ xuất hiện một lần trong kết quả. Trang Báo cáo hiện vẫn là placeholder; chưa có báo cáo vật tư để kiểm tra trực quan số liệu roll-up.
