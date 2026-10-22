# Bộ profile tài khoản live test — tổ chức EPS và phạm vi quyền

Ngày: 22/10/2026. Trạng thái: đề xuất để chuẩn bị và chạy live test; chưa tạo tài khoản, vai trò hoặc dữ liệu remote trong công việc viết tài liệu này.

Nguồn: [plan triển khai](../plans/2026-10-22-eps-accounts-parties-and-permission-scopes.md), đặc biệt mục 12 đã xác nhận, cùng permission codes và seed của migration `20261022033339_eps_accounts_external_organizations_and_permission_scopes.sql`.

## 1. Mục đích và quy tắc chạy

- Dùng tài khoản có vai trò công việc rõ ràng để sử dụng phần mềm như người dùng thật, đồng thời kiểm tra điều kiện cho phép và từ chối.
- Chỉ dùng project phát triển và danh bạ EPS giả lập; không dùng hồ sơ/tài khoản của PLEpsClient thật.
- Username dưới đây là đề xuất, không phải tài khoản đã tồn tại. Không ghi mật khẩu, access token, refresh token hoặc service key vào tài liệu/bằng chứng.
- Dùng browser profile/session riêng theo tài khoản; tài khoản admin chỉ chuẩn bị dữ liệu và đối soát, không dùng kết quả từ session admin để kết luận quyền người dùng.
- Mỗi tài khoản thường chỉ có các role ghi trong profile. Không kế thừa role admin, grant-all hoặc override quyền cũ ngoài kịch bản đang kiểm tra.
- Mỗi permission có scope riêng. Scope Không là không cấp grant; quyền bật/tắt ghi Bật hoặc Không.
- Quyền xem không tự cho quyền quản lý; phân công kho không tự cấp quyền; scope `all` chỉ EPS, không bao gồm kho/đơn vị ngoài.
- Các nhiệm vụ thay đổi sở hữu hoặc trạng thái phải dùng dữ liệu test riêng. Ghi nhận trạng thái trước/sau; không dùng chung vật tư cho hai ca mutation đồng thời.
- Các kỳ vọng bên dưới là tiêu chí nghiệm thu, không phải kết quả đã được xác nhận bằng runtime.

## 2. Chuẩn bị dữ liệu đối chứng

### 2.1. Tổ chức EPS giả lập hiện có trong migration

| Ký hiệu | ID nguồn | Tên/quan hệ |
| --- | --- | --- |
| DA | `EPS-MOCK-D01` | Đơn vị mẫu A |
| DB | `EPS-MOCK-D02` | Đơn vị mẫu B |
| A1 | `EPS-MOCK-T01` | Tổ mẫu A1, thuộc DA |
| A2 | `EPS-MOCK-T02` | Tổ mẫu A2, thuộc DA |
| B1 | `EPS-MOCK-T03` | Tổ mẫu B1, thuộc DB |
| E001 | `EPS-MOCK-E001` | Nguyễn An, DA/A1 |
| E002 | `EPS-MOCK-E002` | Trần Bình, DA/A1 |
| E003 | `EPS-MOCK-E003` | Lê Chi, DA/A2 |
| E004 | `EPS-MOCK-E004` | Phạm Dũng, DB/B1 |
| E005 | `EPS-MOCK-E005` | Võ Hà, DB, chưa phân tổ |

Mỗi nhân viên trên chỉ liên kết một tài khoản. Không tạo tài khoản EPS thứ hai cho cùng employee để đủ profile.

### 2.2. Dữ liệu cần chuẩn bị thêm

| Ký hiệu | Dữ liệu | Mục đích |
| --- | --- | --- |
| X | Đơn vị ngoài `UAT-EXT-X` | Phạm vi đối tác X |
| Y | Đơn vị ngoài `UAT-EXT-Y` | Đối chứng khác đơn vị ngoài |
| K1 | Kho `UAT-K1` | Kho được phân công |
| K2 | Kho `UAT-K2` | Kho không được phân công |
| M-DA, M-DB | Vật tư sở hữu trực tiếp bởi DA, DB | Phân biệt cấp đơn vị và tổ |
| M-A1, M-A2, M-B1 | Vật tư sở hữu bởi từng tổ | Đối chứng cùng/khác đơn vị |
| M-E001, M-E003, M-E004, M-E005 | Vật tư giao trực tiếp nhân viên | Kiểm tra kế thừa phạm vi tổ chức |
| M-X, M-Y | Vật tư của X, Y | Kiểm tra đơn vị ngoài |
| M-K1, M-K2 | Vật tư tồn tại K1, K2 | Kiểm tra phạm vi kho |
| R-K1, R-K2 | Phiếu nhập tại K1, K2 | Kiểm tra phiếu nhập và tổng số |
| H-A1-A2 | Phiếu giữa A1 và A2 | Hai tổ khác nhau cùng đơn vị |
| H-A2-B1 | Phiếu giữa A2 và B1 | Hai đơn vị EPS |
| H-X-A1 | Phiếu giữa X và A1 | Ranh giới ngoài/EPS |
| H-Y-B1 | Phiếu giữa Y và B1 | Đối chứng không liên quan X/DA |
| H-K1-A1, H-K2-A2 | Phiếu từ hai kho | Kho được giao/không được giao |

