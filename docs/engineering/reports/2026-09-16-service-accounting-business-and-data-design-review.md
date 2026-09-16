# Đánh giá thiết kế nghiệp vụ và dữ liệu kế toán dịch vụ

**Ngày đánh giá:** 16/09/2026  
**Phạm vi:** Các nghiệp vụ tài chính hiện đang triển khai trong project  
**Môi trường đối chiếu:** Dev app trên port 5174 và database dev  
**Trạng thái:** Báo cáo đánh giá thiết kế; không phải chứng nhận tuân thủ pháp lý hoặc thay thế quyết định chính sách kế toán của doanh nghiệp

> **Review kiến trúc tiếp theo:** [Nền tảng công nợ và kế toán dịch vụ — benchmark và thiết kế đích](../specs/2026-09-16-service-accounting-foundation-review-and-target-design.md) giữ lõi hiện tại nhưng nêu rõ các rủi ro write-path, chính sách ghi nhận và điều kiện trước khi đóng băng schema. Kết luận “đúng hướng” trong báo cáo này chỉ áp dụng cho bốn luồng đã chạy, không phải chứng nhận nền tảng đã sẵn sàng go-live kế toán.

## 1. Mục tiêu

Tài liệu này tổng hợp các nhận xét sau quá trình chạy thử các luồng:

1. Thêm công nợ ngoài hợp đồng cho khách hàng.
2. Thêm hợp đồng có phát sinh công nợ.
3. Thanh toán công nợ đã phát sinh.
4. Thu tiền trước/ứng trước của khách hàng và sử dụng khoản ứng trước để thanh toán công nợ.

Mục tiêu sâu hơn là đánh giá liệu mô hình hiện tại có phù hợp với cách vận hành của doanh nghiệp dịch vụ hay không, có đủ nền tảng để mở rộng hay không, và cần xử lý điểm nào trước khi xem các API/database contract là ổn định.

## 2. Kết luận điều hành

### 2.1. Kết luận ngắn

Thiết kế lõi hiện tại **đúng hướng và phù hợp với phạm vi quản lý công nợ - thu chi của doanh nghiệp dịch vụ**. Không cần viết lại mô hình nền tảng.

Mô hình:

```text
Công nợ phải thu/phải trả
        ↓
Phiếu thu/chi
        ↓
Phân bổ thanh toán
        ↓
Biến động quỹ/tài khoản
```

đang tách được ba sự kiện khác nhau:

- Phát sinh nghĩa vụ.
- Tiền thực tế vào hoặc ra.
- Tiền được phân bổ để tất toán nghĩa vụ.

Đây là điểm quan trọng và là nền tảng tốt để mở rộng.

### 2.2. Mức độ đáp ứng hiện tại

| Phạm vi | Đánh giá |
| --- | --- |
| Công nợ thủ công của khách hàng | Đạt ở luồng cơ bản |
| Công nợ từ hợp đồng | Đạt; đang áp dụng chính sách ghi nhận khi đến hạn |
| Thanh toán công nợ | Đạt; có phân bổ và đối soát số dư |
| Thu tiền ứng trước | Đạt ở thao tác ghi nhận và sử dụng cơ bản |
| Sổ quỹ/tài khoản và dòng tiền | Đạt trong các kịch bản đã chạy |
| Tổng hợp tiền ứng trước chưa dùng | Chưa đầy đủ |
| Đảo, hoàn, điều chỉnh, khóa kỳ, retry | Chưa đủ bằng chứng hoặc chưa hoàn thiện |
| Kế toán tổng hợp, định khoản, VAT, hóa đơn | Chưa nằm trong phạm vi hiện tại |

Do đó, cần phân biệt:

- Nếu mục tiêu là **quản lý công nợ, thu chi và sổ quỹ cho hoạt động dịch vụ**, nền tảng hiện tại là phù hợp.
- Nếu mục tiêu là **phần mềm kế toán dịch vụ đầy đủ**, hiện tại chưa đủ vì còn thiếu lớp hóa đơn, doanh thu, thuế, định khoản, sổ cái và khóa kỳ.

## 3. Cơ sở đánh giá

Đánh giá dựa trên:

- Kết quả chạy thực tế trên dev database.
- Migration finance core và migration đồng bộ công nợ từ hợp đồng.
- API và model tổng hợp tài chính ở frontend.
- Đặc tả [Finance vouchers and obligations](../specs/2026-09-13-finance-vouchers-and-obligations.md).
- Nhật ký [test và nghiệm thu công nợ](../test-plans/2026-09-16-customer-debt-workflow-test-and-acceptance.md).

