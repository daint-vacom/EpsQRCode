# Kế hoạch đồng bộ chủ thể EPS, quản lý tài khoản và phạm vi phân quyền

Ngày: 22/10/2026.

Trạng thái: đã triển khai mã nguồn, áp dụng migration lên Supabase dev và triển khai Edge Function quản lý tài khoản. Chưa nghiệm thu toàn bộ luồng bằng tài khoản thuộc từng scope.

## 1. Mục tiêu và phạm vi

- Chuẩn hóa chủ thể bàn giao theo tổ chức EPS và các đối tượng bổ sung của QRCode.
- Thay trang quản lý nhân viên bằng trang quản lý tài khoản và trang quản lý đơn vị ngoài.
- Phân biệt tài khoản EPS và tài khoản bên ngoài; chỉ tài khoản được cấp phép trong QRCode mới được sử dụng ứng dụng.
- Đặt phạm vi dữ liệu trên từng quyền, không đặt trên vai trò hay nhóm quyền.
- Tính phạm vi từ tổ chức hiện tại của tài khoản và danh sách kho được phân công.
- Giới hạn dữ liệu tại backend cho danh sách, chi tiết, lịch sử, thống kê, xuất dữ liệu và tệp liên quan.
- Giữ single-workspace, không thêm tenant. Domain và API không phụ thuộc provider lưu trữ tạm thời.

Kế hoạch này kế thừa nghiệp vụ bàn giao và phiếu nhập đã có trong [kế hoạch bàn giao](./2026-10-19-materials-and-handovers.md) và [kế hoạch phiếu nhập](./2026-10-21-material-receipts.md). Không thay đổi trạng thái hay quy trình chứng từ ngoài các thay đổi cần thiết để áp dụng quyền.

## 2. Nguồn dữ liệu và ranh giới sở hữu

| Dữ liệu                                   | Nguồn chuẩn | Quyền của QRCode  |
| ----------------------------------------- | ----------- | ----------------- |
| Đơn vị EPS                                | EPS         | Đọc và tham chiếu |
| Tổ/nhóm EPS                               | EPS         | Đọc và tham chiếu |
| Nhân viên EPS, thông tin tổ chức hiện tại | EPS         | Đọc và tham chiếu |
| Tài khoản được phép sử dụng QRCode        | QRCode      | Quản lý           |
| Hồ sơ tài khoản bên ngoài                 | QRCode      | Quản lý           |
| Đơn vị ngoài                              | QRCode      | Quản lý           |
| Kho và tài khoản phụ trách kho            | QRCode      | Quản lý           |
| Vai trò, quyền, phạm vi từng quyền        | QRCode      | Quản lý           |

- PLEpsClient là tài liệu tham khảo model và hành vi EPS, không phải backend của QRCode. Không sửa repository đó trong phạm vi kế hoạch.
- web-template là nguồn tham khảo bảng, form, quản lý vai trò và tài khoản. Không sao chép mô hình tenant hoặc phạm vi ở cấp vai trò.
- Không dùng tài khoản, dữ liệu nhân viên hay tổ chức EPS thật làm dữ liệu kiểm thử. Giai đoạn phát triển dùng fixture/provider giả lập theo contract; tích hợp thật là bước riêng.
- Supabase hiện là persistence phát triển, không mặc nhiên là kiến trúc production hoặc cơ chế đăng nhập EPS cuối cùng.

## 3. Chủ thể bàn giao

Giữ một định danh chủ thể chung để vật tư và phiếu tham chiếu. Hỗ trợ đủ năm loại:

| Loại         | Ý nghĩa       | Quan hệ                                    |
| ------------ | ------------- | ------------------------------------------ |
| `department` | Đơn vị EPS    | Có nhiều tổ/nhóm và nhân viên              |
| `team`       | Tổ/nhóm EPS   | Thuộc một đơn vị EPS                       |
| `person`     | Nhân viên EPS | Thuộc một đơn vị, có thể thuộc một tổ/nhóm |
| `warehouse`  | Kho QRCode    | Có nhiều tài khoản phụ trách               |
| `external`   | Đơn vị ngoài  | Có nhiều tài khoản bên ngoài               |

### Định danh và liên kết