- Mỗi vật tư/phiếu test ghi mã có tiền tố `UAT-`; ghi ID thực tế vào kết quả chạy.
- Liên kết chủ thể EPS đúng `source_type + source_id` trước khi thử quyền. Kiểm tra các chủ thể EPS mẫu cũ đã được ánh xạ; không ghép tên và không tạo bản trùng để che lỗi.
- Chuẩn bị phiếu nháp, chờ nhận và đã hoàn tất riêng cho những ca cần trạng thái khác nhau.
- Chuẩn bị một attachment test trên phiếu trong phạm vi và một attachment trên phiếu ngoài phạm vi.
- Chuẩn bị bộ dữ liệu tĩnh cho kiểm tra count/pagination; các luồng bàn giao dùng bộ vật tư riêng để không làm thay đổi tập đối chứng.
- Đối tác xuất hiện tối thiểu trong bộ chọn không đồng nghĩa được mở hồ sơ hay vật tư của đối tác đó.

## 3. Quy ước quyền và role test

| Ký hiệu | Permission code |
| --- | --- |
| MV | `materials:material:view` |
| MM | `materials:material:manage` |
| HV | `materials:handover:view` |
| HM | `materials:handover:manage` |
| CV | `materials:custodian:view` |
| RV | `materials:receipt:view` |
| RM | `materials:receipt:manage` |
| WV | `materials:warehouse:view` |
| AV | `organization:account:view` |
| AM | `organization:account:manage` |
| XV | `organization:external-organization:view` |
| XM | `organization:external-organization:manage` |

Các quyền không liệt kê trong role đều Không. Nếu UI đòi thêm quyền để mở route/bộ chọn, ghi rõ quyền và lý do trước khi cấp; không thêm admin để làm ca test chạy qua.

| Role đề xuất | Grants |
| --- | --- |
| `UAT_TEAM_OPERATOR` | MV, MM, HV, HM, CV = `team` |
| `UAT_DEPARTMENT_READER` | MV, HV, CV = `department` |
| `UAT_EPS_READER` | MV, HV, CV = `all` |
| `UAT_WAREHOUSE_OPERATOR` | MV, MM, HV, HM, CV, RV, RM, WV = `assigned_warehouses` |
| `UAT_EXTERNAL_OPERATOR` | MV, MM, HV, HM, CV = `department` |
| `UAT_EXTERNAL_READER` | MV, HV, CV = `department` |
| `UAT_ORG_ADMIN` | AV, AM, XV, XM = Bật; bổ sung quyền quản lý role hiện hành nếu cần, ghi code thật từ catalog khi chuẩn bị |

Không cấp quyền quản lý danh mục dùng chung cho người chỉ cần chọn mẫu vật tư. Nếu thao tác nhập cần khai báo mẫu mới, kiểm tra trường hợp đó riêng với quyền catalog được cấp rõ ràng.

## 4. Danh sách profile

### P00 — Điều phối viên chuẩn bị UAT

- Tài khoản: dùng admin hiện có; ghi username/ID thực tế khi chạy.
- Vai trò công việc: chuẩn bị tài khoản, dữ liệu, chủ thể và kho; đối soát kết quả.
- Quyền: kiểm kê grants thực tế của admin, không mặc định admin vượt mọi scope. Nếu tài khoản admin cũ chưa ánh xạ tổ chức, dùng quyền quản trị tài khoản để chuẩn bị, không lấy nó làm profile EPS toàn cục.
- Nhiệm vụ: tạo X/Y/K1/K2, các role và tài khoản P01–P09; cấp K1 cho P04/P08; liên kết EPS; chuẩn bị dữ liệu đối chứng bằng tài khoản được phép thao tác.
- Kiểm tra: tạo EPS trùng employee phải bị chặn; không cho tài khoản bên ngoài gắn employee EPS hoặc EPS gắn đơn vị ngoài; đổi kho trên màn hình tài khoản phải phản ánh trên màn hình kho và ngược lại.
- Bằng chứng: bảng ID tài khoản/role/kho/chủ thể và grant thực tế, không chứa thông tin đăng nhập bí mật.

