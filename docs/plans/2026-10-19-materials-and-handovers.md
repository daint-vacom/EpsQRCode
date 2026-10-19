# Kế hoạch triển khai vật tư thực tế và phiếu bàn giao

Ngày: 19/10/2026. Phạm vi: EpsQRCode, một workspace, không tenant.

## 1. Quyết định đã chốt

- Mỗi vật tư thực tế có UUID, mã định danh bất biến, QR và một mẫu nguồn.
- Lưu snapshot thông tin mẫu lúc tạo. Sửa mẫu không tự đổi vật tư cũ; cập nhật từ mẫu phải xem trước, xác nhận chủ động và ghi lịch sử. Giữ override của vật tư; không đọc hai dạng dữ liệu cũ/mới.
- Vật tư có owner, borrower tùy chọn, condition `good | damaged`. Đơn vị đang giữ suy ra từ borrower hoặc owner.
- Chủ thể sở hữu/mượn có thể là phòng ban, tổ nhóm, cá nhân, đơn vị ngoài. Mô hình thống nhất có `id`, `code`, `name`, `type`; thêm parent, trạng thái và liên kết người đại diện khi cần. Không kết nối danh mục hoặc tài khoản PLEpsClient.
- Ba loại phiếu: chuyển sở hữu, cho mượn, trả lại. Một phiếu có một loại, một bên giao, một bên nhận và nhiều vật tư riêng lẻ.
- Khóa vật tư ngay khi lưu vào phiếu nháp. Một vật tư không thuộc đồng thời hai phiếu nháp/chờ nhận. Thêm/xóa dòng phải cập nhật đặt giữ nguyên tử; hủy/từ chối/hoàn tất giải phóng đặt giữ.
- Luồng `draft -> pending -> completed | rejected | cancelled`; bản nháp cũng được hủy. Chưa có bước quản lý phê duyệt.
- Chỉ xác nhận toàn bộ phiếu ở giai đoạn đầu. Cấu trúc dòng phiếu giữ độc lập để có thể mở rộng nhận từng phần sau, không cung cấp nút nhận một phần ở phiên bản này.
- Vật tư hỏng vẫn được bàn giao; tình trạng phải rõ ràng và có ghi chú bắt buộc.
- Tái sử dụng bố cục trang chi tiết mở tab mới từ example vật tư, loại bỏ phụ thuộc mock và công tắc giả đăng nhập trong luồng thật.

## 2. Mô hình và trách nhiệm dữ liệu

### Chủ thể bàn giao

`Custodian`: UUID id, code, name, type (`department | team | person | external`), parentId tùy chọn, isActive. Liên kết Auth UUID với chủ thể qua danh sách đại diện; không coi tên người nhận nhập tay là bằng chứng quyền xác nhận. Đơn vị ngoài có thể được đại diện bởi tài khoản nội bộ được phân công. Không tự động cho mọi người xác nhận mọi chủ thể.

### Vật tư

`Material`: UUID, code, modelId, modelSnapshot (mã/tên/nhóm/mô tả/ảnh/thông số/thời điểm nguồn), overrides, serial, ownerPartyId, borrowerPartyId, condition, version, createdAt/updatedAt. Cấu trúc và kiểu dữ liệu thông số thuộc mẫu; vật tư chỉ ghi đè các giá trị hợp lệ, không tự tạo cấu trúc. Quy tắc ghi đè tường minh cần thể hiện trong hợp đồng.

Khởi tạo lưu owner và condition một lần, ghi sự kiện. Chỉnh hồ sơ chỉ sửa thông tin tĩnh; owner/borrower/condition sau đó chỉ đổi qua nghiệp vụ hoàn tất phiếu. Chặn cập nhật mẫu khi vật tư đang được đặt giữ nếu làm thay đổi dữ liệu đã chốt trong phiếu.

### Phiếu và lịch sử

`Handover`: mã, loại, trạng thái, hai chủ thể, tên người đại diện giao/nhận, ngày dự kiến, hạn trả khi cho mượn, lý do/ghi chú, tệp đính kèm, người tạo/gửi/xác nhận và thời gian hệ thống.

`HandoverItem`: vật tư, snapshot định danh/tên/thông số cần thiết, tình trạng trước và khi nhận, ghi chú/minh chứng. Snapshot phiếu hoàn tất không đổi khi đổi tên mẫu/chủ thể/vật tư.

`Reservation`: khóa duy nhất trên vật tư cho phiếu draft/pending. `MaterialEvent`: biến động trước/sau, actor Auth UUID, thời gian, phiếu căn cứ. `HandoverEvent`: luồng xử lý và lý do. Quan hệ mượn giữ liên kết phiếu cho mượn gốc và phiếu trả để truy vết, hạn trả và lượt mượn hiện tại.