- Chủ thể EPS liên kết bằng loại đối tượng và ID EPS; không ghép bằng tên hoặc mã hiển thị.
- Chủ thể kho và đơn vị ngoài dùng ID do QRCode quản lý; mỗi bản ghi nghiệp vụ có đúng một chủ thể tương ứng.
- Tái sử dụng `material_custodians` và `material_warehouses` khi phù hợp; bổ sung liên kết nguồn thay vì tạo hệ thống chủ thể thứ hai.
- Thông tin tổ chức hiện tại của nhân viên EPS đến từ backend EPS. Nhân viên chưa phân tổ vẫn xác định được đơn vị.
- Một nhân viên EPS có thể là chủ thể nhận vật tư dù không có tài khoản QRCode. Không ràng buộc tồn tại chủ thể với tồn tại tài khoản đăng nhập.
- Ngừng hoạt động chủ thể không xóa lịch sử và không làm mất tham chiếu chứng từ.

### Snapshot lịch sử

- Phiếu lưu mã, tên và quan hệ tổ chức cần thiết tại thời điểm phát sinh.
- EPS đổi tên, chuyển nhân viên sang tổ hoặc đơn vị khác không viết lại snapshot của chứng từ cũ.
- Snapshot dùng cho nội dung lịch sử; không dùng thay tổ chức hiện tại của tài khoản để tính quyền.
- Không lưu bản sao toàn bộ hồ sơ nhân sự EPS chỉ để phục vụ chủ thể bàn giao.

## 4. Tài khoản QRCode

### Dữ liệu lưu

Tên trường dưới đây là contract mục tiêu; tên cột vật lý được đối chiếu schema hiện tại khi viết migration.

| Trường                   | EPS                            | Bên ngoài                 |
| ------------------------ | ------------------------------ | ------------------------- |
| `id`                     | ID tài khoản QRCode            | ID tài khoản QRCode       |
| `accountType`            | `eps`                          | `external`                |
| `epsEmployeeId`          | Bắt buộc                       | `null`                    |
| `externalOrganizationId` | `null`                         | Bắt buộc                  |
| Hồ sơ bên ngoài          | Không là nguồn chuẩn hồ sơ EPS | Lưu tại QRCode            |
| Trạng thái sử dụng       | Bắt buộc                       | Bắt buộc                  |
| Vai trò                  | Quan hệ tài khoản–vai trò      | Quan hệ tài khoản–vai trò |
| `warehouseIds`           | Danh sách, có thể rỗng         | Danh sách, có thể rỗng    |

**Không lưu ID đơn vị EPS hoặc ID tổ/nhóm EPS trên tài khoản QRCode.** Backend trả thông tin mới nhất qua liên kết nhân viên EPS, bao gồm shape nhân viên và tổ chức cần cho màn hình.

### Ràng buộc

- Loại EPS chỉ có liên kết nhân viên EPS; loại bên ngoài chỉ có liên kết đơn vị ngoài.
- Một nhân viên EPS chỉ liên kết một tài khoản QRCode trong thiết kế hiện tại; kiểm tra tính duy nhất ở backend/database.
- ID nhân viên EPS và ID người dùng EPS không thay thế ID tài khoản xác thực QRCode.
- Trong provider Supabase hiện tại, quan hệ hồ sơ, vai trò và kho tiếp tục dùng Auth UUID. Cơ chế xác thực EPS tương lai phải ánh xạ danh tính được backend xác minh, không nhận ID tự khai từ trình duyệt làm bằng chứng đăng nhập.
- Đăng nhập EPS thành công chưa đủ để sử dụng QRCode: tài khoản QRCode phải tồn tại, còn hoạt động và được cấp quyền tương ứng.
- Không tự kế thừa vai trò hoặc quyền quản trị của EPS Training.
- API không cho client tự truyền đơn vị/tổ để mở rộng phạm vi.
- Nếu không lấy được tổ chức EPS, thao tác phụ thuộc phạm vi đó phải trả lỗi phù hợp; không dùng dữ liệu cũ để tự mở rộng quyền.
- Cache tổ chức nếu có phải có cơ chế làm mới/thu hồi rõ ràng trong contract tích hợp; không lưu tổ chức như trường hồ sơ tài khoản QRCode.

### Shape đọc mục tiêu