### P01 — Nguyễn An: cán bộ vật tư tổ A1, xem thêm toàn đơn vị A

- Username đề xuất: `uat.an.a1`.
- Loại: EPS; employee E001; tổ chức backend DA/A1; không kho.
- Roles: `UAT_TEAM_OPERATOR` + `UAT_DEPARTMENT_READER`.
- Ý nghĩa: cùng một người xem rộng cấp đơn vị nhưng chỉ quản lý cấp tổ; đồng thời kiểm tra hợp hai scope của cùng permission.
- Được thấy: M-DA, M-A1, M-A2 và nhân viên thuộc DA; phiếu có ít nhất một bên thuộc DA.
- Được sửa: dữ liệu thuộc A1 và nhân viên A1 theo quyền nghiệp vụ; giao/nhận còn cần tư cách đại diện và trạng thái phù hợp.
- Phải bị chặn: sửa M-A2/M-DA; xem dữ liệu thuần DB, X/Y hoặc kho không liên quan.
- Nhiệm vụ:
  1. Tìm vật tư A1 và A2, mở chi tiết cả hai; chỉ sửa ghi chú trên vật tư A1 được phép.
  2. Dùng URL/ID vật tư A2 gửi thao tác sửa trực tiếp: bị từ chối, dữ liệu không đổi.
  3. Làm phiếu từ A1 sang A2 bằng tư cách đại diện hợp lệ; người nhận xử lý theo luồng.
  4. Mở phiếu có liên quan DA và thử H-Y-B1 bằng URL trực tiếp: trường hợp sau bị chặn.
  5. Kiểm tra quyền xem Đơn vị không làm quyền quản lý Tổ/nhóm thành Đơn vị.

### P02 — Trần Bình: người theo dõi vật tư đơn vị A, chỉ xem

- Username: `uat.binh.da`; EPS E002; DA/A1; không kho.
- Role: `UAT_DEPARTMENT_READER`.
- Được thấy: DA, A1, A2, nhân viên thuộc DA và phiếu liên quan; không cần mở rộng đến DB.
- Không được làm: sửa vật tư, tạo/gửi/xác nhận/hủy phiếu, quản trị tài khoản/role/kho.
- Nhiệm vụ: tra cứu vật tư giao trực tiếp cho Chi E003; đối chiếu với vật tư B1; thử mở form bằng URL và gọi mutation trực tiếp; dữ liệu phải không đổi.
- Ca bổ sung: tạm thêm một role không cấp MV; MV hiện có vẫn hiệu lực. Role Không không phải explicit deny.

### P03 — Lê Chi: giám sát dữ liệu toàn EPS

- Username: `uat.chi.eps`; EPS E003; DA/A2; không kho.
- Role: `UAT_EPS_READER`.
- Được thấy: vật tư thuộc DA/DB, A1/A2/B1 và nhân viên EPS; phiếu có bên EPS trong phạm vi.
- Phải bị chặn: vật tư chỉ thuộc X/Y, vật tư chỉ nằm K1/K2, phiếu nhập kho; mọi mutation do chỉ có quyền xem.
- Nhiệm vụ:
  1. Đối chiếu dữ liệu EPS ở cả A và B.
  2. Dùng ID M-X/M-K1/R-K1 mở thẳng chi tiết và RPC: không được lộ dữ liệu.
  3. H-X-A1 có thể xem vì có bên EPS; điều này không mở toàn bộ vật tư X. Tương tự phiếu kho→EPS không tự cấp xem phiếu nhập kho.
  4. Tra cứu tối thiểu X/K1 trong bộ chọn nếu luồng cho phép; không suy ra quyền hồ sơ hoặc inventory.

### P04 — Phạm Dũng: cán bộ tổ B1 kiêm thủ kho K1