## 3. Hợp đồng API

Frontend gọi các adapter domain, tách khỏi Supabase. Provider phát triển hiện tại dùng RPC PostgREST, sau này thay được bằng backend EPS QR riêng. Tên/hình dạng tham số cụ thể theo model/API được agent nền tảng công bố và ghi bổ sung vào tài liệu bàn giao.

| Nhóm        | Hành vi endpoint                                                                  |
| ----------- | --------------------------------------------------------------------------------- |
| Chủ thể     | Liệt kê/tìm kiếm, tạo/sửa chủ thể, quản lý người đại diện có quyền                |
| Vật tư      | Danh sách/chi tiết, tạo, sửa hồ sơ tĩnh, lịch sử                                  |
| Đồng bộ mẫu | Xem trước khác biệt và áp dụng chủ động với kiểm tra phiên bản                    |
| Bàn giao    | Danh sách/chi tiết, lưu nháp và đặt giữ dòng, gửi, xác nhận toàn bộ, từ chối, hủy |

Mọi mutation xác minh quyền server và phiên bản hiện tại. Xác nhận khóa các vật tư theo thứ tự ổn định, kiểm tra lại owner/borrower, cập nhật toàn bộ phiếu/vật tư/lịch sử trong cùng transaction. Xác nhận lặp cùng phiếu không tạo biến động lặp. Thu hồi quyền sau khi mở trang vẫn phải chặn mutation.

## 4. Quy tắc nghiệp vụ

1. Hai bên khác nhau, vật tư không trùng dòng, chủ thể đang hoạt động khi tạo/gửi.
2. Chuyển sở hữu/cho mượn: bên giao là owner, borrower đang rỗng. Trả lại: bên giao là borrower hiện tại, bên nhận là owner. Chưa cho mượn tiếp hay chuyển sở hữu trong khi mượn.
3. Phiếu nháp có thể sửa; pending chốt nội dung; completed bất biến. Từ chối ghi lý do, không đổi hiện trạng. Chưa cung cấp sửa ngược chứng từ hoàn tất.
4. Chỉ completed làm đổi owner/borrower/condition. Trạng thái UI hay quét được QR không cấp quyền dữ liệu.
5. Danh mục dùng active trước rồi tên theo collation tiếng Việt, ID ổn định. Phiếu và lịch sử newest-first, ID làm tie-breaker.

## 5. Màn hình

- Danh sách vật tư: search mã/tên/serial, lọc mẫu/nhóm/chủ thể/tình trạng, pagination, tạo/sửa hồ sơ, mở chi tiết tab mới và QR.
- Tạo/sửa: chọn mẫu, hiển thị snapshot và override rõ ràng, khôi phục theo mẫu, owner và condition chỉ ở lúc tạo.
- Chi tiết: theo bố cục standalone example, ảnh/QR/sidebar hiện trạng, thông tin/thông số, lịch sử và phiếu liên quan; toàn bộ dữ liệu thật.
- Danh sách bàn giao: lọc loại/trạng thái/hai bên/ngày, tìm mã phiếu/vật tư, liên kết tạo/chi tiết.
- Lập phiếu: chọn loại/hai bên/người đại diện/ngày/hạn trả, thêm từng vật tư, tình trạng/ghi chú, lưu nháp đặt giữ, gửi.
- Chi tiết phiếu: snapshot dòng, diễn biến, hành động theo trạng thái/quyền/chủ thể; nhận toàn phiếu, từ chối/hủy có lý do.
- Danh mục chủ thể tối giản và gán người đại diện để test được các loại đối tượng, dùng dữ liệu của EpsQRCode.

Mọi trang giữ toolbar ở idle/loading/error, dùng ErrorState và retry phù hợp. Form ngang, không placeholder text, catalog vi/en, button PageHeader size md. Chọn builder qua registry và chạy generator thật. Không redesign trang example không liên quan.

## 6. Phân công GPT-6 Luna

| Agent          | Sở hữu                                                                         | Đầu ra                                                                  |
| -------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| domain_backend | domain model/API/hooks materials, handover, custodians; SQL; test nghiệp vụ    | Hợp đồng dùng chung công bố trước, migration, atomic RPC, authorization |
| materials_ui   | UI vật tư, fixture/output builder, test UI, messages riêng                     | List/editor/detail/QR/history/sync preview                              |
| handover_ui    | UI bàn giao và chủ thể, fixture/output, test, messages riêng                   | List/editor/detail/actions/party catalog                                |
| Root           | tài liệu, tích hợp route/menu/catalog, review, migration remote, kiểm tra tổng | Luồng hoạt động nhất quán và báo cáo bằng chứng                         |

