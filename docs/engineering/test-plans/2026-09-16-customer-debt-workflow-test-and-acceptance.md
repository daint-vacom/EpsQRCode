# Quy trình test và nghiệm thu nghiệp vụ công nợ khách hàng

- Ngày soạn: 2026-09-16
- Trạng thái: **Đã hoàn tất test 4 luồng chính — đạt sau sửa lỗi; ma trận edge-case mở rộng ghi riêng**
- Phạm vi: công nợ khách hàng, hợp đồng, phiếu thu, ứng trước, báo cáo và sổ quỹ/tài khoản
- Môi trường thực hiện: `dev`, ứng dụng đang chạy tại `http://localhost:5174`, sử dụng database dev
- Quyền thao tác dữ liệu: được phép tạo dữ liệu test trong database dev
- Sau test: **giữ nguyên toàn bộ dữ liệu test, không xóa/rollback**

### Nhật ký phê duyệt và vận hành

- Ngày 2026-09-16: người dùng xác nhận có thể tiến hành test ngay trên môi trường dev/port 5174.
- Dữ liệu test sẽ dùng mã `*-TEST-*` để phân biệt và được giữ lại sau khi kết thúc.
- Nếu phát hiện hoặc nghi ngờ sai nghiệp vụ mức P0/P1, dừng nhánh liên quan, bảo toàn dữ liệu và báo ngay trong quá trình chạy.

### Nhật ký chạy test (cập nhật trong quá trình thực hiện)

- `CN-01`: đã ghi nhận thành công công nợ `CN-TEST-001-260916` cho Trần Ngọc Mai, gốc 10.000 VND, hạn 15/09/2026.
- `CN-03` lần 1: phiếu thu 4.000 VND đã ghi nhận; công nợ hiển thị đã trả 4.000 VND, còn 6.000 VND; số dư tài khoản tăng từ 121.000 lên 125.000 VND.
- Phát hiện lỗi P1: chi tiết phiếu thu `20260916-000005` đã phân bổ đủ 6.000 VND nhưng hiển thị “Còn khả dụng: 6.000 VND” thay vì 0 VND. Công nợ và số dư tài khoản lõi đang hiển thị đúng.
- Theo yêu cầu trong quá trình test: đã dừng CN-02 để xử lý lỗi này trước khi tiếp tục. Nguyên nhân xác nhận: `loadFinanceVoucherDetail()` chỉ đọc `finance_voucher_line_allocation_drafts`, trong khi sau khi ghi nhận phiếu dữ liệu đã chuyển sang `finance_allocations` và draft bị xóa.
- Đã sửa: đọc cả allocation đã ghi nhận và draft, sau đó tính `Còn khả dụng = Số tiền dòng - Đã phân bổ - Đã hoàn`, tối thiểu bằng 0; thêm regression test.
- Retest sau sửa: đạt. UI phiếu `20260916-000005` hiển thị `Còn khả dụng: 0 VND`; test model 4/4 đạt, TypeScript đạt, import lint đạt. Đã tiếp tục CN-02.
- CN-04: lưu nháp và ghi nhận ứng trước `20260916-000006` thành công sau khi sửa `advanceScope`; số dư tài khoản tăng đúng 3.000 VND, công nợ vẫn 8.000 VND.
- Phát hiện lỗi P1 và dừng CN-04: hệ thống hiển thị ứng trước còn khả dụng 3.000 VND nhưng chưa có luồng “Dùng ứng trước” để phân bổ vào công nợ hợp đồng. Đã ghi riêng tại `test/customer-advance-allocation-missing.md`.
- Đã sửa và retest CN-04: thêm RPC/API và thao tác `Dùng ứng trước` từ chi tiết phiếu; phân bổ 3.000 VND thành công, không tạo phiếu/biến động tiền mới, sau reload hiển thị khả dụng 0 VND.
- Phát hiện lỗi P1 phụ trong retest: sau khi phân bổ thành công, UI chưa cập nhật ngay dù DB đã ghi đúng; đã đổi từ invalidate sang refetch các query đang hoạt động. Tạo phiếu `20260916-000007` 1.000 VND và phân bổ trong cùng phiên; UI đổi ngay từ khả dụng 1.000 xuống 0 VND. Đã ghi bổ sung trong `test/customer-advance-allocation-missing.md`.
- Negative path CN-04: phiếu `20260916-000008` có 500 VND khả dụng; nhập phân bổ 600 VND bị backend từ chối, không tạo allocation và không đổi số liệu. Thông báo tiếng Anh phát hiện trong lần đầu đã được Việt hóa và retest đạt.
- Đối soát cuối sau khi giữ lại cả dữ liệu negative test: tổng quan khách hàng là phát sinh 18.000 VND, đã thanh toán 14.000 VND, còn phải thu 4.000 VND, quá hạn 0 VND; công nợ hợp đồng hiển thị gốc 8.000 VND, đã trả 4.000 VND, còn nợ 4.000 VND.
- Sổ quỹ/tài khoản test `E2E-260913-CASH`: số dư cuối 135.500 VND (= 121.000 + 10.000 thanh toán công nợ + 3.000 ứng trước + 1.000 ứng trước + 500 ứng trước negative test); báo cáo tài khoản/dòng tiền có đúng 8 phiếu đã ghi nhận, phân bổ ứng trước không tạo phiếu hay biến động mới.

### Kết quả thực thi tạm thời