- Username: `uat.dung.b1.k1`; EPS E004; DB/B1; kho `[K1]`.
- Roles: `UAT_TEAM_OPERATOR` + `UAT_WAREHOUSE_OPERATOR`.
- Được thấy/quản lý: B1 và nhân viên B1; tồn kho, phiếu nhập và phiếu liên quan K1 trong quyền đã cấp.
- Không được thấy/quản lý: M-DB sở hữu trực tiếp đơn vị, A1/A2, E005 chưa phân tổ, K2/R-K2. Một phiếu liên quan B1 vẫn có thể xem dù bên còn lại ngoài scope.
- Nhiệm vụ:
  1. Tạo phiếu nhập vào K1 với mẫu sẵn có; xác nhận nhập, đối chiếu số lượng/serial vật tư.
  2. Phân bổ vật tư K1 cho A1; P01 xác nhận theo luồng, ghi nhận số lượng thực nhận.
  3. Thử chọn K2, sửa warehouse ID của request sang K2: bị từ chối.
  4. Kiểm tra đồng thời có quyền ở B1 và K1 nhưng không lan sang toàn DB/K2.
  5. Thu hồi K1 bởi P00; dùng cả session hiện tại và sau reload thử đọc/sửa K1: phải mất quyền. Khôi phục sau ca test.

### P05 — Võ Hà: nhân viên EPS chưa phân tổ

- Username: `uat.ha.no-team`; EPS E005; DB, team `null`; không kho.
- Role ban đầu: `UAT_TEAM_OPERATOR`.
- Kỳ vọng: không có dữ liệu tổ; không tự nâng lên DB. Giao diện có empty/error phù hợp contract, không quay về toàn bộ hệ thống.
- Nhiệm vụ:
  1. Thử danh sách, chi tiết M-B1/M-DB và mutation: không được cấp từ scope team.
  2. P00 thêm `UAT_DEPARTMENT_READER`: thấy DB/B1/E005, vẫn không được quản lý ở DB vì HM/MM chỉ team.
  3. Gỡ role vừa thêm để trở về baseline.

### P06 — Người phụ trách đơn vị ngoài X

- Username: `uat.x.operator`; loại bên ngoài; đơn vị X; không employee EPS, không kho.
- Role: `UAT_EXTERNAL_OPERATOR`.
- Được thấy/quản lý: vật tư X và phiếu có X tham gia, theo trạng thái/tư cách đại diện.
- Phải bị chặn: vật tư Y, inventory EPS, K1/K2, phiếu không liên quan X; quản lý tài khoản/đơn vị ngoài toàn hệ thống.
- Nhiệm vụ:
  1. Nhận vật tư từ EPS, xác nhận bằng tài khoản X; đối chiếu chủ sở hữu và lịch sử.
  2. Tạo bàn giao vật tư X cho Y; dùng P07 thử xác nhận nếu chỉ có quyền xem: phải bị chặn. Khi cần hoàn tất, P00 tạm cấp role operator cho P07 và ghi rõ thay đổi rồi thu hồi.
  3. Thử request thay `externalOrganizationId`/party ID để đọc/sửa vật tư Y: bị chặn.
  4. Trong bộ chọn thấy tên/ID đối tác tối thiểu nhưng không mở được hồ sơ hoặc toàn bộ vật tư của họ.

### P07 — Người theo dõi đơn vị ngoài Y, chỉ xem

- Username: `uat.y.viewer`; bên ngoài; đơn vị Y; không kho.
- Role: `UAT_EXTERNAL_READER`.
- Được thấy: vật tư Y và phiếu liên quan Y, bao gồm H-Y-B1.
- Không được thấy: vật tư X hoặc lịch sử thuần X; không sửa/xác nhận phiếu dù bản thân thuộc đơn vị nhận.
- Nhiệm vụ: đối chứng P06; mở thẳng ID của X; kiểm tra nút thao tác và request trực tiếp; không có mutation thành công.

### P08 — Thủ kho bên ngoài, chỉ phụ trách K1

- Username: `uat.k1.keeper`; bên ngoài; đơn vị X; kho `[K1]`.
- Role duy nhất: `UAT_WAREHOUSE_OPERATOR`.
- Được thấy/quản lý: dữ liệu K1 theo grants; phiếu có K1 tham gia.
- Không được thấy: M-X dù tài khoản thuộc X, K2/R-K2, vật tư EPS không liên quan K1. Thuộc đơn vị không tự cấp scope Đơn vị.
- Nhiệm vụ: kiểm tra danh sách tồn/phiếu nhập K1; tạo phiếu nhập mẫu sẵn có; bàn giao K1→EPS; gọi trực tiếp K2 bị chặn.
- Ca phân biệt phân công và quyền: P00 gỡ role nhưng giữ kho K1; tài khoản không còn quyền nghiệp vụ. Khôi phục role sau khi ghi nhận.