```ts
type AccountType = 'eps' | 'external';

interface AccountDetail {
  id: string;
  accountType: AccountType;
  epsEmployeeId: string | null;
  externalOrganizationId: string | null;
  epsEmployee: EpsEmployeeDetail | null;
  epsDepartment: EpsDepartmentSummary | null;
  epsTeam: EpsTeamSummary | null;
  externalOrganization: ExternalOrganizationSummary | null;
  warehouseIds: string[];
  warehouses: WarehouseSummary[];
  roles: RoleSummary[];
  status: AccountStatus;
}
```

Các kiểu chi tiết phải được chốt từ contract backend. Không coi đoạn minh họa là khai báo đã tồn tại trong source.

## 5. Danh sách kho trên tài khoản

- API tài khoản nhận/trả `warehouseIds`.
- Database lưu quan hệ nhiều–nhiều; tái sử dụng `material_warehouse_accounts`, không thêm mảng ID song song làm nguồn chuẩn thứ hai.
- Cập nhật danh sách kho từ màn hình tài khoản hoặc màn hình kho phải phản ánh cùng một quan hệ.
- Backend kiểm tra quyền gán kho, kho tồn tại và trạng thái hợp lệ; chặn tự gán thêm kho qua request.
- Phân công kho xác định đối tượng được phụ trách; quyền nghiệp vụ xác định hành động được phép thực hiện.
- Có trong danh sách kho không tự cấp mọi quyền vật tư, phiếu hay quản trị kho.
- Thu hồi kho phải có hiệu lực cho truy cập và thao tác tiếp theo; không xóa chứng từ cũ.

## 6. Quyền và phạm vi

### Phạm vi từng quyền

| Giá trị contract      | Nhãn               | Phạm vi                                                                                      |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| `none`                | Không              | Không cấp quyền                                                                              |
| `team`                | Tổ/nhóm            | Tổ/nhóm EPS hiện tại của tài khoản và nhân viên trực thuộc                                   |
| `department`          | Đơn vị             | Đơn vị EPS hiện tại cùng tổ/nhóm, nhân viên trực thuộc; hoặc đúng đơn vị ngoài của tài khoản |
| `assigned_warehouses` | Kho được phân công | Những kho trong danh sách phân công tài khoản                                                |
| `all`                 | Toàn EPS           | Toàn bộ chủ thể/dữ liệu EPS; không tự bao gồm kho QRCode hoặc đơn vị ngoài                   |

- Select nằm tại từng dòng quyền trong vai trò. Nhóm quyền chỉ tổ chức giao diện.
- Mỗi permission definition khai báo quyền có phạm vi hay chỉ bật/tắt, cùng danh sách phạm vi hợp lệ.
- Những quyền cấu hình toàn cục không có ý nghĩa phân cấp tiếp tục bật/tắt.
- Quyền có phạm vi lưu ở quan hệ `role_permissions`; bỏ phụ thuộc vào `roles.scope` và `effectiveScope` toàn cục.
- Có thể lưu `none` bằng việc không có grant trong database, nhưng contract/UI luôn diễn đạt rõ Không.
- Tài khoản EPS chưa có tổ: grant `team` không cho dữ liệu, không nâng lên `department`.
- Tài khoản ngoài không áp dụng `team`; grant không tương thích không được tạo thêm quyền.
- `assigned_warehouses` chỉ xuất hiện cho các quyền có dữ liệu liên quan kho.

### Hợp quyền nhiều vai trò

- Tính độc lập theo permission code.
- Với cùng quyền, hợp các tập dữ liệu được cấp từ các vai trò còn hoạt động.
- `none` là không cấp, không phải deny phủ định grant từ vai trò khác.
- Không dùng một thứ tự số để chọn scope lớn nhất: phạm vi kho và phạm vi tổ chức có thể độc lập.
- Quyền xem toàn cục không làm quyền quản lý cấp tổ trở thành toàn cục.
- Không ngầm mở rộng quyền xem từ quyền quản lý; nếu nghiệp vụ cần cả hai, role editor phải yêu cầu/cấp quyền phụ thuộc một cách minh bạch.
- Chỉ tài khoản có quyền quản trị tương ứng được sửa vai trò, cấp quyền và phân công kho; backend kiểm tra lại mọi thay đổi.

### Ví dụ vai trò