| Case  | Kết quả hiện tại                       | Bằng chứng chính                                                                                                                                                                                                                  |
| ----- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CN-01 | Pass                                   | `CN-TEST-001-260916`, gốc 10.000 VND, đúng khách hàng, không tạo tiền.                                                                                                                                                            |
| CN-02 | Pass                                   | `HD-TEST-CN-001-260916` tạo kỳ dự kiến; `HD-TEST-CN-002-260916` tạo công nợ thực tế 8.000 VND.                                                                                                                                    |
| CN-03 | Pass                                   | Phiếu `20260916-000004` 4.000 VND và `20260916-000005` 6.000 VND; công nợ thủ công về 0, tài khoản tăng đúng.                                                                                                                     |
| CN-04 | Pass phần lõi và negative path đã chạy | Phiếu `20260916-000006` phân bổ 3.000 VND; `20260916-000007` phân bổ 1.000 VND và UI cập nhật ngay; `20260916-000008` từ chối phân bổ vượt mức. Tổng hợp khách hàng, công nợ, báo cáo dòng tiền và sổ tài khoản đã đối soát khớp. |

Dữ liệu kiểm thử của cả lỗi ban đầu, bản sửa và retest được giữ nguyên trên dev; không xóa hoặc rollback.

### Đối soát migration và cảnh báo nền tảng

- Migration `20260916074019_finance_advance_allocation` đã có trong lịch sử migration của database dev.
- RPC `public.allocate_finance_advance(uuid,uuid,uuid,numeric,date,text)` tồn tại và quyền `authenticated` được phép thực thi; RPC tự kiểm tra quyền nghiệp vụ và các ràng buộc dữ liệu.
- Supabase Advisor còn các cảnh báo bảo mật/hiệu năng nền tảng đã tồn tại ở nhiều bảng và function khác; không có cảnh báo mới làm sai dữ liệu của bốn luồng test này. Các cảnh báo nền tảng được tách khỏi kết luận nghiệm thu nghiệp vụ.

## 1. Mục tiêu

Xác nhận bốn quy trình nghiệp vụ sau hoạt động đúng từ giao diện đến dữ liệu và các màn hình tổng hợp:

1. Thêm công nợ ngoài hợp đồng cho khách hàng.
2. Thêm hợp đồng có phát sinh công nợ cho khách hàng.
3. Thanh toán công nợ đã phát sinh của khách hàng.
4. Thanh toán trước công nợ/ứng trước của khách hàng.

Mỗi quy trình phải được kiểm tra cả:

- Luồng thao tác và validation trên giao diện.
- Công nợ, hợp đồng, phiếu thu và phân bổ thanh toán được cập nhật đúng.
- Số dư và biến động sổ quỹ/tài khoản đúng, không ghi nhận trùng.
- Thống kê, kế hoạch thu tiền, báo cáo công nợ và lịch sử giao dịch hiển thị đúng.
- Phân quyền, trạng thái nháp/ghi nhận và khả năng chống thao tác lặp.

Tài liệu này là kế hoạch kiểm thử/nghiệm thu và nhật ký kết quả đang chạy. Dữ liệu test được tạo trên dev theo xác nhận của người dùng và được giữ nguyên; một lỗi hiển thị đã được sửa và retest đạt trong cùng phiên kiểm thử.

## 2. Nguyên tắc nghiệp vụ dùng làm chuẩn nghiệm thu

Các nguyên tắc dưới đây là chuẩn nghiệp vụ để phân biệt lỗi phần mềm với hành vi đúng:

| Nguyên tắc                           | Kỳ vọng                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Công nợ và tiền là hai sự kiện riêng | Tạo công nợ không tự làm tăng/giảm số dư quỹ hoặc tài khoản.                                                                                |
| Phiếu thu là sự kiện tiền            | Chỉ phiếu đã ghi nhận mới làm thay đổi số dư tài khoản. Phiếu nháp không làm thay đổi số dư.                                                |
| Phân bổ là quan hệ thanh toán        | Phân bổ làm giảm công nợ; bản thân phân bổ không tạo thêm biến động tiền.                                                                   |
| Thanh toán công nợ                   | Phiếu thu phải là `receipt`, dòng phải xử lý `settlement`, tổng phân bổ bằng số tiền dòng và không vượt số còn nợ.                          |
| Ứng trước                            | Phiếu thu phải là tiền đã nhận nhưng chưa/không gắn vào công nợ tại thời điểm nhận. Ứng trước không được làm giảm công nợ khi chưa phân bổ. |
| Thanh toán một phần                  | `Đã thanh toán + Còn phải thu = Giá trị công nợ`, sai số làm tròn bằng 0.                                                                   |
| Thanh toán đủ                        | Công nợ còn phải thu bằng 0; không tạo số âm hoặc cho thanh toán vượt mức.                                                                  |
| Dữ liệu lịch sử                      | Ghi nhận rồi không được biến mất hoặc bị sửa ngầm khi đổi tên khách hàng, khoản mục, tài khoản hay hợp đồng.                                |
| Ngày hiệu lực                        | Báo cáo lấy ngày chứng từ/ngày giao dịch theo quy ước của sổ, không phụ thuộc tùy tiện vào ngày trình duyệt.                                |

## 3. Chuẩn bị môi trường và dữ liệu test

### 3.1. Tài khoản và quyền

Chuẩn bị ít nhất hai người dùng:

- **User nghiệp vụ đầy đủ quyền**: xem/tạo công nợ, tạo/ghi nhận phiếu thu, xem tài khoản, xem báo cáo và xem hợp đồng.
- **User thiếu quyền**: dùng để kiểm tra không hiển thị hoặc không cho thực hiện thao tác vượt quyền.

Các quyền cần đối chiếu trong môi trường thực tế gồm tối thiểu:

- `finance:obligation:view`, `finance:obligation:create`.
- `finance:voucher:view`, `finance:voucher:create`, `finance:voucher:post`.
- `finance:account:view`, `finance:report:view`.
- Quyền xem/tạo/ghi nhận hợp đồng tương ứng với cấu hình hiện tại.

### 3.2. Bộ dữ liệu đề nghị

Tạo bộ dữ liệu riêng, có mã dễ truy vết và không dùng khách hàng thật:

| Đối tượng        | Mã/giá trị đề nghị                                                              | Mục đích                                           |
| ---------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| Khách hàng       | `KH-TEST-CN-001`                                                                | Đối tượng xuyên suốt bốn luồng                     |
| Tài khoản tiền   | `TK-TEST-CN-001`, VND, đang hoạt động                                           | Kiểm tra biến động và số dư                        |
| Số dư đầu kỳ     | Ví dụ 100.000.000 VND                                                           | Có mốc đối chiếu trước/sau                         |
| Khoản mục        | Thu công nợ; Ứng trước nếu có                                                   | Kiểm tra snapshot khoản mục                        |
| Công nợ ngoài HĐ | `CN-TEST-001`, 10.000.000 VND                                                   | Kiểm tra tạo thủ công và thanh toán một phần       |
| Hợp đồng         | `HD-TEST-CN-001`                                                                | Có tối thiểu một kỳ đã đến hạn và một kỳ tương lai |
| Kỳ hợp đồng      | Ví dụ 12.000.000 VND, hạn kỳ 1 là hôm nay hoặc trước hôm nay; kỳ 2 là tương lai | Kiểm tra phát sinh, liên kết và quy tắc đến hạn    |
| Ứng trước        | `PT-TEST-001`, 3.000.000 VND                                                    | Tạo trước khi có khoản nợ cần phân bổ              |

Số tiền/ngày có thể thay đổi theo dữ liệu thực tế, nhưng phải ghi lại chính xác trong biên bản chạy test. Nếu môi trường không cho chọn ngày quá khứ/tương lai hoặc chưa có cơ chế sinh kỳ hợp đồng, phải ghi nhận ngay là điều kiện môi trường hoặc điểm cần xác minh, không tự điều chỉnh bằng SQL.

### 3.3. Ảnh chụp số liệu trước test

Trước mỗi nhóm test, ghi lại:

- Số dư tài khoản test.
- Danh sách công nợ và tổng còn phải thu của khách hàng.
- Tổng đã phát sinh, đã thanh toán, còn phải thu, quá hạn trên tổng quan khách hàng.
- Số lượng và tổng tiền phiếu thu trong kỳ.
- Số liệu báo cáo công nợ, dòng tiền và sổ tài khoản trong cùng khoảng ngày.

## 4. Phạm vi màn hình và dữ liệu cần đối chiếu

| Khu vực                | Nội dung kiểm tra                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Khách hàng → Tổng quan | Tình hình thanh toán, tổng phát sinh, đã thanh toán, còn phải thu, quá hạn, danh sách công nợ và kế hoạch thu tiền. |
| Khách hàng → Công nợ   | Dòng công nợ, nguồn công nợ, ngày/hạn, số tiền, đã trả, còn phải thu, thao tác xem và thanh toán.                   |
| Khách hàng → Hợp đồng  | Hợp đồng và số liệu phải thu theo hợp đồng/kỳ.                                                                      |
| Sổ thu chi             | Phiếu thu, trạng thái, đối tượng, tài khoản, tổng tiền, khoản mục và chi tiết phiếu.                                |
| Chi tiết phiếu         | Cách xử lý dòng, công nợ được phân bổ, số tiền và số tiền còn khả dụng.                                             |
| Báo cáo công nợ        | Nghĩa vụ, đã thanh toán, còn phải thu, quá hạn theo khách hàng và theo nguồn.                                       |
| Báo cáo dòng tiền      | Phiếu thu theo ngày, khoản mục, đối tượng và cách xử lý.                                                            |
| Sổ quỹ & Tài khoản     | Biến động vào/ra, số dư đầu kỳ, số dư chạy, tổng thu/chi và liên kết về phiếu.                                      |
| Dữ liệu/API/DB khi cần | Chỉ dùng để đối chiếu định danh và quan hệ, không dùng để hoàn thành thay thao tác giao diện nếu chưa được duyệt.   |

Lưu ý trước test: màn chi tiết khách hàng hiện có các tab Tổng quan, Công nợ, Hợp đồng, Nhân viên phụ trách và Tài khoản phần mềm; chưa thấy một tab “Lịch sử” riêng trong cấu trúc giao diện hiện tại. Vì vậy kế hoạch sẽ kiểm tra lịch sử qua Sổ thu chi/chi tiết phiếu và các báo cáo. Nếu yêu cầu nghiệm thu bắt buộc lịch sử phải nằm ngay trong hồ sơ khách hàng, đây là điểm cần chốt trước khi kết luận đạt.

## 5. Kịch bản kiểm thử chính

### CN-01 — Thêm công nợ ngoài hợp đồng