### P09 — Tài khoản không được cấp quyền / bị khóa

- Username: `uat.no-grants`; bên ngoài; đơn vị X; không kho.
- Trạng thái baseline: `active`; không role, không override.
- Kỳ vọng: có thể xác thực theo contract nhưng không truy cập dữ liệu nghiệp vụ; có trang không có quyền phù hợp, không lọt danh sách do UI dùng mặc định.
- Nhiệm vụ:
  1. Mở route tài khoản, vật tư, phiếu và request trực tiếp: không đọc/ghi dữ liệu bảo vệ.
  2. P00 tạm cấp `UAT_EXTERNAL_READER`; thấy X đúng scope.
  3. Chuyển `suspended`, sau đó `deactivated`: request nghiệp vụ phải bị từ chối, kể cả session/token đã cấp trước đó; kiểm tra luồng đăng nhập và thông báo trạng thái.
  4. Khôi phục `active`, gỡ role để về baseline.

## 5. Các kịch bản liên profile bắt buộc

### F01 — Chu trình kho → tổ → đơn vị ngoài → hoàn trả

1. P04 hoặc P08 nhập lô test vào K1 từ mẫu sẵn có.
2. Thủ kho lập phân bổ K1→A1; P01 nhận theo luồng và tư cách đại diện đã chuẩn bị.
3. P01 cho X mượn một vật tư A1; P06 nhận. P01/P06 xem được hiện trạng theo quyền bên sở hữu/bên mượn.
4. P06 trả vật tư; bên A1 xác nhận; đối chiếu sở hữu, bên mượn, tình trạng và lịch sử.
5. P02/P03 chỉ quan sát trong phạm vi; P07 và tài khoản không quyền không được thao tác.

Ghi ID từng phiếu và vật tư. Kiểm tra người không đại diện không được xác nhận dù có grant xem rộng. Không dùng phiếu cũ đã hoàn tất để kiểm tra bước cần phiếu đang chờ.

### F02 — Bên nhận chưa có tài khoản và hoàn tất ngoại tuyến

- Chạy trước khi liên kết tài khoản cho E005: bên giao hợp lệ lập phiếu tới E005, hoàn tất ngoại tuyến, kiểm tra actor, thời điểm, phương thức hoàn tất và lịch sử phân biệt với bên nhận xác nhận online.
- Sau đó mới tạo P05. Xác minh phiếu cũ/snapshot không bị viết lại vì người nhận vừa có tài khoản.
- Đối chứng bằng bên nhận E001 đã có P01: bên giao không được dùng đường ngoại tuyến để bỏ qua xác nhận online bắt buộc.
- Nếu đã có tài khoản E005, dùng nhân viên EPS giả lập bổ sung qua cách chuẩn bị fixture được hỗ trợ; không xóa tài khoản hoặc liên kết đang dùng chỉ để chạy ca này.

### F03 — Chuyển đơn vị và trạng thái nhân viên EPS

- Dùng P01 với fixture EPS dev: chuyển E001 từ DA/A1 sang DB/B1; không sửa cột tổ chức tài khoản QRCode.
- Sau thời điểm làm mới đã quy định trong contract, session hiện tại và session mới đều tính scope theo DB/B1; không còn sửa A1 chỉ vì cache cũ.
- Phiếu cũ vẫn giữ snapshot DA/A1. Không kết luận được xem toàn bộ lịch sử cũ chỉ vì từng thuộc DA.
- Tạm cho employee ngừng hoạt động, kiểm tra chặn theo contract; thử provider lỗi/không resolve được tổ chức, không mở rộng quyền.
- Khôi phục fixture ban đầu; ghi cách thao tác, thời điểm và kết quả. Nếu hiện chưa có đường điều khiển provider để test, đánh dấu Blocked, không đổi account thành tài khoản ngoài để thay thế ca này.

### F04 — Lịch sử, tìm kiếm, total, file và truy cập trực tiếp