| Vai trò        | Quyền              | Phạm vi            |
| -------------- | ------------------ | ------------------ |
| Quản lý đơn vị | Xem vật tư         | Đơn vị             |
| Quản lý đơn vị | Quản lý vật tư     | Tổ/nhóm            |
| Quản lý đơn vị | Xem phiếu bàn giao | Đơn vị             |
| Thủ kho        | Xem vật tư         | Kho được phân công |
| Thủ kho        | Quản lý phiếu nhập | Kho được phân công |
| Đơn vị ngoài   | Xem vật tư         | Đơn vị             |
| Đơn vị ngoài   | Xem phiếu bàn giao | Đơn vị             |

Đây là ví dụ kiểm chứng mô hình, không tự seed các vai trò hoặc tự cấp quyền trên môi trường đang chạy.

## 7. Áp dụng phạm vi theo nghiệp vụ

| Tài nguyên                            | Căn cứ kiểm tra                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Vật tư                                | Chủ thể quản lý/sở hữu hiện tại và bên đang mượn theo contract nghiệp vụ           |
| Phiếu bàn giao                        | Bên giao hoặc bên nhận nằm trong phạm vi được cấp cho quyền xem                    |
| Phiếu nhập                            | Kho nhận của phiếu                                                                 |
| Kho                                   | Danh sách kho được phân công hoặc phạm vi toàn cục hợp lệ                          |
| Đơn vị ngoài                          | Đúng đơn vị ngoài của tài khoản cho quyền có scope Đơn vị                          |
| Lịch sử bàn giao                      | Từng giao dịch và các bên liên quan tại thời điểm phát sinh                        |
| Báo cáo, export, tổng số              | Cùng bộ điều kiện quyền với dữ liệu nguồn                                          |
| Tệp, ảnh, attachment                  | Quyền truy cập đối tượng chứa tệp và mục đích sử dụng                              |
| Mẫu vật tư, nhóm, danh mục dùng chung | Dùng chung toàn hệ thống; permission vẫn kiểm soát việc xem/quản lý theo nghiệp vụ |

- Xem vật tư hiện tại không mặc nhiên cho xem mọi lịch sử của vật tư tại các đơn vị trước.
- Việc nhân viên chuyển đơn vị làm thay đổi phạm vi truy cập hiện tại; lịch sử chứng từ không đổi theo người đó.
- Bộ chọn có thể cần trả danh sách đối tác giao/nhận tối thiểu ngoài phạm vi dữ liệu đang quản lý. Tách contract tra cứu đối tác khỏi quyền xem chi tiết tài khoản/hồ sơ; không mở toàn bộ dữ liệu để phục vụ một select.
- Luồng đơn vị đăng ký nhận vật tư kho hiện có cần contract tra cứu vật tư được phép yêu cầu. Không vì cấp scope tổ/đơn vị mà làm mất luồng này hoặc mở toàn bộ tồn kho.
- Tất cả kiểm tra scope áp dụng trước đếm, phân trang và tổng hợp; bộ lọc do client gửi chỉ được thu hẹp kết quả.

### Quyền thực hiện giao/nhận

- Quyền hành động, phạm vi dữ liệu, tư cách đại diện bên giao/nhận và trạng thái chứng từ phải đồng thời hợp lệ.
- Quyền xem hoặc quản lý rộng không tự cho phép xác nhận thay mọi chủ thể.
- Danh sách kho được phân công là căn cứ đại diện kho, kết hợp với quyền nghiệp vụ.
- Giữ kiểm tra đại diện cho đơn vị, tổ và cá nhân hiện có cho đến khi chốt quy tắc thay thế; không tự bỏ khi chuyển scope.

## 8. Thay đổi giao diện

### Quản lý tài khoản

- Thay trang Nhân viên trong menu bằng Quản lý tài khoản.
- Bảng gồm tên/định danh đăng nhập phù hợp cơ chế auth, loại tài khoản, họ tên, đơn vị, tổ/nhóm, kho phụ trách, vai trò, trạng thái và thao tác được cấp.
- Có tìm kiếm, lọc loại tài khoản, trạng thái, đơn vị, vai trò và kho khi phù hợp.
- Tạo EPS: chọn nhân viên EPS; hiển thị thông tin và tổ chức chỉ đọc; cấp vai trò, kho và trạng thái sử dụng.
- Tạo bên ngoài: nhập hồ sơ QRCode và chọn đơn vị ngoài; cấp vai trò, kho và trạng thái sử dụng.
- Trạng thái lao động EPS và trạng thái được dùng QRCode phải được trình bày phân biệt.
- Thao tác mật khẩu/đăng nhập phải theo provider; không đặt lại mật khẩu EPS qua QRCode khi chưa có contract.
- Không đưa CRUD hồ sơ nhân viên EPS vào màn hình này.