**Tiền điều kiện:** khách hàng test tồn tại; user có quyền tạo công nợ; chưa có bản ghi mã `CN-TEST-001`.

**Thao tác:**

1. Mở chi tiết `KH-TEST-CN-001` → tab Công nợ.
2. Chọn thêm công nợ.
3. Nhập mã, diễn giải, ngày ghi nhận, hạn thanh toán và 10.000.000 VND.
4. Lưu/ghi nhận.
5. Tải lại trang và mở chi tiết công nợ.

**Kết quả mong đợi:**

- Công nợ được tạo một lần, đúng khách hàng, đúng nguồn ngoài hợp đồng/thủ công, đúng chiều phải thu.
- Giá trị gốc 10.000.000 VND; đã thanh toán 0; còn phải thu 10.000.000 VND.
- Công nợ xuất hiện ở tab Công nợ, tổng quan khách hàng và báo cáo công nợ nếu ngày lọc bao phủ bản ghi.
- Không tạo phiếu thu, phân bổ thanh toán hoặc biến động tài khoản.
- Số dư tài khoản không đổi.
- Nếu hạn đã qua thì phần quá hạn tăng đúng; nếu hạn tương lai thì chưa được tính là quá hạn.
- Mã công nợ trùng, số tiền bằng 0/âm, thiếu diễn giải hoặc thiếu ngày bắt buộc phải bị chặn bằng thông báo rõ ràng.

### CN-02 — Thêm hợp đồng có phát sinh công nợ

**Tiền điều kiện:** khách hàng test tồn tại; có quyền quản lý hợp đồng; cơ chế sinh kỳ/hóa đơn phí hợp đồng hoạt động trong môi trường.

**Thao tác:**

1. Tạo hợp đồng `HD-TEST-CN-001` cho `KH-TEST-CN-001` với khoản phí phải thu.
2. Hoàn tất trạng thái/lifecycle theo quy trình chuẩn để hợp đồng được phép phát sinh kỳ.
3. Chờ hoặc kích hoạt cơ chế sinh kỳ theo cách người dùng được phép sử dụng.
4. Đảm bảo có một kỳ đã đến hạn và một kỳ tương lai.
5. Kiểm tra chi tiết hợp đồng, tab Công nợ khách hàng, Tổng quan khách hàng và báo cáo công nợ.

**Kết quả mong đợi:**

- Kỳ phát sinh tạo đúng công nợ nguồn hợp đồng, liên kết đúng `contract_id` và khoản phí/kỳ tương ứng.
- Không tạo công nợ chỉ vì hợp đồng mới ở trạng thái dự thảo hoặc kỳ chưa đến điều kiện phát sinh.
- Kỳ đã đến hạn xuất hiện trong công nợ thực tế; kỳ tương lai được xử lý đúng theo quy ước kế hoạch thu tiền và không bị tính nhầm là công nợ đến hạn.
- Số liệu hợp đồng, khách hàng và báo cáo công nợ cùng phản ánh một nguồn dữ liệu, không nhân đôi theo số màn hình.
- Việc phát sinh công nợ không tạo biến động tiền hoặc phiếu thu.
- Đổi tên khách hàng/hợp đồng/khoản mục sau khi phát sinh không làm mất liên kết và không làm thay đổi sai lịch sử đã ghi nhận.

### CN-03 — Thanh toán công nợ đã phát sinh

Thực hiện cả thanh toán một phần và thanh toán phần còn lại.

**Thao tác:**

1. Từ dòng `CN-TEST-001` hoặc kỳ hợp đồng đã đến hạn, chọn thanh toán.
2. Nhập lần 1: 4.000.000 VND, chọn tài khoản test, ngày thu và mã giao dịch `PT-TEST-002`.
3. Ghi nhận phiếu thu.
4. Tải lại khách hàng, công nợ, sổ thu chi và các báo cáo.
5. Thanh toán phần còn lại 6.000.000 VND bằng một phiếu thu khác.
6. Mở chi tiết cả hai phiếu và đối chiếu phân bổ.

**Kết quả mong đợi sau lần 1:**

- Có đúng một phiếu thu đã ghi nhận, đúng khách hàng/tài khoản/ngày/số tiền.
- Dòng phiếu xử lý thanh toán công nợ; tổng phân bổ đúng 4.000.000 VND vào đúng công nợ.
- Công nợ: đã thanh toán 4.000.000 VND, còn phải thu 6.000.000 VND.
- Số dư tài khoản tăng đúng 4.000.000 VND một lần; có một biến động liên kết về phiếu.
- Không làm thay đổi công nợ của khách hàng khác hoặc hợp đồng khác.

**Kết quả mong đợi sau lần 2:**

- Công nợ còn phải thu bằng 0, không âm; tổng thanh toán bằng giá trị gốc.
- Hai phiếu và hai phân bổ đều truy vết được; không bị gộp/mất lịch sử.
- Số dư tài khoản tăng tổng cộng 10.000.000 VND so với trước CN-03.
- Tổng quan, danh sách công nợ, báo cáo công nợ, dòng tiền và sổ tài khoản cùng khớp số liệu.

**Kiểm tra chặn lỗi:** thử nhập số tiền lớn hơn số còn phải thu, bằng 0, âm, bỏ tài khoản hoặc bỏ khoản mục. Không được tạo phiếu đã ghi nhận hoặc làm thay đổi số dư khi validation thất bại.

### CN-04 — Thanh toán trước công nợ/ứng trước