Không agent sửa chung route/menu/catalog; phối hợp trực tiếp qua hợp đồng. Không commit tự động hay sửa repo tham chiếu.

## 7. Thứ tự triển khai và tiêu chí nghiệm thu

1. Công bố model/API; UI đối chiếu example và canonical web-template.
2. Tạo SQL/RPC, RLS/quyền, seed dev tối thiểu. Preflight project ref từ env và migration history, chỉ apply migration mới liên quan bằng connector; không áp dụng pending không liên quan.
3. Hoàn thiện UI song song, ghép routes/menu và vi/en.
4. Test nghiệp vụ: snapshot không tự đổi; sync tường minh giữ override; khóa ngay draft và giải phóng; chuyển/cho mượn/trả đúng; hỏng bắt ghi chú; toàn phiếu rollback khi một dòng sai; double confirm idempotent; người không đại diện bị chặn; completed không sửa.
5. Focused import lint, TypeScript, targeted tests và một production build khi tích hợp hoàn tất. Browser chỉ kiểm tra phần standalone/new-tab/QR hoặc tương tác chưa xác minh được bằng test; tsc sau sửa cuối trước browser.
6. Xác minh SQL thực tế bằng transaction rollback để không để lại chứng từ test. Ghi rõ phần chưa chạy được, không báo hoàn tất dựa trên mock.

## 8. Ngoài phạm vi giai đoạn đầu

Nhận từng phần, phê duyệt quản lý, mượn nối tiếp, phiếu kiểm tra/đánh giá/phản ánh, nhập danh mục từ EPS cũ, kế toán/khấu hao, sửa ngược phiếu hoàn tất. Các nghiệp vụ sau dùng liên kết vật tư và lịch sử chung nhưng không thêm UI giả ở giai đoạn này.

## 9. Theo dõi thực hiện

- [x] Chốt phạm vi từ đề xuất và nhận xét người dùng.
- [x] Phân công ba agent GPT-6 Luna.
- [x] Hợp đồng domain và migration nền tảng.
- [x] UI vật tư và tái sử dụng bố cục example, tách dữ liệu thật khỏi mock.
- [x] UI bàn giao và chủ thể.
- [x] Tích hợp, áp dụng migration và nghiệm thu.

## 10. Hợp đồng đã triển khai

Provider phát triển gọi `POST /rest/v1/rpc/<tên RPC>` qua adapter `src/project/*/api`, dùng Auth UUID hiện tại:

| RPC                              | Đầu vào chính                                                           | Kết quả                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `list_custodians`                | `p_include_inactive`                                                    | Danh sách chủ thể, liên kết tài khoản/đại diện                                                    |
| `save_custodian`                 | `p_id`, `p_values`                                                      | UUID chủ thể                                                                                      |
| `list_custodian_account_options` | Không                                                                   | Tài khoản active để người có quyền cấu hình đại diện lựa chọn                                     |
| `list_materials`                 | `p_filters`                                                             | `{items,total,page,pageSize}`; lọc mẫu/nhóm/owner/borrower/tình trạng/trạng thái/search           |
| `get_material`                   | `p_id`                                                                  | Hồ sơ và hiện trạng, phiếu đang đặt giữ                                                           |
| `save_material`                  | `p_id`, `p_expected_version`, `p_values`                                | UUID; mã bất biến, state không sửa trực tiếp                                                      |
| `preview_material_model_sync`    | `p_id`                                                                  | Snapshot trước/sau, trường đổi, chỉnh riêng giữ lại, `modelUpdatedAt`                             |
| `apply_material_model_sync`      | `p_id`, `p_expected_version`, `p_expected_model_updated_at`             | UUID; chặn nếu mẫu/vật tư đổi sau xem trước hoặc thông số chỉnh riêng không còn tương thích       |
| `list_material_history`          | `p_material_id`                                                         | Giá trị trước/sau, actor, thời gian                                                               |
| `list_handovers`                 | `p_filters`                                                             | `{items,total,page,pageSize}`; lọc loại/trạng thái/hai bên/ngày/vật tư/search                     |
| `get_handover`                   | `p_id`                                                                  | Phiếu và snapshot dòng, chủ thể, đại diện, tệp                                                    |
| `save_handover`                  | `p_id`, `p_values` (`expectedVersion` khi sửa)                          | UUID; lưu nháp và đặt giữ nguyên tử                                                               |
| `act_on_handover`                | `p_id`, `p_action`, `p_expected_version`, `p_note`, `p_item_conditions` | UUID; `send/confirm/reject/cancel`; confirm toàn bộ, có thể xác nhận tình trạng riêng từng vật tư |
| `list_handover_history`          | `p_handover_id`                                                         | Các bước xử lý và người thực hiện                                                                 |