### Quản lý đơn vị ngoài

- Bảng danh mục với mã, tên, trạng thái và thao tác theo quyền.
- Form tạo/sửa đơn vị ngoài; mã định danh có ràng buộc duy nhất.
- Dùng cùng bản ghi cho chủ thể bàn giao và nguồn chọn tài khoản ngoài.
- Bản ghi đang có tài khoản hoặc chứng từ tham chiếu không bị xóa làm mất liên kết; hỗ trợ ngừng hoạt động.
- Các trường bổ sung ngoài mã/tên/trạng thái chỉ thêm khi có yêu cầu nghiệp vụ.

### Quản lý quyền và các màn hình liên quan

- Giữ cấu trúc module/nhóm/quyền hiện có; thay checkbox bằng select với quyền có scope.
- Không còn select phạm vi chung ở vai trò.
- Hiển thị ý nghĩa phạm vi và những mức không áp dụng cho quyền đó.
- Màn hình kho và tài khoản cùng cập nhật một nguồn phân công.
- Bộ chọn chủ thể phân biệt rõ năm loại; nguồn EPS chỉ đọc.
- Các trang giữ toolbar trong Idle/loading/error, dùng ErrorState và retry phù hợp; form ngang, bảng theo builder và i18n Việt/Anh của repo.
- Trước khi triển khai UI phải thực hiện builder gate và đối chiếu screen tương ứng của web-template.

## 9. Backend và dữ liệu

### Contract cần triển khai

1. Tra cứu chỉ đọc đơn vị, tổ/nhóm và nhân viên EPS qua provider/backend đã xác minh.
2. CRUD tài khoản QRCode, liên kết nhân viên EPS hoặc đơn vị ngoài; cập nhật vai trò và kho có kiểm soát.
3. CRUD danh mục đơn vị ngoài và liên kết chủ thể.
4. Đọc/ghi grants theo permission code và scope; trả quyền hiệu lực theo từng permission.
5. Resolve tổ chức hiện tại của tài khoản EPS ở backend và cung cấp shape đọc đủ cho UI.
6. Các hàm kiểm tra tài nguyên như quyền xem vật tư, xem phiếu, thực hiện giao/nhận; tên API cụ thể chốt khi triển khai.

### Enforcement

- Kiểm tra trạng thái tài khoản và vai trò ở backend.
- Mọi endpoint/list/detail/mutation/history/export đều kiểm tra hành động và scope.
- Với Supabase dev, rà soát cả RPC security-definer, truy cập bảng trực tiếp, RLS và storage; sửa UI riêng không đủ.
- Không tin filter đơn vị, tổ, kho hoặc user ID từ client để xác định danh tính/phạm vi.
- Mutation kiểm tra trạng thái và thẩm quyền trong cùng giao dịch; tránh đổi phân công hoặc chuyển sở hữu đồng thời làm lọt thao tác.
- Không đưa service-role key ra frontend. Không gọi trực tiếp EPS từ frontend rồi dùng kết quả tự khai làm authorization.

## 10. Migration và chuyển đổi dữ liệu

1. Kiểm kê schema, migration history, dữ liệu nhân viên QRCode cũ, liên kết Auth, vai trò, chủ thể và kho thực tế.
2. Thêm loại tài khoản, liên kết nhân viên EPS/đơn vị ngoài và ràng buộc hợp lệ; không thêm cột đơn vị EPS/tổ trên tài khoản.
3. Tạo danh mục đơn vị ngoài và ánh xạ duy nhất với chủ thể external.
4. Tái sử dụng quan hệ kho–tài khoản; bổ sung liên kết nguồn EPS cho chủ thể.
5. Thêm metadata scope cho permission definitions và scope tại role grants.
6. Chuyển từng vai trò theo bảng ánh xạ đã duyệt; không biến mọi quyền đang bật thành Toàn EPS.
7. Cập nhật quyền hiệu lực và enforcement cùng contract frontend. Không để giai đoạn trung gian bỏ mất giới hạn quyền.
8. Đổi màn hình/menu; chuyển các tham chiếu nhân viên cũ sang tài khoản hoặc chủ thể đúng nghĩa.
9. Sau khi xác minh dữ liệu và luồng mới, loại bỏ trường/phụ thuộc role scope và CRUD nhân viên QRCode không còn dùng.