Trong lần chạy thực tế, không phát hiện sai lệch dữ liệu ở bốn luồng chính sau khi xử lý lỗi thiếu thao tác dùng tiền ứng trước.

## 4. Đối chiếu từng nghiệp vụ hiện tại

### 4.1. Thêm công nợ ngoài hợp đồng

#### Cách nghiệp vụ thực tế thường vận hành

Doanh nghiệp có thể phát sinh khoản phải thu không gắn trực tiếp với một hợp đồng, ví dụ:

- Khoản thu bổ sung.
- Công nợ cũ nhập từ hệ thống khác.
- Điều chỉnh tăng phải thu.
- Khoản phải thu phát sinh từ thỏa thuận riêng.

Việc ghi nhận công nợ không được làm tăng tiền trong quỹ/tài khoản. Chỉ khi có phiếu thu và phân bổ thanh toán thì số tiền đã thu và số còn phải thu mới thay đổi.

#### Đánh giá hiện tại

Mô hình `finance_obligations` đáp ứng được quan hệ này. Công nợ thủ công có thể tồn tại độc lập với hợp đồng và được liên kết với khách hàng qua `customer_id`, đồng thời giữ snapshot tên khách hàng.

Luồng thanh toán sau đó dùng `finance_allocations`, nên một khoản thanh toán có thể phân bổ cho một hoặc nhiều nghĩa vụ.

#### Điểm cần chuẩn hóa

API hiện tạo công nợ thủ công trực tiếp với trạng thái `posted`, trong khi giao diện thông báo là “Đã tạo công nợ nháp”. Đây là mismatch giữa trạng thái dữ liệu và hành vi người dùng.

Đề xuất chốt một trong hai contract:

- Tạo nháp trước, chỉ ghi nhận sau khi người dùng thực hiện hành động post.
- Nếu nghiệp vụ cho phép ghi nhận ngay, đổi thông báo thành “Đã ghi nhận công nợ” và bắt buộc backend kiểm soát toàn bộ việc ghi nhận.

Không nên để frontend tự quyết định `posted_at` hoặc tự ghi trực tiếp trạng thái kế toán nếu sau này có duyệt chứng từ, khóa kỳ hoặc audit.

### 4.2. Hợp đồng có phát sinh công nợ

#### Cách nghiệp vụ thực tế thường vận hành

Hợp đồng dịch vụ thường có các kỳ thu hoặc khoản phí. Cần phân biệt:

- Lịch/kế hoạch phải thu trong tương lai.
- Nghĩa vụ phải thu đã thực sự phát sinh.
- Khoản đã thu.
- Khoản còn nợ.

#### Đánh giá hiện tại

Migration đồng bộ một `contract_charge` thành một `finance_obligation` có liên kết ngược tới:

- `contract_charge_id`.
- `contract_id`.
- Khách hàng.
- Ngày chứng từ và ngày đến hạn.

Việc giữ liên kết một-một này là đúng và giúp tránh tạo hai nguồn số dư độc lập cho cùng một khoản phí.

Hiện hệ thống áp dụng chính sách “chỉ tạo công nợ thực tế khi khoản phí đến hạn”; kỳ tương lai được giữ ở dạng kế hoạch. Chính sách này nhất quán với kết quả test.

#### Rủi ro chính sách

Không phải mọi doanh nghiệp dịch vụ đều ghi nhận phải thu theo ngày đến hạn. Có thể cần ghi nhận theo ngày:

- Hoàn thành dịch vụ.
- Nghiệm thu.
- Xuất hóa đơn.
- Bắt đầu kỳ dịch vụ.
- Đến hạn thanh toán.

Vì vậy, cần ghi rõ chính sách này trong domain contract. Nếu sau này đổi cách ghi nhận, nên bổ sung lớp sự kiện ghi nhận hoặc trạng thái nghiệp vụ mới, không đổi nghĩa của dữ liệu công nợ cũ.

### 4.3. Thanh toán công nợ

#### Cách nghiệp vụ thực tế thường vận hành

Thanh toán phải tạo ra:

1. Một chứng từ thu/chi.
2. Một biến động quỹ/tài khoản.
3. Một hoặc nhiều phân bổ vào công nợ.
4. Số đã thanh toán và còn phải thu được cập nhật.

#### Đánh giá hiện tại

Luồng hiện tại đáp ứng đúng. Khi thanh toán:

- `finance_vouchers` lưu đầu phiếu.
- `finance_voucher_lines` lưu chi tiết.
- `finance_account_movements` phản ánh tiền thực tế.
- `finance_allocations` phản ánh phần dùng để tất toán công nợ.
- `finance_obligation_balances` tính số đã trả và còn lại.

Việc tách allocation khỏi movement là đúng. Phân bổ chỉ thay đổi quan hệ thanh toán, không phải một lần thu tiền mới.

### 4.4. Thu tiền trước/ứng trước

#### Cách nghiệp vụ thực tế thường vận hành

Khách hàng có thể trả tiền trước khi khoản phải thu được tạo hoặc trước khi đến kỳ. Khoản tiền này:

- Là dòng tiền thực tế.
- Chưa phải là thanh toán của một công nợ cụ thể.
- Có thể sử dụng một lần hoặc nhiều lần sau đó.
- Có thể bị giới hạn theo khách hàng hoặc hợp đồng.
- Có thể cần hoàn phần chưa sử dụng.

#### Đánh giá hiện tại

Mô hình hiện tại xử lý đúng phần lõi:

- Phiếu ứng trước tạo một movement.
- Công nợ không bị giảm ngay.
- Khi sử dụng, hệ thống tạo allocation.
- Allocation không tạo thêm voucher hoặc movement.
- Có kiểm tra khách hàng, loại tiền, phạm vi hợp đồng, số khả dụng và số công nợ còn lại.

Đây là thiết kế có thể mở rộng, không cần tạo một loại “công nợ giả” khác để đại diện cho ứng trước.

#### Khoảng trống hiện tại

- Trang công nợ chưa có chế độ tổng hợp “Tiền ứng trước”.
- Tổng hợp khách hàng chưa hiển thị đầy đủ số ứng trước chưa phân bổ.
- Database hỗ trợ ứng trước theo hợp đồng nhưng form hiện chưa cho chọn hợp đồng một cách đầy đủ.
- Luồng hoàn ứng và đảo phân bổ chưa được kiểm thử hoàn chỉnh.

Các điểm này là thiếu chức năng/read model, chưa buộc phải thay đổi mô hình lõi.

## 5. Đánh giá mô hình dữ liệu

### 5.1. Điểm mạnh

#### Tách nghĩa vụ và dòng tiền

`finance_obligations` không bị trộn với `finance_account_movements`. Đây là điểm đúng về mặt mô hình hóa, vì phát sinh công nợ và thu tiền thường không xảy ra cùng thời điểm.

#### Allocation là quan hệ thanh toán

`finance_allocations` có thể biểu diễn:

- Một khoản thanh toán cho nhiều công nợ.
- Nhiều lần thanh toán cho một công nợ.
- Tiền ứng trước được dùng ở thời điểm sau.
- Đảo phân bổ mà không sửa chứng từ gốc.

#### Snapshot và liên kết nghiệp vụ

Việc lưu snapshot tên khách hàng/khoản mục trên chứng từ giúp lịch sử không thay đổi theo tên hiện tại. Đồng thời các FK tới khách hàng, hợp đồng và charge vẫn cho phép truy vấn nghiệp vụ hiện tại.

#### Bất biến tiền và tenant

Các bảng lõi có kiểm tra số tiền dương, loại tiền, tenant và trạng thái. RLS và RPC nghiệp vụ cũng đã được dùng cho các thao tác post/allocate quan trọng.

### 5.2. Những điểm chưa nên xem là đã đóng băng

#### Ghi công nợ thủ công chưa đi qua cùng một posting contract

Vouchers được lưu/post qua RPC có request key, nhưng obligation thủ công vẫn có đường ghi trực tiếp. Nếu không chuẩn hóa sớm, về sau hai loại công nợ sẽ có hành vi audit, timestamp, quyền và khóa kỳ khác nhau.

#### Idempotency chưa được giữ xuyên suốt lần retry

Backend có `finance_operations` và `request_key`, nhưng frontend đang tạo UUID mới cho mỗi lần gọi. Cần tạo request key một lần cho một ý định nghiệp vụ và dùng lại khi retry.

#### Ngày chứng từ, ngày hiệu lực và ngày ghi sổ chưa được tách thành contract đầy đủ

Đây là nền tảng cần thiết cho:

- Báo cáo theo ngày.
- Ghi nhận hồi tố.
- Đảo giao dịch.
- Khóa kỳ kế toán.
- Đối soát cuối ngày/tháng.

#### Chưa có read model thống nhất cho tiền ứng trước