**Mục tiêu:** xác nhận tiền ứng trước được tách khỏi thanh toán công nợ và có thể sử dụng về sau.

**Thao tác:**

1. Trước khi có công nợ mục tiêu, lập phiếu thu cho `KH-TEST-CN-001` 3.000.000 VND.
2. Chọn khoản mục ứng trước, cách xử lý `advance`, phạm vi ứng trước theo khách hàng hoặc hợp đồng theo nghiệp vụ đã chốt.
3. Lưu nháp, kiểm tra chưa có biến động tiền, sau đó ghi nhận.
4. Kiểm tra phiếu, chi tiết dòng, số dư tài khoản, báo cáo dòng tiền và phần tổng hợp công nợ.
5. Tạo/phát sinh một công nợ phải thu 8.000.000 VND cho cùng khách hàng.
6. Dùng chức năng phân bổ tiền ứng trước vào công nợ 3.000.000 VND nếu giao diện có hỗ trợ.
7. Kiểm tra lại phiếu ứng trước, công nợ, báo cáo và sổ tài khoản.

**Kết quả mong đợi:**

- Khi ghi nhận phiếu ứng trước: số dư tài khoản tăng 3.000.000 VND; có một phiếu thu và một biến động tiền.
- Dòng phiếu có cách xử lý ứng trước; chưa có phân bổ thì không làm giảm công nợ nào.
- Khi phân bổ về sau: công nợ 8.000.000 VND giảm còn 5.000.000 VND; số tiền ứng trước khả dụng giảm 3.000.000 VND.
- Bước phân bổ về sau không tạo thêm biến động tiền hoặc phiếu thu mới.
- Ứng trước không bị tính đồng thời là doanh thu và thanh toán công nợ nếu nghiệp vụ chưa xác nhận điều đó.
- Không cho phân bổ ứng trước sai khách hàng, sai hợp đồng/phạm vi, vượt số khả dụng hoặc vượt số còn nợ.

**Điểm cần xác minh khi chạy:** nếu giao diện chỉ cho tạo dòng `advance` nhưng chưa có thao tác sử dụng/phân bổ ứng trước về sau, dừng nhánh này tại bằng chứng đó và báo ngay là nghi vấn thiếu luồng nghiệp vụ. Không dùng insert/update trực tiếp trong DB để biến một luồng chưa có thành “đạt”.

## 6. Kiểm tra thống kê và lịch sử sau mỗi giao dịch

### 6.1. Tổng quan khách hàng

Đối chiếu trước/sau theo công thức:

- `Tổng đã phát sinh` tăng khi công nợ hợp đồng/thủ công được ghi nhận, không tăng khi chỉ nhận ứng trước.
- `Đã thanh toán` tăng đúng phần đã phân bổ vào công nợ.
- `Còn phải thu = Tổng đã phát sinh - Đã thanh toán`.
- `Quá hạn` chỉ gồm phần còn nợ có hạn thanh toán đã qua.
- Phần trăm đã thanh toán không vượt 100% và không giảm bất thường sau reload.
- Danh sách công nợ không nhân đôi công nợ hợp đồng có nhiều thành phần/khoản phí.
- Kế hoạch thu tiền phân biệt khoản đã đến hạn, hiện tại, quá hạn và tương lai theo ngày báo cáo.

### 6.2. Lịch sử giao dịch khách hàng

- Phiếu thu phải truy được từ sổ thu chi theo số phiếu, ngày, khách hàng, số tiền và mã giao dịch.
- Chi tiết phiếu phải hiển thị khoản mục, cách xử lý, số tiền và số tiền còn khả dụng.
- Công nợ phải truy được nguồn phát sinh, hợp đồng/kỳ nếu có, các lần thanh toán và số còn lại.
- Nếu không có lịch sử giao dịch ngay trong màn chi tiết khách hàng, ghi rõ phạm vi lịch sử đã kiểm tra qua Sổ thu chi và chi tiết phiếu; không tuyên bố “lịch sử khách hàng đầy đủ” nếu yêu cầu sản phẩm bao gồm một màn riêng.

### 6.3. Sổ quỹ/tài khoản và báo cáo

Đối chiếu cùng một khoảng ngày và cùng tài khoản:

- Biến động tiền vào của từng phiếu thu.
- Tổng thu trong báo cáo dòng tiền.
- Số dư chạy và số dư cuối kỳ trên sổ tài khoản.
- Số lượng phiếu và số lượng biến động.
- Liên kết từ dòng sổ về phiếu, đối tượng và nội dung.
- Không có biến động cho công nợ chưa thanh toán, phiếu nháp hoặc thao tác validation thất bại.

## 7. Kiểm thử biên và kiểm soát rủi ro

Chạy các trường hợp sau nếu không bị giới hạn bởi dữ liệu/môi trường:

| Nhóm          | Trường hợp                                                                    | Kỳ vọng                                                                         |
| ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Tiền          | 0, âm, quá nhiều chữ số thập phân, giá trị rất lớn                            | Bị chặn hoặc làm tròn theo quy ước; không sai số số học.                        |
| Thanh toán    | Thanh toán vượt còn nợ; thanh toán lặp bằng double-click/retry                | Không vượt nợ, không ghi trùng phiếu/biến động.                                 |
| Ngày          | Hạn hôm nay, hạn hôm qua, hạn tương lai, ngày giao dịch khác ngày tạo         | Phân loại đúng và truy được ngày hiệu lực.                                      |
| Trạng thái    | Lưu nháp, reload, ghi nhận, thử sửa phiếu đã ghi nhận                         | Nháp chưa tác động tiền; phiếu đã ghi nhận không bị sửa/xóa ngầm.               |
| Đối tượng     | Chọn công nợ của khách hàng khác; đổi khách hàng giữa chừng                   | Bị chặn, không phân bổ sai đối tượng.                                           |
| Tài khoản     | Tài khoản ngừng hoạt động; số dư không đủ cho phiếu chi nếu có test chiều chi | Không cho ghi nhận giao dịch không hợp lệ.                                      |
| Khoản mục     | Khoản mục ngừng hoạt động hoặc sai chiều thu/chi                              | Không cho ghi nhận sai chiều.                                                   |
| Phân quyền    | User chỉ được xem; user được tạo nhưng không được ghi nhận                    | Ẩn/chặn đúng nút và backend vẫn từ chối nếu gọi trực tiếp.                      |
| Đồng thời     | Hai phiên cùng thanh toán phần còn lại                                        | Một giao dịch hợp lệ; giao dịch còn lại bị từ chối hoặc cập nhật lại số còn nợ. |
| Cô lập tenant | Dùng ID dữ liệu tenant khác nếu có thể kiểm tra                               | Không đọc/ghi chéo tenant.                                                      |

## 8. Tiêu chí nghiệm thu

### Đạt

- Bốn luồng chính hoàn thành bằng thao tác người dùng hợp lệ.
- Các giá trị công nợ, thanh toán, còn phải thu và quá hạn khớp công thức và khớp giữa các màn hình.
- Các quan hệ khách hàng–hợp đồng–kỳ–công nợ–phiếu–phân bổ–tài khoản truy vết được.
- Số dư tài khoản và biến động tiền chỉ thay đổi đúng tại thời điểm phiếu được ghi nhận.
- Không phát hiện lỗi mức chặn luồng hoặc sai số liệu tài chính.
- Các lỗi còn lại (nếu có) không ảnh hưởng dữ liệu, không sai nghiệp vụ và có kế hoạch xử lý được duyệt.

### Không đạt / cần dừng và báo ngay

Dừng nhánh test liên quan và báo ngay nếu gặp một trong các dấu hiệu:

- Tạo công nợ làm thay đổi số dư tiền dù chưa có phiếu thu.
- Phiếu thu đã ghi nhận nhưng không có biến động tài khoản, hoặc tạo nhiều biến động cho một lần ghi nhận.
- Thanh toán vượt công nợ, làm số dư âm hoặc phân bổ sang sai khách hàng/hợp đồng.
- Ứng trước bị tính ngay là đã thanh toán công nợ, hoặc phân bổ ứng trước tạo thêm tiền mới.
- Tổng quan, lịch sử, báo cáo và sổ tài khoản lấy các nguồn khác nhau dẫn đến số liệu mâu thuẫn.
- Reload/truy cập lại làm mất phiếu, công nợ, phân bổ hoặc thay đổi số tiền đã ghi nhận.
- Backend chấp nhận dữ liệu mà giao diện đáng lẽ phải chặn, đặc biệt với tenant, quyền, trạng thái và số tiền.
- Có dấu hiệu sai với quy trình nghiệp vụ chuẩn; không tự sửa dữ liệu để tiếp tục.

## 9. Cách ghi nhận bằng chứng và báo lỗi

Mỗi case ghi tối thiểu:

- Mã case, thời điểm, user, tenant và môi trường.
- Dữ liệu đầu vào, số liệu trước test và số liệu sau từng bước.
- Mã khách hàng, mã hợp đồng, mã công nợ, số phiếu, mã giao dịch, ID tài khoản và ID phân bổ nếu hiển thị.
- Ảnh/video ngắn ở bước lỗi và màn hình đối chiếu liên quan.
- Kết quả thực tế, kết quả mong đợi, mức độ ảnh hưởng và khả năng tái hiện.
- Nếu cần kiểm tra API/DB: câu truy vấn hoặc endpoint dùng để đối chiếu, không ghi mật khẩu/secret và không thay đổi dữ liệu nếu chưa được duyệt.

Phân loại ban đầu:

- **P0 — Chặn nghiệm thu:** sai tiền, mất dữ liệu, ghi trùng, sai tenant/quyền, không thể hoàn tất luồng chính.
- **P1 — Lỗi nghiệp vụ nghiêm trọng:** luồng hoàn tất nhưng công nợ/báo cáo/lịch sử/sổ tài khoản sai.
- **P2 — Lỗi chức năng hoặc hiển thị:** sai nhãn, thiếu liên kết, lọc hoặc hiển thị không nhất quán nhưng dữ liệu lõi đúng.
- **P3 — Cải thiện:** UX, copy hoặc bố cục không ảnh hưởng kết quả nghiệp vụ.

Khi phát hiện hoặc nghi ngờ P0/P1, báo ngay trong quá trình chạy, ghi trạng thái **Blocked/Needs investigation**, bảo toàn dữ liệu và không tiếp tục các bước có thể làm mất dấu vết.

## 10. Kết quả bàn giao sau khi được duyệt

Sau khi chạy, bàn giao:

1. Bảng kết quả từng case: Pass / Fail / Blocked / Not run.
2. Bảng đối chiếu số liệu trước–sau cho công nợ, phiếu, tài khoản và báo cáo.
3. Danh sách lỗi/nghi vấn, bằng chứng tái hiện và mức độ.
4. Kết luận nghiệm thu theo từng luồng và kết luận chung.
5. Các điểm chưa thể kiểm tra do thiếu quyền, thiếu dữ liệu, thiếu môi trường hoặc thiếu chức năng; không đánh dấu Pass thay thế.

## 11. Kết luận nghiệm thu

Bốn luồng nghiệp vụ chính đạt sau khi xử lý các lỗi phát hiện trong quá trình chạy. Công nợ, thanh toán, ứng trước, phân bổ, thống kê khách hàng, lịch sử phiếu, báo cáo công nợ, báo cáo dòng tiền và sổ quỹ/tài khoản đã được đối soát trên cùng bộ dữ liệu và khớp nhau.

Phạm vi chưa đánh dấu Pass: kiểm thử bằng user thiếu quyền, sai tenant, sai khách hàng/hợp đồng, thao tác gửi lặp đồng thời và kiểm tra số 0/âm ở các màn hình liên quan. Đây là phần mở rộng của ma trận kiểm thử, không làm thay đổi kết luận bốn luồng chính đã chạy.

## 12. Tài liệu tham chiếu nội bộ

- [Đặc tả Thu chi & Công nợ](../specs/2026-09-13-finance-vouchers-and-obligations.md)
- [Kế hoạch Contract Receivable](../plans/2026-08-25-contract-receivable-plan.md)
- [Đặc tả Contract và Receivables cũ](../../superpowers/specs/2026-08-15-contract-and-receivables-module-design.md)

## 13. Kết quả kiểm tra sau hardening migration

Ngày 16/09/2026, sau khi apply migration `20260916120000_harden_finance_write_contract.sql` vào dev database:

| Hạng mục                         | Kết quả | Bằng chứng                                                                                     |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| Canonical obligation shape       | Pass    | `effective_date` và `recognition_basis` tồn tại, đều `NOT NULL`; dữ liệu hiện hữu đã backfill. |
| Direct write vào công nợ đã post | Pass    | Authenticated role không còn `INSERT/UPDATE/DELETE`; trigger chặn update posted.               |
| RPC create obligation            | Pass    | Tạo được công nợ với snapshot đối tượng lấy từ server; test rollback không để lại probe data.  |
| Idempotent replay                | Pass    | Cùng `request_key` và payload trả cùng obligation ID; key khác payload bị thiết kế từ chối.    |
| Multi-line over-allocation       | Pass    | Hai dòng cùng phân bổ vượt tổng công nợ bị chặn; voucher giữ trạng thái `draft`.               |
| Sổ công nợ / sổ thu chi runtime  | Pass    | `/finance/obligations`, `/finance/vouchers` và form phiếu thu tải đúng trên port 5174.         |
| Regression/build                 | Pass    | 8 test files / 21 tests; TypeScript, import lint và production build đều đạt.                  |

Không phát hiện lỗi P0/P1 mới trong phạm vi hardening đã chạy. Các case concurrency, user thiếu quyền/sai tenant bằng nhiều phiên riêng, adjustment/reversal và kế toán tổng hợp vẫn là **Not run / phase tiếp theo**, không gắn nhãn Pass thay thế.

## 14. Kết quả triển khai tranche nền tảng Phase 2

Ngày 16/09/2026, migration `20260916140000_finance_period_and_as_of_read_models.sql` được dry-run và apply thành công trên dev database.

| Hạng mục                         | Kết quả            | Bằng chứng                                                                                                                               |
| -------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Khóa kỳ theo ngày hiệu lực       | Pass ở tầng DB/RPC | `finance_period_locks`, `close_finance_period` và guard trên obligation/voucher/movement/allocation tồn tại; probe khóa kỳ rollback đạt. |
| Phân bổ ứng trước theo ngày      | Pass ở contract    | Không cho phân bổ trước ngày source hoặc target; không cho phân bổ trong kỳ khóa; không tạo movement mới.                                |
| Read model công nợ tại ngày chốt | Pass ở contract    | RPC `get_finance_obligation_balances_as_of` lọc obligation và allocation theo `effective_date`, không dùng clamp số âm.                  |
| Read model ứng trước             | Pass ở contract    | RPC `get_finance_advance_balances_as_of` tách source line, đã dùng, đã hoàn và còn khả dụng theo ngày chốt.                              |
| Tổng quan khách hàng             | Pass ở contract/UI | RPC summary trả công nợ, ứng trước chưa phân bổ và tiền thu thực tế; tổng quan hiển thị hai chỉ số tách riêng.                           |
| Một dòng phân bổ nhiều công nợ   | Pass ở UI contract | Form phiếu giữ nhiều allocation rows; backend đã có aggregate validation trên toàn voucher.                                              |
| Regression                       | Pass               | TypeScript, focused import lint và 5 file model/customer/finance/component với 16 tests đạt.                                             |

Tranche này không đánh dấu hoàn tất cho UI adjustment/reversal/refund, reverse voucher, bank reconciliation và audit timeline; concurrency/security nhiều user, VAT/GL hoặc các quyết định kế toán cũng chưa được owner chốt. Dữ liệu test dev tiếp tục được giữ nguyên.

## 15. Kết quả nghiệm thu event subledger

Ngày 17/09/2026, năm migration additive `20260916150000_finance_subledger_events.sql`, `20260916151000_fix_finance_event_operation_links.sql`, `20260916152000_finance_canonical_obligation_detail_read_model.sql`, `20260916153000_finance_event_write_guards.sql` và `20260916154000_finance_allocation_write_guards.sql` đã được dry-run, apply và xác minh trên dev database.