- Không tự phân loại tài khoản cũ thành EPS hay bên ngoài bằng suy đoán tên/email; bản ghi chưa ánh xạ cần xử lý rõ trước cutover.
- Giữ Auth UUID, người tạo phiếu, lịch sử thao tác và tham chiếu chủ thể hiện có.
- Không fallback đọc đồng thời shape cũ/mới ở frontend. Chuyển đổi tại migration/API boundary.
- Chỉ áp dụng migration remote theo quy trình repo: xác minh project, preflight version, áp dụng đúng migration và kiểm tra kết quả; không tiện thể chạy migration khác.
- Có snapshot/backup và phương án phục hồi trước cutover; nếu chưa thể chuyển an toàn, giữ phiên bản cũ cho đến khi migration và API mới sẵn sàng.

## 11. Lộ trình triển khai và nghiệm thu

### Giai đoạn 1 — Contract và dữ liệu nền

- [x] Chốt các điểm mục 12; phase này dùng fake EPS provider, không tích hợp API/SSO thật.
- [x] Kiểm kê code/schema thực tế và xác định bảng ánh xạ cho tài khoản, chủ thể, quyền và kho.
- [x] Chốt DTO tài khoản, tổ chức EPS, đơn vị ngoài, kho và effective permission grants.
- [x] Viết migration và fixture tổ chức giả lập; không import dữ liệu PLEpsClient thật.

Đầu ra: contract và mô hình dữ liệu nhất quán; tài khoản không chứa tổ chức EPS lưu trữ riêng.

### Giai đoạn 2 — Quyền backend

- [x] Triển khai scope từng quyền, hợp grant và kiểm tra tài nguyên trong migration/API local.
- [x] Áp dụng enforcement cho RPC đọc/ghi vật tư, bàn giao, phiếu nhập, lịch sử, kho, file và kết quả phân trang.
- [ ] Nghiệm thu allow/deny trực tiếp qua RPC, bảng và storage bằng tài khoản thuộc từng scope.

Đầu ra: request trực tiếp ngoài phạm vi bị từ chối dù client sửa filter hoặc đoán ID.

### Giai đoạn 3 — Tài khoản và đơn vị ngoài

- [x] Tạo hai trang thay trang Nhân viên theo builder phù hợp.
- [x] Liên kết EPS chỉ đọc qua fake provider; hồ sơ bên ngoài do QRCode quản lý.
- [x] Gán vai trò, trạng thái và kho; đồng bộ màn hình kho trên cùng quan hệ.
- [x] Đổi menu, route, quyền và các nơi chọn tài khoản; vô hiệu hóa đường CRUD nhân viên QRCode cũ trong migration.

Đầu ra: quản trị được tài khoản đăng nhập mà không quản lý lại hồ sơ nhân sự EPS.

### Giai đoạn 4 — Role editor và cutover

- [x] Select từng quyền; giữ checkbox cho quyền toàn cục không có scope.
- [x] Cập nhật frontend permission hooks, route/menu/action theo contract mới.
- [x] Migration ánh xạ quyền nhân viên cũ sang quyền tài khoản; role không có scope an toàn được ánh xạ scope mặc định theo loại quyền.
- [ ] Nghiệm thu runtime các role/scope bằng tài khoản EPS, bên ngoài và kho; kiểm tra luồng cũ đã bị chặn.

### Ma trận kiểm thử bắt buộc