Dữ liệu nguồn có thể đủ, nhưng các view/API tổng hợp chưa đưa tiền ứng trước chưa dùng vào cùng một góc nhìn khách hàng, hợp đồng và báo cáo.

#### Chưa có lớp journal/ledger

`finance_account_movements` phù hợp làm sổ tiền. Không nên dùng trực tiếp bảng này làm sổ cái kế toán tổng hợp trong tương lai.

## 6. Các đề xuất thiết kế

### 6.1. Ưu tiên xử lý trước khi mở rộng thêm

#### Đề xuất A — Chuẩn hóa vòng đời công nợ

Đưa thao tác tạo/post công nợ về backend/RPC:

```text
create obligation draft
        ↓
validate / approve
        ↓
post obligation
        ↓
allow settlement allocation
```

Nếu sản phẩm chưa cần nháp, vẫn nên có một RPC “create and post obligation” để tất cả kiểm tra, timestamp, quyền và idempotency nằm ở server.

#### Đề xuất B — Chuẩn hóa request key

Mỗi thao tác nghiệp vụ có một request key ổn định:

- Tạo/post voucher.
- Tạo/post obligation.
- Allocate.
- Reverse.
- Refund.
- Adjustment.

Cùng request key và cùng payload phải trả lại kết quả cũ; cùng key nhưng khác payload phải bị từ chối.

#### Đề xuất C — Chốt chính sách ngày ghi nhận

Nên định nghĩa rõ:

- `document_date`: ngày chứng từ/ngày phát sinh nghiệp vụ.
- `due_date`: ngày đến hạn thanh toán.
- `effective_date`: ngày ảnh hưởng số dư/báo cáo.
- `posted_at`: thời điểm hệ thống ghi nhận.

Không dùng một ngày cho tất cả mục đích.

#### Đề xuất D — Định nghĩa thống nhất customer credit/unapplied advance

Cần xác định rõ số ứng trước chưa dùng sẽ được gọi và tính thế nào trong:

- Tổng quan khách hàng.
- Chi tiết hợp đồng.
- Trang công nợ.
- Báo cáo công nợ.
- Báo cáo dòng tiền.

Không được cộng nó vào “đã thanh toán” của công nợ nếu chưa có allocation.

### 6.2. Có thể mở rộng sau theo hướng additive

#### Tiền ứng trước

Bổ sung view/API/UI để hiển thị:

- Tiền gốc.
- Đã sử dụng.
- Đã hoàn.
- Còn khả dụng.
- Phạm vi khách hàng/hợp đồng.
- Nguồn voucher và voucher line.

Giữ nguyên allocation làm cơ chế sử dụng tiền.

#### Hoàn tiền và đảo phân bổ

Không sửa hoặc xóa allocation/voucher đã ghi nhận. Tạo bản ghi nghiệp vụ đối ứng, liên kết bằng `reversal_of` hoặc bảng link hoàn tiền, có ngày hiệu lực và lý do.

#### Điều chỉnh công nợ

Không cập nhật trực tiếp `original_amount` sau khi đã post. Tạo adjustment tăng/giảm có lý do, người tạo, ngày hiệu lực và request key.

#### Hóa đơn và kế toán tổng hợp

Bổ sung các bảng journal/ledger, invoice và revenue recognition song song với finance core. Giữ finance core làm nguồn về chứng từ tiền và công nợ; không đổi nghĩa dữ liệu lịch sử.

#### Nhà cung cấp, nhân viên và các đối tượng khác

Mở rộng bằng party type/party reference hoặc bảng party chuẩn hóa, nhưng không được làm mất các FK và snapshot khách hàng hiện có.

## 7. Nguyên tắc chống breaking change

Khi phát triển tiếp, cần giữ các nguyên tắc sau:

1. Không đổi ý nghĩa hoặc xóa cột đang được dùng.
2. Không đổi trạng thái cũ; trạng thái mới chỉ được thêm khi có migration và xử lý đầy đủ ở API/UI/report.
3. Không sửa chứng từ posted trực tiếp; mọi thay đổi tạo bản ghi điều chỉnh/đảo.
4. Không tạo thêm nguồn tính số dư song song với `finance_obligation_balances`.
5. Không tạo movement mới khi chỉ phân bổ tiền đã thu.
6. Không tự động biến phần tiền dư thành ứng trước nếu người dùng chưa chọn hoặc chính sách chưa cấu hình.
7. Không dùng tên hiển thị để xác định đối tượng nghiệp vụ.
8. Mọi mutation tiền/nợ phải có server-side validation, quyền, transaction và request key.
9. Các view/API cũ tiếp tục trả dữ liệu cũ; trường mới nên nullable hoặc bổ sung qua endpoint/version tương thích.
10. Mỗi migration phải có kiểm tra dữ liệu cũ, backfill rõ ràng và kiểm thử rollback/forward compatibility khi phù hợp.