- Chuẩn bị vật tư có giao dịch trước đây ngoài scope, sau đó chuyển vào scope người thử.
- Chỉ hiện các giao dịch lịch sử người đó được phép tham gia/đại diện theo contract; quyền xem hiện trạng không mở mọi lịch sử trước đó.
- Với P01/P06/P08, so sánh danh sách, tìm kiếm toàn cục, count, pagination và export nếu có; không rò bản ghi ngoài phạm vi qua tên, snippet hoặc tổng số.
- Gọi list/detail/history RPC và đường đọc bảng trực tiếp bằng session người dùng; đổi bộ lọc tổ/đơn vị/kho và ID tài nguyên. Kết quả không được rộng hơn grant.
- Thử tải attachment ngoài phạm vi bằng đường API/storage và tạo URL mới. Ghi TTL/contract của signed URL đã cấp trước khi thu hồi; không tự mặc định signed URL hết hiệu lực ngay nếu contract không hỗ trợ.
- Kiểm tra CRUD nhân viên cũ không còn ghi/đọc hồ sơ qua route/API/tables cũ.

### F05 — EPS có danh tính nhưng chưa được cấp QRCode

- Dùng fixture/danh tính test riêng chưa được cấp tài khoản ứng dụng hoặc mapping, theo cơ chế auth dev thực tế.
- Không được vào dữ liệu nghiệp vụ chỉ nhờ xác thực thành công.
- Nếu phase fake provider chưa có cơ chế đăng nhập EPS cho ca này, ghi Blocked/Not supported ở phase hiện tại; không báo Pass từ ca tài khoản suspended thay thế.

## 6. Trình tự chạy đề xuất

1. P00 kiểm tra cấu hình tạo/đăng nhập tài khoản, mapping EPS cũ và dữ liệu đối chứng. Ghi rõ secret đã được xác minh nhưng không ghi giá trị.
2. Chuẩn bị role; tạo P01–P04, P06–P09. Chuẩn bị E005 chưa liên kết để chạy F02 trước khi tạo P05.
3. Chạy ca đọc và chặn thao tác P01–P09 trên dữ liệu tĩnh, đối chiếu total và gọi trực tiếp; tạo P05 sau F02.
4. Chạy F01 và các luồng đang có: đăng ký nhận kho, kho duyệt/từ chối, nhận một phần, hủy đúng trạng thái.
5. Chạy thu hồi kho, gỡ role, khóa tài khoản, F03 chuyển tổ chức; khôi phục baseline sau mỗi ca.
6. Chạy F04/F05, kiểm tra dấu vết lịch sử và lập danh sách lỗi còn lại.

Ưu tiên nghiệm thu trước P01, P04, P06, P08, P09: đây là các ranh giới xem rộng/sửa hẹp, hợp scope, đơn vị ngoài, kho và không quyền. P02/P03/P05 bổ sung đối chứng cấp đơn vị, toàn EPS và chưa phân tổ.

## 7. Mẫu ghi nhận kết quả

Tạo một bản kết quả theo ngày chạy, không sửa kỳ vọng trong profile để khớp lỗi hiện tại.

```md
# Live test QRCode — YYYY-MM-DD

- Môi trường/project ref: ...
- Commit hoặc trạng thái working tree: ...
- Người chạy, thời điểm/múi giờ: ...
- Mapping profile → Auth UUID/username: ...
- Mapping dữ liệu → ID thực tế: ...
- Grants thực tế / override ngoài dự kiến: ...

| Case | Profile | Resource ID | Bước thao tác / request | Kỳ vọng | Thực tế | Pass/Fail/Blocked | Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01-02 | P01 | ... | Sửa vật tư A2 qua request trực tiếp | Bị chặn, dữ liệu không đổi | ... | ... | ... |

## Thay đổi tạm và khôi phục

| Thay đổi | Trước | Sau khi test | Đã khôi phục |
| --- | --- | --- | --- |
| Phân công K1 của P04 | Có | ... | ... |

## Lỗi và phần chưa kiểm tra

- ...
```

### Điều kiện kết luận

- Pass cần bằng chứng trên session đúng profile, không chỉ nút bị ẩn. Ca mutation bị chặn cần đối soát dữ liệu không đổi.
- Không kết luận fail khi không có dữ liệu: phân biệt empty hợp lệ, request bị từ chối và lỗi provider.
- Không kết luận pass chỉ vì danh sách rỗng: phải có dữ liệu cùng scope và ngoài scope để đối chứng.
- Blocked phải ghi rõ thiếu dữ liệu, contract, cấu hình hay đường test; không tính như Pass.
- Chỉ nghiệm thu quyền khi các ranh giới chính, request trực tiếp, lịch sử và file đã chạy. Build/TypeScript không thay thế ma trận runtime này.