| Tình huống                                                | Kết quả cần đạt                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| EPS có grant Tổ/nhóm                                      | Chỉ truy cập dữ liệu của tổ và nhân viên thuộc tổ theo quy tắc tài nguyên |
| EPS có grant Đơn vị                                       | Bao gồm các tổ/nhân viên trực thuộc, không lọt sang đơn vị khác           |
| EPS chưa phân tổ                                          | Grant Tổ/nhóm không tự nâng cấp                                           |
| Bên ngoài có grant Đơn vị                                 | Chỉ đúng đơn vị ngoài đó                                                  |
| Phụ trách kho K1, không K2                                | Grant Kho được phân công chỉ cho K1                                       |
| Thu hồi kho                                               | Truy cập/thao tác tiếp theo mất quyền tương ứng                           |
| Xem Đơn vị, quản lý Tổ/nhóm                               | Không được sửa dữ liệu ngoài tổ                                           |
| Nhiều vai trò, có scope kho và tổ                         | Hợp đúng từng quyền, không tính scope chung toàn tài khoản                |
| Một vai trò Không, vai trò khác có grant                  | Grant hợp lệ vẫn có hiệu lực                                              |
| Chuyển đơn vị EPS                                         | Scope cập nhật từ backend; snapshot chứng từ cũ không đổi                 |
| EPS không trả được tổ chức                                | Không mở rộng quyền; UI có lỗi và khả năng thử lại                        |
| EPS hợp lệ nhưng chưa được cấp QRCode / tài khoản bị khóa | Không được sử dụng ứng dụng                                               |
| Sửa filter, đoán ID, gọi RPC trực tiếp                    | Không vượt phạm vi; total/export/file cũng không rò dữ liệu               |
| Xem vật tư hiện tại                                       | Không tự xem lịch sử ngoài phạm vi                                        |
| Có quyền xem nhưng không đại diện bên nhận                | Không xác nhận nhận thay chủ thể                                          |
| Nhân viên chưa có tài khoản                               | Vẫn có thể được chọn làm chủ thể bàn giao theo contract                   |
| Tạo tài khoản trùng nhân viên / sai loại liên kết         | Backend từ chối                                                           |
| Đơn vị đăng ký nhận từ kho                                | Luồng tra cứu/yêu cầu hoạt động trong ranh giới cho phép                  |

Chạy kiểm tra theo phạm vi thay đổi: tests authorization/migration/API, import lint và TypeScript cho code thay đổi; build khi kết thúc tính năng đáng kể. Browser chỉ dùng cho tương tác hoặc bố cục cần kiểm chứng. Không chạy build cho việc viết plan này.

## 12. Các quyết định đã xác nhận khi triển khai

1. **Provider EPS:** phase này chỉ dùng danh bạ EPS giả lập trong Supabase dev; API và SSO thật là phase tích hợp riêng.
2. **Phạm vi `all`:** chỉ toàn bộ dữ liệu EPS. Kho QRCode và đơn vị ngoài cần grant theo scope tương ứng, không được mở theo `all`.
3. **Danh mục dùng chung:** mẫu vật tư, nhóm và danh mục dùng chung toàn hệ thống.
4. **Vật tư đang cho mượn:** cả bên sở hữu và bên mượn xem được hiện trạng nếu có quyền xem tương ứng; lịch sử chỉ hiển thị giao dịch mà tài khoản tham gia/đại diện.
5. **Bộ chọn đối tác:** được tra cứu tối thiểu mã, tên, ID và loại chủ thể ngoài phạm vi để lập bàn giao; không mở hồ sơ, quyền hay dữ liệu vật tư của họ.
6. **Bên nhận chưa có tài khoản QRCode:** vẫn được chọn và không cần xác nhận trong ứng dụng; bên giao có thể hoàn tất ghi nhận ngoại tuyến. Bên nhận có tài khoản vẫn xác nhận theo luồng hiện có.
7. **Đại diện giao dịch:** giữ yêu cầu quyền nghiệp vụ, phạm vi và tư cách đại diện bên giao; không cấp quyền đại diện chỉ vì có quyền quản lý rộng.

### Trạng thái cutover

- Migration `20261022033339_eps_accounts_external_organizations_and_permission_scopes` và migration thu hồi quyền gọi trigger `20261022033509_revoke_role_permission_trigger_execute` đã được áp dụng vào project Supabase dev khớp `SUPABASE_DB_URL`.
- Edge Function `account-management` đã triển khai với JWT bắt buộc. Xác minh schema, RPC, quyền bảng employee cũ, scope grant, mock directory và storage policies đã qua.
- Chưa chạy ma trận allow/deny bằng các tài khoản EPS, bên ngoài và kho; đây là phần còn lại trước khi đánh dấu hoàn tất kế hoạch.

Các mục chưa chốt là đầu việc giai đoạn 1. Có thể triển khai phần độc lập sau khi contract nền tảng rõ; không tự quyết định khác kiến trúc hoặc mở rộng phạm vi dữ liệu để bỏ qua điểm chưa rõ.