Các trường lõi của chủ thể luôn là `id/code/name/type`. `parentId` mô tả mọi cấp; `accountUserId` và `representativeUserId` xác định người được thao tác thay mặt chủ thể. Người đại diện trên phiếu lấy từ phân công này, không tự cấp quyền từ dữ liệu nhập trên phiếu.

Quyền: `materials:material:view/manage`, `materials:handover:view/manage`, `materials:custodian:view/manage`. Frontend dùng constants; RPC kiểm tra quyền và quan hệ đại diện ở server. Các bảng vật tư/phiếu/lịch sử không cấp DML trực tiếp cho browser. QR hiện mở trang yêu cầu đăng nhập; chưa cung cấp hồ sơ công khai.

Ảnh mẫu lưu tham chiếu storage ổn định trong snapshot; URL ký được tạo khi đọc. Ảnh chỉnh riêng giai đoạn này nhận URL ảnh HTTP(S), có xem trước và khôi phục theo mẫu. Upload ảnh thực tế thành bộ ảnh riêng là phần mở rộng tiếp theo, không có nút upload giả.

## 11. Bằng chứng nghiệm thu

- Project ref đã đối chiếu từ `SUPABASE_DB_URL`; lịch sử ban đầu đầy đủ đến `20261016075906`.
- Migration nền tảng `20261019030539` được chạy thử cùng workflow trong transaction và rollback thành công, sau đó mới áp dụng và ghi migration history.
- Sáu bảng domain đều bật RLS; `authenticated` không có UPDATE trực tiếp vật tư; `anon` không được gọi mutation; helper nội bộ không được cấp EXECUTE; RPC nghiệp vụ cấp cho authenticated và tự kiểm tra quyền.
- SQL workflow: draft đặt giữ ngay, chặn draft trùng, send/confirm, double confirm không lặp lịch sử, cho mượn giữ owner, trả vật tư hỏng, hủy giải phóng đặt giữ, phiếu nhiều dòng không để lại cập nhật một phần, chuyển sở hữu toàn bộ, mẫu không tự cập nhật, sync chủ động, chứng từ giữ tên cũ.
- Hai migration bổ sung `20261019032025` và `20261019032253` đã được chạy thử cùng SQL workflow/authorization trong transaction rồi rollback trước khi áp dụng theo thứ tự. Chúng bổ sung chọn tài khoản đại diện theo quyền, tên người thao tác trong lịch sử, sắp xếp tiếng Việt, kiểm tra chủ thể active khi gửi/nhận và cho phép hủy/từ chối để giải phóng đặt giữ khi chủ thể ngừng hoạt động.
- Seed dev gồm bốn chủ thể `DEV-OPS`, `DEV-MAINT`, `DEV-PERSON`, `DEV-PARTNER`, gắn đại diện từ tài khoản system admin có sẵn. Không tạo vật tư hay phiếu giả tồn dư; toàn bộ dữ liệu workflow/authorization thử nghiệm được rollback.
- SQL authorization qua `SET LOCAL ROLE authenticated/anon`: không đại diện bị chặn, tài khoản mất quyền bị chặn, anonymous bị chặn, phiên bản cũ bị chặn và không đổi được mã vật tư. Thay đổi quyền dùng cho test cũng đã rollback.
- Kiểm tra tập trung: **7 file, 14 test passed**. Bao gồm API payload/version, validation nghiệp vụ, render trang tạo/chi tiết vật tư và chi tiết bàn giao dưới `DetailEntryLayout` thật để kiểm tra vòng lặp toolbar.
- Focused import lint trên toàn bộ file TypeScript thay đổi: passed. `npm run build`: passed. `git diff --check`: passed.
- `npx tsc -p tsconfig.app.json --noEmit` còn lỗi ở các phần khác của repo; không có diagnostic trong `src/project/materials`, `src/project/handover`, `src/project/custodians` hay các file tích hợp route/layout/i18n thay đổi. Lệnh `npx tsc --noEmit` ở tsconfig gốc chỉ có project references, không đủ để đánh giá kiểu toàn app, vì vậy đã chạy kiểm tra trực tiếp app project.
- Browser tại dev server `https://localhost:5175`: danh sách vật tư hiển thị empty state thật, form tạo tải mẫu hiện có và thông số kế thừa, form bàn giao tải bốn chủ thể đại diện và hiển thị validation khi thiếu bên nhận/ngày/vật tư. Không phát hiện ReferenceError hay vòng lặp toolbar trong các tương tác này. Browser chưa tạo chứng từ thật; nghiệp vụ hoàn tất chứng từ được kiểm tra bằng SQL rollback.