## 8. Ma trận ưu tiên đề xuất

| Hạng mục | Mức ưu tiên | Có cần sửa mô hình lõi không? | Nhận định |
| --- | --- | --- | --- |
| Chuẩn hóa create/post obligation | Cao | Không | Nên xử lý trước khi thêm nhiều loại công nợ |
| Giữ request key khi retry | Cao | Không | Tránh nhân đôi chứng từ |
| Tách các loại ngày nghiệp vụ | Cao | Có thể bổ sung | Cần cho khóa kỳ và đảo giao dịch |
| Tổng hợp tiền ứng trước chưa dùng | Cao | Không | Bổ sung view/API/UI |
| Chọn ứng trước theo hợp đồng trên UI | Trung bình | Không | Database đã có nền tảng |
| Hoàn tiền/đảo phân bổ | Trung bình | Không | Bổ sung nghiệp vụ đối ứng |
| Điều chỉnh công nợ | Trung bình | Không | Không sửa số gốc trực tiếp |
| Khóa kỳ kế toán | Trung bình | Có thể bổ sung settings | Cần trước khi vận hành chính thức |
| Hóa đơn, VAT, doanh thu, sổ cái | Theo roadmap | Có thêm lớp mới | Không nên nhồi vào finance core hiện tại |

## 9. Tiêu chí để xem nền tảng đã sẵn sàng mở rộng

Có thể xem thiết kế nền tảng ổn định để phát triển tiếp khi đạt các điều kiện sau:

- Công nợ thủ công và công nợ hợp đồng dùng contract ghi nhận nhất quán.
- Không còn mismatch giữa `draft`, `posted` và thông báo UI.
- Retry cùng một thao tác không tạo bản ghi trùng.
- Ngày chứng từ/ngày hiệu lực/ngày ghi sổ được định nghĩa rõ.
- Tiền ứng trước chưa phân bổ có số dư riêng, không bị tính nhầm là đã thanh toán.
- Các số dư đều lấy từ một nguồn tính duy nhất.
- Posted voucher/obligation không bị sửa trực tiếp.
- Có test cho phân bổ nhiều lần, phân bổ nhiều công nợ, vượt số dư, đồng thời và retry.
- Việc bổ sung journal/ledger sau này được xác định là lớp song song, không thay thế sổ tiền hiện tại.

## 10. Kết luận cuối

> Thiết kế hiện tại đủ tốt cho các nghiệp vụ công nợ và thu chi cơ bản đang làm, đồng thời có hướng mở rộng hợp lý. Không có dấu hiệu phải redesign toàn bộ.

Tuy nhiên, trước khi coi đây là nền tảng ổn định lâu dài, cần chuẩn hóa bốn contract nền tảng: vòng đời công nợ, request key/idempotency, ngày nghiệp vụ và số dư ứng trước chưa phân bổ.

Các phần mở rộng như tiền ứng trước theo hợp đồng, hoàn tiền, đảo phân bổ, điều chỉnh và kế toán tổng hợp có thể triển khai theo hướng bổ sung, giữ nguyên dữ liệu và ý nghĩa của các bảng lõi hiện tại.

## 11. Tài liệu tham chiếu

- [Đặc tả Finance vouchers and obligations](../specs/2026-09-13-finance-vouchers-and-obligations.md)
- [Test và nghiệm thu quy trình công nợ](../test-plans/2026-09-16-customer-debt-workflow-test-and-acceptance.md)
- [Migration finance core](../../../supabase/migrations/20260913030000_create_finance_core.sql)
- [Migration đồng bộ công nợ hợp đồng](../../../supabase/migrations/20260915010000_sync_contract_charges_to_finance_obligations.sql)
- [Migration quy tắc công nợ đến hạn](../../../supabase/migrations/20260916031840_enforce_due_contract_finance_obligations.sql)
- [Migration phân bổ tiền ứng trước](../../../supabase/migrations/20260916074019_finance_advance_allocation.sql)
- [Finance API](../../../src/project/finance/api/finance.api.ts)
- [Trang công nợ](../../../src/project/finance/pages/finance-obligations-page.tsx)
- [Form phiếu tài chính](../../../src/project/finance/pages/finance-voucher-form-page.tsx)