| Hạng mục                    | Kết quả         | Bằng chứng                                                                                                                                        |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Điều chỉnh công nợ          | Pass ở contract | RPC ghi delta có ngày hiệu lực; giảm công nợ thấp hơn số đã phân bổ bị chặn; replay cùng key trả cùng kết quả.                                    |
| Đảo phân bổ                 | Pass ở contract | RPC ghi event đảo một phần, giữ allocation gốc và tính lại số đã phân bổ theo ngày chốt.                                                          |
| Hoàn ứng trước              | Pass ở contract | RPC tạo phiếu chi, line refund, movement out và refund link; số khả dụng trừ cả allocation/refund.                                                |
| Đảo phiếu                   | Pass ở contract | RPC tạo movement đảo chiều, đảo allocation liên quan và ghi metadata/event đảo.                                                                   |
| Audit timeline              | Pass ở contract | `finance_operations.actor_user_id` và RPC timeline trả operation/request/result theo tenant.                                                      |
| Bank reconciliation         | Pass            | Đã tạo tài khoản bank E2E; import sao kê exact `1.250.000 ₫` và partial `500.000 ₫ + 750.000 ₫`, cả hai statement đều chuyển `reconciled`.        |
| Rollback an toàn            | Pass            | Probe tổng hợp chạy trong transaction rollback; adjustment, reversal, refund, voucher reversal không để lại row test.                             |
| Canonical detail read model | Pass            | RPC detail as-of trả đầy đủ original/adjustment/obligation/settled/outstanding; finance API không còn đọc view legacy cho obligation detail/list. |
| Allocation write guard      | Pass ở contract | Trigger kiểm tra tenant, party/currency/direction, ngày hiệu lực, contract scope và số dư sau adjustment trên cả RPC lẫn đường post voucher.      |

Trong probe đầu tiên đã phát hiện vòng FK giữa event và `finance_operations`; lỗi đã được báo cáo nội bộ, sửa bằng migration 1510 và chạy lại probe đạt. Các test nhiều session/user và UI quản trị event/reconciliation vẫn là Not run, không thay thế bằng trạng thái Pass.

## 16. Kết quả bổ sung: tài khoản ngân hàng và đối soát thực tế

Ngày 17/09/2026, đã tạo và giữ lại bộ dữ liệu E2E trên dev để chạy đầy đủ đường đi tiền qua tài khoản ngân hàng:

| Dữ liệu                      | Mã/ID                                                                   | Kết quả kiểm tra                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Tài khoản ngân hàng          | `E2E-260917-BANK` / `340b7ac2-b584-4828-9f0a-6ca791410ca0`              | Hiển thị loại Ngân hàng, VND, số dư `2.500.000 ₫` trên danh sách và chi tiết tài khoản.          |
| Công nợ phải thu             | `E2E-BANK-CN-260917` / `44044b86-0cd5-4eb1-b7e7-e36849d9e74b`           | Gốc `1.250.000 ₫`, đã thanh toán `1.250.000 ₫`, còn lại `0 ₫`.                                   |
| Phiếu thu thanh toán công nợ | `20260917-000013` / `04e620ed-e412-4534-8c35-4d3097632f87`              | Posted, tạo movement thu `1.250.000 ₫`, phân bổ hết công nợ.                                     |
| Phiếu thu trực tiếp          | `20260917-000014` / `85776605-ec6a-454e-95a8-3ed84ac868b4`              | Posted, tạo movement thu `1.250.000 ₫` để kiểm tra match từng phần.                              |
| Sao kê exact                 | `E2E-BANK-STMT-260917` / `404e4e70-479a-49f2-82b4-a685c75eff35`         | Match một lần đủ `1.250.000 ₫`; trạng thái `reconciled`; replay cùng request key trả cùng match. |
| Sao kê partial               | `E2E-BANK-STMT-PARTIAL-260917` / `26de23e7-6ee3-41d6-b0c7-2ae0ed0b9da1` | Sau match `500.000 ₫` vẫn `open`; match tiếp `750.000 ₫` chuyển `reconciled`.                    |

Đối chiếu trên UI đạt: `/finance/accounts` hiển thị tài khoản và số dư; chi tiết tài khoản hiển thị hai movement; `/finance/vouchers` hiển thị hai phiếu posted; chi tiết khách hàng hiển thị công nợ E2E đã tất toán; báo cáo `Sổ quỹ & Tài khoản` hiển thị tổng thu `2.500.000 ₫`, tổng chi `0 ₫`, ròng `2.500.000 ₫` và 2 giao dịch thu.

Bộ dữ liệu trên là dữ liệu test được yêu cầu giữ lại. Chưa chạy concurrency nhiều session/user và chưa có màn hình quản trị trực tiếp cho import/reconcile; phần DB/RPC và các read model liên quan đã có bằng chứng Pass.

Ghi nhận ngoài luồng nghiệp vụ: khi điều hướng qua các route tài chính trên dev, console xuất hiện lặp cảnh báo React `Encountered a script tag while rendering React component` với source `react-dom_client.js`. Cảnh báo không làm hỏng request, không làm sai số dư/trạng thái và chưa xác định là lỗi của finance code; cần rà soát `ReactQueryDevtools`/global provider ở một lượt kỹ thuật riêng để đạt console sạch.
