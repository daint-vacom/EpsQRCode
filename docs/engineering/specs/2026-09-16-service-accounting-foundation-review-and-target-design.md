# Nền tảng công nợ và kế toán dịch vụ — review, benchmark và thiết kế đích

**Ngày:** 16/09/2026  
**Trạng thái:** Spec đã chốt định hướng kiến trúc và contract nền tảng. Phase hardening lõi và tranche nền tảng Phase 2 (khóa kỳ, read model as-of, phân bổ ứng trước theo ngày hiệu lực) đã triển khai trên dev; các quyết định chính sách kế toán được đánh dấu `ACCOUNTING-DECISION` vẫn cần người phụ trách kế toán phê duyệt trước khi bật nghiệp vụ tương ứng.
**Phạm vi kiểm chứng:** Repo/worktree, [báo cáo chạy thử bốn luồng](../reports/2026-09-16-service-accounting-business-and-data-design-review.md) và migration đã apply trên dev database; không suy diễn trạng thái production từ dev.

## 1. Quyết định điều hành

**Giữ lõi `finance_obligations` — `finance_vouchers`/`finance_voucher_lines` — `finance_allocations` — `finance_account_movements`, nhưng chưa đóng băng schema hay gọi đây là phần mềm kế toán đầy đủ.** Bốn luồng được báo cáo đã chạy (nợ thủ công, nợ hợp đồng đến hạn, thu nợ, nhận và phân bổ ứng trước) là bằng chứng cho một lát cắt vận hành, không chứng minh các trường hợp đảo, điều chỉnh, đồng thời, chốt kỳ hoặc tuân thủ kế toán. Các điểm dưới đây là điều kiện phải giải quyết trước khi mở rộng.

1. **Không lấy ngày đến hạn làm mặc định ngày phát sinh phải thu kế toán.** Lịch kỳ thu, quyền đòi tiền đã vô điều kiện, hoàn thành dịch vụ, hóa đơn, doanh thu, dòng tiền và ngày quá hạn là những sự kiện khác nhau. Quy tắc hiện tại “đến hạn mới tạo obligation” chỉ được giữ như chính sách _công nợ vận hành hiện hành_, có nhãn và phạm vi rõ, không gọi là chính sách ghi nhận kế toán chung.
2. **Bảo vệ chứng từ đã post ở cả write path và dữ liệu gốc.** Trigger hiện có thể ghi đè `original_amount`, `status`, `posted_at` của obligation theo thay đổi charge; cần chuyển sang phiên bản/adjustment có audit. Không dùng `greatest(..., 0)` để che khoản phân bổ vượt mức.
3. **Gom mọi mutation tiền/nợ qua thao tác server nguyên tử, idempotent, cùng giao thức lock.** Chặn ghi trực tiếp posted obligation từ client; sửa lỗ hổng kiểm tra tổng phân bổ toàn phiếu, party/tenant/currency/scope và ngày hiệu lực. Kiểm tra lại quyền khi replay.
4. **Tiền ứng trước chưa dùng là credit/advance riêng**, không tự thành khoản đã trả cho nợ, không tự thành doanh thu. Cần projection số dư theo đối tượng/hợp đồng/tiền tệ và lịch sử tại ngày báo cáo.
5. **Mở rộng bằng bảng sự kiện/liên kết/read model, không xóa bảng lõi.** Giữ ID và ngữ nghĩa chứng từ cũ, chạy song song adapter tương thích qua ít nhất một chu kỳ đối soát; tuyệt đối không lặp lại kiểu cutover xóa `customer_payments`/`customer_payment_allocations` ngay trong migration tích hợp.

Phạm vi v1 được đề xuất là **subledger công nợ + thu/chi + quỹ** cho doanh nghiệp dịch vụ, có thể xuất/đối soát sang sổ kế toán. Để trở thành phần mềm kế toán tổng hợp phải có hóa đơn/chứng từ thuế, ghi nhận doanh thu/chi phí, bút toán Nợ/Có cân bằng, sổ cái, khóa kỳ và chính sách pháp lý do kế toán phụ trách phê duyệt. Không suy từ các phiếu thu sang doanh thu/VAT.

## 2. Bằng chứng và mức độ chắc chắn

| Nhận định                                                                     | Bằng chứng repo/test                                                                                                                                                                                                                                                                                    | Đánh giá                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bốn happy path đã được đối soát trong dev                                     | [Biên bản test](../test-plans/2026-09-16-customer-debt-workflow-test-and-acceptance.md), [lỗi ứng trước đã retest](../../../test/customer-advance-allocation-missing.md), [lỗi khả dụng đã retest](../../../test/customer-debt-payment-detail-available-amount.md)                                      | PASS theo phạm vi biên bản, không mở rộng thành toàn bộ FIN-001–026.                                                                                              |
| Lõi phân tách nợ/tiền/phân bổ                                                 | [Migration finance core](../../../supabase/migrations/20260913030000_create_finance_core.sql), `finance_obligation_balances`, `finance_account_balances`                                                                                                                                                | Đúng hướng cho subledger; implementation chưa đủ bất biến của [spec gốc](2026-09-13-finance-vouchers-and-obligations.md).                                         |
| Contract charge là lịch nguồn; obligation sinh khi `due_date <= current_date` | [Migration đồng bộ](../../../supabase/migrations/20260915010000_sync_contract_charges_to_finance_obligations.sql), [migration due-date](../../../supabase/migrations/20260916031840_enforce_due_contract_finance_obligations.sql)                                                                       | Chính sách riêng hiện tại; có migration xóa **các obligation tương lai** khi chưa phân bổ và upsert thay đổi obligation đã post.                                  |
| Nợ thủ công                                                                   | [Finance API](../../../src/project/finance/api/finance.api.ts) `createFinanceObligation`, [hardening migration](../../../supabase/migrations/20260916120000_harden_finance_write_contract.sql)                                                                                                          | Đã chuyển frontend sang RPC server-side; không nhận `status`/`posted_at` từ client, có request key và snapshot đối tượng từ server.                               |
| Phân bổ ứng trước có RPC                                                      | [Migration phân bổ](../../../supabase/migrations/20260916074019_finance_advance_allocation.sql), [phase-2 migration](../../../supabase/migrations/20260916140000_finance_period_and_as_of_read_models.sql), [event migration](../../../supabase/migrations/20260916150000_finance_subledger_events.sql) | Đã bổ sung replay hash/lock, ngày source/target, kỳ khóa, read model as-of và event layer cho reversal/refund; UI và nghiệm thu concurrency vẫn là phase mở rộng. |
| Legacy payment đã bị drop                                                     | [Migration đồng bộ](../../../supabase/migrations/20260915010000_sync_contract_charges_to_finance_obligations.sql) cuối file                                                                                                                                                                             | Bài học chống breaking change; **không** đề xuất tái tạo/xóa lại trong tài liệu này.                                                                              |

Chỉ kết luận về **source ở worktree**, không mặc định migration chưa commit đã được triển khai trên mọi môi trường. Báo cáo test chứa dữ liệu dev; không chạy thử lại số dư, không xác nhận sản phẩm production. Cần đối chiếu deployed function/schema trước mọi thay đổi thực thi.
Làm rõ tên bảng: migration được đọc **không xóa `contract_charges`**; bảng này vẫn làm nguồn lịch kỳ. Các bảng bị drop trong migration tích hợp là `customer_payments` và `customer_payment_allocations` (cùng RPC/type liên quan). Nếu môi trường khác đã xóa `contract_charges`, phải kiểm deployed schema riêng, không suy từ repo.

## 3. Benchmark nghiệp vụ và giới hạn suy diễn

| Mốc đối chiếu                                                                                                                                                                                                                             | Thực hành được tài liệu hóa                                                                                                                                     | Hàm ý đối với thiết kế này                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [IFRS 15, đoạn 105–109](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2022/issued/part-a/ifrs-15-revenue-from-contracts-with-customers.pdf?bypass=on)                                                          | Phân biệt quyền nhận đối giá vô điều kiện (receivable), contract asset và contract liability khi khách trả/trở nên phải trả trước khi dịch vụ được chuyển giao. | **Không đồng nhất** `due_date`, hóa đơn, thu tiền và ghi nhận doanh thu; cần căn cứ entitlement/performance và chính sách áp dụng. IFRS là đối chiếu khái niệm, không khẳng định doanh nghiệp áp dụng IFRS.             |
| [ERPNext Payment Entry](https://docs.frappe.io/erpnext/payment-entry), [Advance Payment Entry](https://docs.frappe.io/erpnext/advance-payment-entry)                                                                                      | Phiếu thanh toán có party/tài khoản, có thể phân bổ nhiều hóa đơn hoặc để ứng trước chưa phân bổ; sau đó reconcile.                                             | Tách voucher khỏi allocation, giữ phần chưa dùng, cho nhiều nợ/một phiếu, một nợ/nhiều phiếu; cần party ledger và kiểm soát currency/account.                                                                           |
| [ERPNext Payment Reconciliation](https://docs.frappe.io/erpnext/payment-reconciliation)                                                                                                                                                   | Match khoản tiền đã có với invoice về sau không tạo thêm bank movement.                                                                                         | `allocate_finance_advance` chỉ thêm hiệu lực phân bổ; giải phân bổ không được hoàn/đảo tiền gốc ngầm.                                                                                                                   |
| [Odoo 19 Payments](https://www.odoo.com/documentation/19.0/applications/finance/accounting/payments/online.html), [Bank reconciliation](https://www.odoo.com/documentation/19.0/applications/finance/accounting/bank/reconciliation.html) | Payment đứng độc lập, outstanding credit và đối soát hóa đơn/sao kê là các trạng thái khác nhau; có thể khác thời điểm ghi nhận tiền ngân hàng.                 | Nếu chưa đối soát sao kê, màn “sổ tài khoản” là **sổ nội bộ theo phiếu**, không tuyên bố số dư ngân hàng đã xác nhận.                                                                                                   |
| [MISA AMIS — đối trừ/bỏ đối trừ công nợ khách hàng](https://helpact.misa.vn/kb/doi_tru_chung_tu_cong_no_cua_khach_hang/)                                                                                                                  | Chứng từ thanh toán và chứng từ công nợ có thể tồn tại độc lập rồi đối trừ theo cùng mã khách hàng; có nghiệp vụ bỏ đối trừ khi sai.                            | Allocation là quan hệ riêng có thể sửa sai có lịch sử, không xóa phiếu tiền hoặc đổi customer bằng tên hiển thị. Theo dõi đến cấp hóa đơn là chính sách triển khai, không mặc định chỉ có một invoice cho một contract. |
| [Bộ Tài chính về TT 99/2025/TT-BTC](https://www.mof.gov.vn/tin-tuc-tai-chinh/tin-chinh-sach-tai-chinh/tap-huan-trien-khai-thong-tu-so-992025tt-btc)                                                                                       | Chế độ kế toán doanh nghiệp hiệu lực 01/01/2026 cho năm tài chính bắt đầu từ/sau mốc đó; doanh nghiệp cần quy chế hạch toán nội bộ.                             | Trước khi gọi sản phẩm là “phần mềm kế toán” tại Việt Nam, kế toán/đơn vị tư vấn phải chốt chế độ áp dụng, chứng từ, tài khoản, thuế, khóa sổ và lưu trữ. Tài liệu này không phải ý kiến pháp lý.                       |

Benchmark là **nguyên tắc thiết kế có đối chiếu**, không sao chép nguyên trạng luồng Odoo/ERPNext hay gán một bút toán mẫu bắt buộc cho mọi doanh nghiệp. Đặc biệt, “khách đã trả trước” có thể cần được theo dõi như nghĩa vụ thực hiện dịch vụ/credit theo chính sách kế toán, còn phần công nợ vận hành là một phép chiếu khác.

## 4. Bản đồ sự kiện và định nghĩa số dư

| Sự kiện                                         | Bản ghi authoritative                             | Tác động ở subledger                                          | Không tự suy ra                    |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| Ký hợp đồng/tạo lịch kỳ thu                     | `contracts`, `contract_charges`                   | Kế hoạch thu/chi tương lai                                    | Công nợ đã ghi nhận; doanh thu.    |
| Xác lập quyền phải thu/phải trả theo chính sách | `finance_obligations` (+ sự kiện ghi nhận, nguồn) | Phải thu/phải trả gốc, ngày hiệu lực                          | Thu/chi tiền; doanh thu/VAT.       |
| Lập nháp phiếu                                  | `finance_vouchers`, lines/drafts                  | Chưa thay đổi nợ hoặc tiền                                    | Phiếu đã thu/chi.                  |
| Post phiếu thu/chi                              | voucher/line + một movement nguyên tử             | Tiền vào/ra; với settlement có thể phân bổ cùng transaction   | Sao kê ngân hàng đã match.         |
| Phân bổ tiền cũ                                 | `finance_allocations`                             | Giảm nợ, giảm credit khả dụng                                 | Tiền mới, doanh thu mới.           |
| Điều chỉnh/đảo/hoàn                             | Sự kiện đối ứng có liên kết gốc                   | Thay đổi có ngày hiệu lực, giữ vết gốc                        | Xóa/chỉnh sửa lịch sử posted.      |
| Phát hành hóa đơn/ghi doanh thu/thuế            | Lớp invoice/journal bổ sung                       | Liên kết một nghĩa vụ hiện hữu hoặc ghi nhận nghĩa vụ một lần | Một nợ thứ hai cho cùng khoản phí. |

**Công thức tại ngày D và theo tenant–party–currency:**

- `gross_receivable(D) = sum(obligation gốc đã hiệu lực + adjustments tăng − adjustments giảm)` của phải thu posted; payable tính riêng.
- `settled(D) = sum(allocation có hiệu lực tại D − phần bị đảo có hiệu lực tại D)`; `open(D) = gross − settled`, không âm nếu invariant được giữ.
- `unapplied(D) = sum(line ứng trước/tiền chờ phân bổ đã post và hiệu lực) − allocations(D) − refunds(D)` theo từng nguồn; không bù trừ ngầm với `open`.
- `net_exposure(D) = open(D) − unapplied_eligible(D)` chỉ là chỉ số quản trị tùy chọn, phải hiện cả hai thành phần và quy tắc eligibility; không thay số dư công nợ pháp lý bằng một phép trừ tự động.
- `cash_balance(account,D) = opening_balance + inflows − outflows` theo movements hiệu lực từ opening_date đến D; tách giao dịch _chưa đối soát sao kê_.
- `overdue(D)` chỉ trên nợ đã ghi nhận còn dư có `due_date < D`; chưa đến hạn vẫn có thể là nợ **đã ghi nhận**. Lịch hợp đồng chưa ghi nhận là `planned`, không trộn vào aging.

Report “as of D” phải xét ngày hiệu lực gốc/đảo, không lọc bằng trạng thái hiện tại đơn thuần. Mọi tổng tiền luôn phân nhóm currency; v1 chỉ cho VND nếu chưa có tỷ giá/định khoản chênh lệch. Khóa sổ và timezone tenant áp dụng nhất quán cho tất cả ngày ảnh hưởng số dư.

**Ví dụ kiểm toán đường đi 12 triệu VND:** hợp đồng lên lịch kỳ 12 triệu nhưng chưa đủ điều kiện ghi nhận → planned 12, AR 0, cash 0. Khách nộp trước 3 triệu → movement +3, advance khả dụng 3, AR vẫn 0. Khi căn cứ phát sinh phải thu được duyệt, post obligation 12 triệu → AR gross 12, settled 0, open 12; không movement mới. Phân bổ 3 triệu ứng trước → settled 3, open 9, advance khả dụng 0; cash vẫn +3. Thu thêm 4 triệu và phân bổ → movement +4, settled 7, open 5, cash tổng +7. Nếu sau đó giảm phí 2 triệu, cần adjustment và đối chiếu allocation; không sửa `original_amount` 12 triệu. Ngày ghi nhận nghĩa vụ trong ví dụ **không mặc định** là ngày đến hạn hay ngày xuất hóa đơn.

## 5. Mô hình đích không phá vỡ nền

### 5.1. Bảng hiện hữu giữ nguyên vai trò

| Bảng                                       | Vai trò lâu dài                                                 | Ràng buộc bổ sung theo hướng additive                                                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract_charges`                         | Kỳ/khoản phí theo phiên bản hợp đồng, nguồn kế hoạch; giữ ID cũ | Không cho trigger ghi đè financial history đã post; sửa điều khoản qua version/event.                                                                                     |
| `finance_obligations`                      | Open items phải thu/phải trả, một nghĩa vụ có căn cứ nguồn      | Ghi nhận qua server; immutable fields sau post; kỳ phát sinh và ngày hạn riêng; audit. Một charge hiện ánh xạ tối đa một obligation, thay đổi giá trị bằng adjustment.    |
| `finance_vouchers`/`finance_voucher_lines` | Chứng từ nhận/chi tiền, line cách xử lý                         | Bất biến sau post; bảo vệ posted ở DB; kiểm tra scope/party/currency; một line không đồng thời direct và settlement.                                                      |
| `finance_allocations`                      | Quan hệ nhiều–nhiều giữa tiền nguồn và nợ                       | Sự kiện đảo có thời điểm/lý do, không xóa; tính khả dụng theo ngày; link operation.                                                                                       |
| `finance_account_movements`                | Sổ biến động tiền nội bộ                                        | Unique nguồn–event; reversal đối chiều; không thay bằng journal/ledger kế toán.                                                                                           |
| `finance_operations`                       | Idempotency/audit thao tác                                      | Giữ unique `(tenant_id, request_key)` hiện có; operation type, target ID và canonical payload cùng tham gia đối chiếu hash; quyền và trạng thái được kiểm tra lúc replay. |

Nên thêm (khi triển khai tính năng, **không tạo bảng rỗng chỉ để dự phòng**): `finance_obligation_adjustments`, `finance_refund_links`, `finance_account_transfers`, `finance_settings`/period locks, allocation reversal events, reconciliation statements/matches; `finance_recognition_events` hoặc source-event link khi chính sách phát sinh theo nghiệm thu/hóa đơn cần nhiều sự kiện trên một kỳ. `invoices`/invoice lines và `invoice_obligation_links` liên kết về **nghĩa vụ hiện có**, không ghi nợ hai lần. `journal_entries`/`journal_lines` cân bằng Nợ/Có, trace từ sự kiện nguồn, có version policy mapping và trạng thái post độc lập. Nếu một charge cần chia nhiều nghĩa vụ, thêm bảng link charge–obligation và mở rộng constraint bằng migration tương thích; **không** tái sử dụng `contract_charge_id unique` với nghĩa mới hoặc xóa obligation cũ.

Party hiện dùng customer/employee FK và snapshot; mở rộng supplier/other bằng registry hoặc FK có điều kiện, backfill và adapter, không thay ID lịch sử bằng text tên. `finance_accounts` là quỹ/ngân hàng nghiệp vụ, **không** phải chart of accounts kế toán; đặt tên `ledger_accounts`/`gl_accounts` riêng khi bổ sung sổ cái.

### 5.2. Bất biến bắt buộc ở write boundary

1. Chỉ server post/adjust/reverse; client không insert `status='posted'`, `posted_at` hay update amount/status posted qua Data API. RLS/grants chặn write ngoài RPC; `SECURITY DEFINER` kiểm tra `auth.uid`, tenant, permission và mọi FK, với quyền EXECUTE tối thiểu.
2. Lock tài khoản, **mọi** dòng nguồn và obligation bị ảnh hưởng theo thứ tự ổn định. Kiểm tra tổng allocations của _toàn thao tác_ theo obligation và line trước khi insert; re-read dưới lock; rollback nguyên transaction khi vượt nợ/khả dụng hoặc ngoại tệ/sai party/sai hợp đồng.
3. Cùng key + cùng operation, target và payload chuẩn hóa trả cùng kết quả (sau authorization); cùng key khác nội dung báo conflict. Lưu key qua retry/reload có giới hạn thời gian theo intent; không tạo key mới trong mỗi network attempt. Unique theo nguồn + loại event là lớp chặn trùng độc lập.
4. Chỉ phân bổ phiếu và obligation posted, cùng tenant, party ID, currency, chiều thu/phải thu hoặc chi/phải trả; không dùng tên snapshot làm khóa; ngày phân bổ không trước ngày hiệu lực nguồn/nợ hoặc sau kỳ khóa.
5. `original_amount` và chứng từ posted không đổi. Giảm nợ đã thanh toán phải giải phóng allocation trước/cùng transaction; điều chỉnh có lý do, actor, nguồn và ngày. Đảo không xóa movement/obligation/charge; hoàn là **tiền ra thực tế mới**, khác đảo nhập sai.
6. Test cả số dư chạy sau giao dịch lùi ngày, không chỉ số dư hiện tại. Posted voucher phải sinh đúng movement (ngoại lệ dữ liệu import trước opening_date được đánh dấu); draft không sinh movement. Báo cáo cashflow lấy movement hoặc reconciled projection có xử lý reversal, không chỉ `voucher.status='posted'`.
7. Composite FK `(tenant_id,id)` cho liên kết finance mới và liên kết có thể nâng cấp; với FK cũ một cột, RPC/trigger kiểm tenant cùng transaction trước khi cho post. Views public bật `security_invoker` và policy/grant tối thiểu; kiểm thử caller khác tenant. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) phân biệt grant với policy và lưu ý view mặc định không tự áp RLS của caller.

**Các kiểm tra cụ thể trước khi tin schema hiện tại:** `post_finance_voucher` đang kiểm tra từng draft allocation với settled đã có _trước_ insert nên hai line cùng trả một nợ có thể vượt tổng; không thấy kiểm tra cùng customer/currency/scope/tenant của target trong loop. `post_finance_voucher` replay key hiện trả result theo key mà không so target/hash; `save_finance_voucher_draft` hash chỉ payload, chưa gắn target/revision. `finance_obligation_balances` dùng `greatest(...,0)` che sai lệch; `finance_cashflow_report` lọc current status posted và sẽ sai khi có đảo nếu không thiết kế lại. `finance_account_balances` hiện chỉ là current balance; không thay thế as-of/running balance. Những nhận định này là **rủi ro suy ra từ code**, cần test khai thác/đối soát trước khi kết luận dữ liệu dev đã sai.
`customer_receivable_summary` trong migration hiện trả `unapplied_credit = 0` hằng số: thiếu số dư ứng trước là một khoảng trống read-model cụ thể, không phải bằng chứng chưa có tiền ở nguồn.

### 5.3. Chính sách phát sinh khoản phải thu: quyết định còn cần người phụ trách kế toán

| Tình huống                                                           | Khuyến nghị hiển thị/vận hành                                      | Ghi nhận kế toán phụ thuộc chính sách                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Kỳ dịch vụ tương lai, chưa thực hiện, chưa có quyền thu vô điều kiện | `planned charge`                                                   | Không tự tạo revenue/AR.                                                                |
| Đã có quyền đòi tiền nhưng chưa đến hạn                              | `posted obligation`, `not due`                                     | Có thể là receivable; ngày hạn chỉ dùng aging.                                          |
| Dịch vụ đã làm nhưng quyền thu còn phụ thuộc điều kiện khác          | Service/performance event, chưa ép thành AR                        | Có thể là contract asset; cần chính sách riêng.                                         |
| Nhận tiền trước khi thực hiện                                        | Posted receipt + unapplied/advance                                 | Xác định contract liability/thuế theo chứng từ và chế độ áp dụng; không tự ghi revenue. |
| Giảm giá/hủy/hoàn sau ghi nhận                                       | Credit/adjustment + allocation release; nếu chuyển tiền thì refund | Chứng từ điều chỉnh hóa đơn và bút toán liên quan do kế toán duyệt.                     |

Sản phẩm cần chốt `recognition_policy` theo loại dịch vụ/điều khoản và một event đủ chứng cứ: hoàn thành/biên bản nghiệm thu, hóa đơn hoặc quyền thanh toán vô điều kiện. Không retroactively đổi nghĩa các row do chính sách `due_date` cũ tạo; thêm `recognition_basis`, `recognized_effective_date`, provenance/policy version và backfill có phân loại `legacy_due_date_policy`. Nếu dữ liệu cũ thiếu chứng cứ, đánh dấu unknown để đối soát, không bịa ngày nghiệm thu. Công nợ manual phải có loại/căn cứ cụ thể (opening balance, adjustment, manual claim), không dùng “ngoài hợp đồng” làm đường tạo doanh thu không chứng từ.

## 6. Lộ trình tiến hóa an toàn (expand → migrate → verify → contract)

**P0 — trước khi nhận thêm giao dịch thực:** inventory deployed schema/RPC/jobs, snapshot backup có kiểm tra restore, mapping ID và bộ số dư theo tenant/customer/contract/currency/account; xác định accounting cutover date. Chặn mọi write path posted trực tiếp; sửa post/allocation invariants và test tenant/party/currency/multi-line/concurrency/idempotency; dùng feature gate nếu chưa sẵn sàng. Không xóa bảng nào.

**P1 — chuẩn hóa contract:** thêm nullable fields cho effective/posting/recognition basis và provenance; RPC create-draft/post hoặc create-and-post nợ với key ổn định; bổ sung read model advance theo ngày, cùng snapshot. Backfill từng tenant, đối soát trước/sau; dual-read/shadow compare, chỉ **một** đường ghi authoritative. Hạn chế sửa ngày quá khứ và chốt kỳ. `contract_charges` tiếp tục là nguồn lịch, trigger không overwrite posted amount; sửa chênh lệch bằng adjustment.

**P2 — nghiệp vụ đầy đủ của subledger:** điều chỉnh/giải phân bổ/hoàn/đảo/chuyển quỹ, as-of projections, reconciliation sao kê, audit và khóa kỳ; test bút toán đối ứng và số dư chạy. Lập bảng ngoại lệ dữ liệu migration, không im lặng kẹp số dư âm về 0.

**P3 — full accounting khi được duyệt riêng:** invoice/credit note, VAT, contract asset/liability, revenue recognition, GL/journal và mapping sang hệ thống kế toán; đối soát subledger–GL, khóa kỳ và export. Không thay đổi các ID phiếu/nợ/tiền đã post.

Mỗi phase cần migration **additive** (column nullable, bảng/link/view mới, index/constraint validate sau backfill), compatibility view/RPC giữ contract cũ, feature flag/consumer inventory, canary theo tenant, so sánh tổng và ID-level, kế hoạch forward-fix nếu có giao dịch mới sau cutover. Không `DROP TABLE` ở cùng đợt cutover; chỉ xem xét thu hồi sau khi mọi consumer ngừng dùng, hết retention và có phê duyệt riêng. [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) hỗ trợ thêm constraint `NOT VALID` rồi `VALIDATE` để kiểm dữ liệu cũ theo giai đoạn. Rollback phần schema trước mở ghi khác với rollback nghiệp vụ sau mở ghi: trường hợp sau phải forward-fix/đảo có audit, không restore snapshot làm mất giao dịch.

## 7. Gates nghiệm thu bắt buộc

| Gate               | Chứng minh cần bàn giao                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Business           | Ký hợp đồng nhưng chưa thu, nợ đã ghi nhận chưa đến hạn, nghiệm thu trước hóa đơn, thu trước rồi phân bổ nhiều kỳ, nợ mở đầu kỳ, thu một phần, một phiếu nhiều nợ, refund một phần, giảm phí sau đã thu, chi payable, sai kỳ/khác party. Phân biệt kế hoạch/AR/credit/revenue trên UI và report. |
| Integrity          | Tạo cùng obligation/voucher/allocate với retry, timeout sau commit, double click, hai phiên cùng source/nợ, hai line cùng obligation, sai tenant/customer/contract/currency/chiều, invalid date, backdate và closed period; một intent không được nhân đôi hoặc âm nguồn/nợ/quỹ.                 |
| History            | As-of trước/sau allocation, refund, reversal và adjustment; các bản posted không biến mất; tổng khách hàng = tổng obligation = báo cáo, cash movement = sổ quỹ, unapplied riêng; mỗi sai lệch có danh sách row thay vì bị `greatest` che.                                                        |
| Migration          | Inventory tất cả API/RPC/view/cron/export; backfill idempotent, map legacy IDs, số dòng/số tiền theo tenant–party–currency trước/sau, trường hợp thiếu account/ngày; deployed schema verified; contract test cho cả adapter cũ và API mới; backup restore diễn tập.                              |
| Security           | Authenticated không thể insert posted/update posted hoặc gọi RPC ngoài quyền; RLS/grant và `SECURITY DEFINER` test cross-tenant; view không lộ dữ liệu tenant khác.                                                                                                                              |
| Accounting release | Kế toán ký chính sách recognition, chart/mapping, hóa đơn/thuế, khóa kỳ, độ trễ đối soát bank và quy tắc xử lý ứng trước. Nếu chưa ký, chỉ công bố subledger/quỹ nội bộ.                                                                                                                         |

Theo [test plan](../test-plans/2026-09-16-customer-debt-workflow-test-and-acceptance.md), nhiều negative/concurrency paths **chưa chạy**. Chưa đạt các gate đó thì không gọi thiết kế “stable”, dù bốn luồng chính pass.

## 8. Các quyết định cần chốt trước khi implement

1. Ai phê duyệt chính sách phát sinh phải thu cho từng dịch vụ: đến hạn, nghiệm thu, hóa đơn hay quyền thu vô điều kiện? Quy tắc nào cho dữ liệu cũ đã sinh theo hạn?
2. Sản phẩm chỉ quản lý subledger/thu chi và tích hợp phần mềm kế toán, hay sẽ trở thành hệ thống kế toán chính? Chế độ kế toán, thuế và đối tượng doanh nghiệp nào?
3. Tiền khách nộp trước được gắn khách hàng hay khóa theo hợp đồng; có được chuyển phạm vi, refund và tự phân bổ hay không? Ai duyệt?
4. Mốc opening balance, timezone/ngày khóa sổ, xử lý khoản import thiếu account/chứng từ, và ai xác nhận đối soát?
5. Có chấp nhận policy tạm thời là “chưa cho backdate/refund/reversal” cho đến khi P2 hoàn thành không? Nếu không, các luồng đó phải vào P0 trước go-live.

Các câu hỏi này là quyết định chính sách, **không** nên giải bằng việc xóa/thay bảng. Có thể triển khai hardening bất biến và bảo vệ dữ liệu P0 trong lúc chờ chốt chính sách ghi nhận.

## 9. Liên hệ tài liệu và trạng thái

- [Spec finance gốc](2026-09-13-finance-vouchers-and-obligations.md) là mục tiêu chức năng rộng; bảng bổ trợ và FIN-001–026 trong đó **không** mặc nhiên đã triển khai.
- [Báo cáo review sau test](../reports/2026-09-16-service-accounting-business-and-data-design-review.md) là bằng chứng và nhận định ban đầu. Tài liệu này sửa lại mức độ tự tin ở câu “không cần redesign” thành **giữ lõi, phải harden write contract và ghi nhận theo chính sách trước khi freeze**.
- [Test plan và biên bản](../test-plans/2026-09-16-customer-debt-workflow-test-and-acceptance.md) chỉ xác nhận nhánh được chạy; các trường hợp not-run không chuyển thành pass.

**Không có migration hay thay đổi dữ liệu được thực hiện khi viết tài liệu này.**

## 10. Contract triển khai v1 đã chốt

### 10.1. Phạm vi được phép triển khai

V1 là **subledger vận hành** cho doanh nghiệp dịch vụ, gồm:

- Nghĩa vụ phải thu/phải trả có căn cứ.
- Phiếu thu/chi tiền mặt hoặc tài khoản ngân hàng.
- Thanh toán trực tiếp hoặc thanh toán công nợ.
- Tiền ứng trước/chưa phân bổ.
- Phân bổ tiền đã thu/chi vào nghĩa vụ.
- Số dư quỹ/tài khoản nội bộ.
- Báo cáo công nợ, dòng tiền và lịch sử theo khách hàng/hợp đồng.
- Audit, idempotency, tenant isolation và khóa kỳ ở mức nền tảng.

V1 không tự nhận là hệ thống kế toán tổng hợp. Các nghiệp vụ sau chỉ được bổ sung sau khi có spec riêng:

- Hóa đơn điện tử và chứng từ thuế.
- Ghi nhận doanh thu/chi phí.
- Contract asset/contract liability ở cấp báo cáo kế toán.
- Định khoản Nợ/Có và sổ cái.
- Báo cáo tài chính.
- Đối soát sao kê ngân hàng đầy đủ.
- Tạm ứng/quyết toán nhân viên, chi hộ/thu hộ.

### 10.2. Nguyên tắc authoritative source

Mỗi loại số dư chỉ có một nguồn dữ liệu chính:

| Số liệu                     | Nguồn chính                                                              |
| --------------------------- | ------------------------------------------------------------------------ |
| Nghĩa vụ gốc                | finance_obligations và adjustment events                                 |
| Tiền thực tế vào/ra         | finance_account_movements                                                |
| Tiền đã dùng để tất toán nợ | finance_allocations                                                      |
| Tiền ứng trước chưa dùng    | Posted voucher lines có handling_type = advance trừ allocation và refund |
| Trạng thái chứng từ         | finance_vouchers.status và các sự kiện đảo/hoàn                          |
| Idempotency/audit           | finance_operations                                                       |
| Kế hoạch kỳ tương lai       | contract_charges, không trộn vào số dư công nợ thực tế                   |

Frontend không tự tính lại số dư tổng từ dữ liệu đã phân trang. Mọi badge/tổng quan phải lấy từ read model có scope tenant, đối tượng, loại tiền và ngày chốt.

## 11. Mô hình nghiệp vụ và state machine

### 11.1. Obligation

```text
draft → posted → voided
```

Quy tắc:

- draft chưa được dùng để thanh toán.
- posted là nghĩa vụ đã ghi nhận; không sửa trực tiếp số tiền, đối tượng, nguồn, ngày chứng từ hoặc ngày hiệu lực.
- voided chỉ dùng khi nghĩa vụ chưa còn hiệu lực theo nghiệp vụ được phép; nếu đã có allocation hoặc đã ảnh hưởng kỳ đã khóa thì phải dùng adjustment/reversal.
- Mọi thay đổi sau posted tạo event đối ứng, không ghi đè row gốc.

### 11.2. Voucher

```text
draft → posted → reversed
draft → cancelled
```

Quy tắc:

- Chỉ draft được sửa.
- posted tạo đúng một movement cho tổng tiền thực tế.
- reversed không xóa voucher/movement gốc; tạo movement đối ứng và liên kết nguồn.
- cancelled chỉ dùng cho draft chưa ghi nhận.
- Không cho truy cập đường edit để sửa posted voucher.

### 11.3. Allocation

```text
active → reversed
```

Quy tắc:

- Allocation active làm giảm số còn phải thu/phải trả hoặc số ứng trước khả dụng.
- Allocation không tạo movement mới.
- Đảo allocation tạo event/bản ghi đối ứng có lý do, actor và effective date.
- Không xóa allocation đã có hiệu lực.

### 11.4. Contract charge

contract_charges là nguồn lịch/khoản phí. Việc sinh obligation phải phụ thuộc recognition_policy đã cấu hình.

V1 giữ chính sách hiện tại:

- Charge tương lai: planned.
- Charge đến điều kiện hiện tại theo chính sách đến hạn: tạo một obligation posted.
- Không dùng due_date để khẳng định doanh thu đã phát sinh.
- Không cho trigger ghi đè nghĩa vụ posted đã có; thay đổi khoản phí sau đó phải tạo adjustment hoặc quy trình điều chỉnh được phê duyệt.

## 12. API/RPC contract

### 12.1. Tạo công nợ thủ công

Đường ghi trực tiếp /finance_obligations với status = posted từ frontend phải được loại bỏ hoặc chuyển thành compatibility adapter chỉ gọi RPC.

RPC đích:

```text
create_finance_obligation(
  p_tenant_id,
  p_payload,
  p_request_key
)
```

Payload tối thiểu:

```json
{
  "code": "CN-...",
  "description": "...",
  "partyType": "customer",
  "customerId": "...",
  "direction": "receivable",
  "sourceType": "manual",
  "documentDate": "YYYY-MM-DD",
  "effectiveDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "currencyCode": "VND",
  "originalAmount": 1000000,
  "recognitionBasis": "manual_claim"
}
```

RPC phải:

- Xác thực tenant, permission, customer, currency và amount.
- Ghi created_by, posted_by, posted_at từ server.
- Kiểm tra code unique trong tenant.
- Chấp nhận cùng request_key như một lần retry của cùng intent.
- Không cho client truyền tùy ý status, posted_at hoặc audit actor.
- Trả về cùng kết quả nếu request được replay đúng payload.

Nếu chưa triển khai draft obligation, dùng thao tác create_and_post; không hiển thị nháp giả.

### 12.2. Lưu và post voucher

save_finance_voucher_draft và post_finance_voucher tiếp tục là server operation.

Bắt buộc:

- request_key được tạo một lần cho intent và giữ lại khi network retry.
- Hash canonical payload phải bao gồm operation, target ID, revision và tenant.
- Replay phải kiểm tra permission trước khi trả kết quả.
- Replay cùng key khác payload/target phải báo conflict.
- post lock voucher, account, mọi source line và obligation theo thứ tự ổn định.
- Tổng phân bổ phải được kiểm tra theo toàn bộ transaction, không chỉ từng line riêng lẻ.

### 12.3. Phân bổ ứng trước

RPC hiện tại allocate_finance_advance được giữ làm nền tảng:

```text
allocate_finance_advance(
  p_tenant_id,
  p_voucher_line_id,
  p_obligation_id,
  p_amount,
  p_effective_date,
  p_request_key
)
```

Bổ sung/duy trì các điều kiện:

- Source voucher phải posted, là receipt/payment phù hợp và line phải là advance.
- Target obligation phải posted.
- Cùng tenant, party, currency và chiều nghiệp vụ.
- Nếu source có advance_scope = contract, target phải cùng hợp đồng.
- effective_date không trước ngày hiệu lực source/target và không nằm trong kỳ đã khóa.
- Số phân bổ không vượt khả dụng source hoặc số còn lại target.
- Lock source và target trong cùng transaction.
- Không tạo voucher/movement mới.
- Bản ghi operation và allocation commit cùng transaction.

### 12.4. Các operation mở rộng

Các operation sau phải dùng cùng mẫu contract trước khi triển khai:

```text
adjust_finance_obligation(...)
reverse_finance_allocation(...)
reverse_finance_voucher(...)
refund_finance_source(...)
transfer_finance_account(...)
close_finance_period(...)
```

Mỗi operation phải có:

- tenant_id.
- Target/source ID.
- Payload nghiệp vụ.
- effective_date.
- Reason.
- request_key.
- Actor server-side.
- Operation record.
- Bản ghi đối ứng hoặc trạng thái chuyển tiếp có thể truy vết.

## 13. Bất biến dữ liệu bắt buộc

### 13.1. Invariant công nợ

- original_amount > 0.
- Mỗi obligation thuộc đúng một tenant.
- Obligation customer phải có customer_id, không dùng snapshot làm khóa.
- Obligation contract phải có contract_id và source charge hợp lệ.
- Một charge chỉ ánh xạ một obligation trong v1.
- Obligation posted không bị giảm bằng cách sửa original_amount.
- Giảm nghĩa vụ sau post dùng adjustment; nếu đã phân bổ, phải xử lý allocation liên quan trong cùng nghiệp vụ.

### 13.2. Invariant phân bổ

- allocation.amount > 0.
- Tổng allocation active theo ngày không vượt số nguồn.
- Tổng allocation active theo ngày không vượt nghĩa vụ sau adjustment.
- Kiểm tra tổng trên tất cả lines trong cùng voucher.
- Không phân bổ khác party, tenant, currency, direction hoặc contract scope.
- Không phân bổ trước ngày hiệu lực hợp lệ.
- Allocation reversal không làm thay đổi hoặc xóa lịch sử gốc.

### 13.3. Invariant tiền

- Draft không tạo movement.
- Một voucher posted tạo đúng một movement tổng tiền, trừ operation reversal/refund được ghi rõ.
- Allocation không tạo movement.
- Movement phải tham chiếu voucher hoặc operation import hợp lệ.
- Số dư account không được âm nếu policy account không cho phép âm.
- Báo cáo dòng tiền lấy từ movement có hiệu lực; không chỉ lọc voucher.status = posted.

### 13.4. Invariant tenant và authorization

- Mọi FK finance mới cần composite tenant validation hoặc composite FK.
- RPC không tin tenant do client gửi nếu không kiểm tra user membership/permission.
- SECURITY DEFINER phải đặt search_path an toàn và kiểm tra auth.uid().
- Không cấp quyền insert/update trực tiếp lên bảng posted cho client.
- Mọi view có dữ liệu tenant phải dùng policy/grant phù hợp và kiểm tra cross-tenant.

## 14. Read model và báo cáo

### 14.1. Công nợ tại ngày chốt

Read model phải nhận as_of_date, tenant, currency và bộ lọc đối tượng.

```text
gross_receivable
= posted obligations effective <= D
+ adjustments tăng effective <= D
- adjustments giảm effective <= D

settled
= active allocations effective <= D
- reversed allocations effective <= D

outstanding
= gross_receivable - settled
```

Không dùng greatest(..., 0) để che sai lệch. Nếu outstanding âm, báo lỗi dữ liệu/exception report riêng.

### 14.2. Ứng trước chưa phân bổ

```text
unapplied_advance(D)
= posted advance lines effective <= D
- active allocations effective <= D
- refunds effective <= D
```

Phải phân nhóm theo:

- Tenant.
- Customer/party.
- Contract scope.
- Currency.
- Source voucher/line.
- Ngày hiệu lực.
- Đã dùng/đã hoàn/còn lại.

Không cộng unapplied_advance vào total_paid của obligation nếu chưa có allocation.

### 14.3. Dòng tiền và sổ tài khoản

- Cashflow phản ánh tiền thực tế vào/ra.
- Allocation không xuất hiện như một dòng thu/chi mới.
- Sổ tài khoản nội bộ không mặc định đồng nghĩa với sao kê ngân hàng đã đối soát.
- Báo cáo as-of phải xét effective date của movement và reversal.
- Opening balance phải có ngày bắt đầu và nguồn xác minh.

### 14.4. Tổng quan khách hàng

Customer overview phải tách tối thiểu:

- Planned charges.
- Posted receivable/payable.
- Paid/allocated.
- Outstanding.
- Overdue.
- Unapplied advance/credit.
- Cash transactions.

Mỗi tổng phải chỉ rõ loại tiền và ngày chốt. Không dùng một chỉ số net_exposure để thay thế các thành phần gốc.

## 15. Migration và rollout không breaking change

### Phase 0 — Hardening trước khi mở rộng

- Inventory schema/RPC/view/cron/API đang deployed.
- Xác nhận migration history và function signature trên từng môi trường.
- Chặn direct write vào posted obligation.
- Sửa aggregate allocation, tenant/currency/scope và replay invariants.
- Bổ sung test negative, concurrency và retry.
- Không drop bảng hoặc xóa dữ liệu lịch sử.

### Phase 1 — Chuẩn hóa contract

- Bổ sung nullable effective_date, recognition_basis, provenance/policy version và audit fields.
- Thêm RPC create/post obligation.
- API boundary dùng contract canonical; frontend không đọc fallback/dual-shape. Nếu cần tương thích API cũ, xử lý ở server boundary bằng migration/RPC.
- Bổ sung read model advance/unapplied credit.
- Không thay đổi ý nghĩa các field cũ.
- Backfill theo tenant và đối soát số lượng/số tiền trước sau.

### Phase 2 — Hoàn thiện subledger

- Adjustment.
- Reverse allocation.
- Refund.
- Reverse voucher.
- Period lock.
- As-of reports.
- Bank reconciliation.
- Audit timeline.

### Phase 3 — Kế toán tổng hợp

- Invoice/credit note.
- Revenue recognition.
- Contract asset/liability.
- Journal entries/lines.
- Chart of accounts/mapping.
- VAT/tax.
- GL reconciliation.
- Financial reports.

Mỗi phase phải có:

- Migration additive.
- Compatibility view/RPC.
- Backfill idempotent.
- Dual-read hoặc shadow comparison.
- Canary theo tenant.
- Kiểm tra ID-level và tổng tiền.
- Kế hoạch forward-fix sau khi đã có transaction mới.
- Không rollback bằng restore snapshot sau khi production đã phát sinh giao dịch; dùng adjustment/reversal có audit.

## 16. Test contract trước nghiệm thu implementation

### 16.1. Happy paths

- Manual obligation không làm tăng cash.
- Contract charge tạo đúng một obligation.
- Payment một phần và toàn phần.
- Một payment phân bổ nhiều obligations.
- Nhiều payments phân bổ một obligation.
- Advance chưa phân bổ không giảm AR.
- Advance phân bổ về sau không tạo movement mới.
- Advance theo contract chỉ dùng được đúng contract.
- Refund/reversal giữ nguyên lịch sử gốc.

### 16.2. Integrity và security

- Hai lines cùng phân bổ một obligation vượt tổng.
- Hai người cùng dùng một advance.
- Hai người cùng thanh toán phần còn lại.
- Retry sau timeout.
- Double submit.
- Replay cùng key cùng payload.
- Replay cùng key khác payload/target.
- Sai tenant/customer/contract/currency/direction.
- Cross-tenant ID đã biết.
- Direct insert/update posted qua REST.
- Gọi RPC không đủ permission.
- Backdate vào kỳ đã khóa.
- Đổi charge sau khi obligation đã post.
- Giảm phí sau khi đã thanh toán.
- Đảo một allocation đã có nhiều giao dịch liên quan.

### 16.3. As-of và đối soát

Với từng test mutation, đối chiếu đồng thời:

- Row nguồn.
- Voucher/line.
- Obligation.
- Allocation.
- Movement.
- Customer overview.
- Contract detail.
- Finance obligations report.
- Cashflow report.
- Account ledger.
- Audit/operation.

Kết quả phải giải thích được bằng công thức tại ngày chốt, không chỉ bằng trạng thái hiện tại.

## 17. Acceptance criteria

Spec này được xem là đủ điều kiện để bắt đầu hardening implementation khi:

- Core tables giữ nguyên vai trò và ID.
- Direct posted writes bị chặn.
- State transition được enforce ở server/DB.
- Aggregate allocation không thể vượt nợ hoặc nguồn.
- Retry không nhân đôi.
- Tenant/currency/party/scope được kiểm tra ở write boundary.
- Obligation posted không bị trigger ghi đè.
- Advance có read model riêng.
- Báo cáo không che sai số dư âm.
- Các test bắt buộc ở mục 16 có bằng chứng.
- Chính sách recognition_policy được ghi rõ cho nghiệp vụ hiện tại.
- Kế toán xác nhận phạm vi subledger và không gọi v1 là full accounting.

## 18. Các quyết định chưa thể tự suy ra từ code

Các quyết định sau có nhãn ACCOUNTING-DECISION và phải được người phụ trách kế toán chốt:

1. Ghi nhận phải thu theo ngày đến hạn, nghiệm thu, hóa đơn hay quyền thu vô điều kiện.
2. Tiền khách trả trước được trình bày như advance/unapplied credit hay contract liability trong báo cáo kế toán.
3. Cách xử lý VAT/hóa đơn khi thu trước, hoàn tiền hoặc giảm phí.
4. Chế độ kế toán áp dụng, hệ thống tài khoản và kỳ khóa sổ.
5. Có cho phép backdate, sửa kỳ cũ và tự động phân bổ hay không.
6. Cách xử lý ngoại tệ, tỷ giá và chênh lệch tỷ giá.
7. Mốc cutover và opening balance khi chuyển dữ liệu cũ.

Trong lúc chưa chốt các quyết định này, có thể triển khai hardening kỹ thuật và subledger vận hành, nhưng không được tự động suy ra doanh thu, VAT, contract liability hoặc số liệu báo cáo tài chính từ phiếu thu/chi.

## 19. Definition of Done

Một hạng mục mở rộng chỉ được xem là hoàn tất khi có đủ:

- Spec nghiệp vụ và API contract.
- Migration additive đã review.
- RPC/write boundary đã có permission và idempotency.
- Invariant được enforce bằng DB hoặc server.
- Unit/integration tests.
- Negative/concurrency/security tests phù hợp.
- Read model/report đã đối soát.
- Migration/backfill evidence.
- Audit trail.
- Tài liệu rollback/forward-fix.
- Xác nhận không làm thay đổi kết quả của bốn luồng nền tảng đã nghiệm thu.

## 20. Trạng thái triển khai hardening lần 1

Ngày triển khai: 16/09/2026. Môi trường: dev database, ứng dụng Vite dev trên port 5174.

Đã triển khai migration additive [`20260916120000_harden_finance_write_contract.sql`](../../../supabase/migrations/20260916120000_harden_finance_write_contract.sql), không xóa bảng hoặc dữ liệu lịch sử. Migration đã được preflight, dry-run trong transaction rollback, apply chính thức và xác minh qua PostgreSQL session pooler của đúng project.

Phạm vi đã hoàn thành:

- Bổ sung bắt buộc `effective_date` và `recognition_basis`; backfill `effective_date` từ `document_date`.
- Công nợ đã post không thể bị sửa/xóa trực tiếp; thay đổi phải đi qua adjustment/reversal ở phase mở rộng.
- Đồng bộ công nợ từ contract charge không còn ghi đè obligation đã post; thay đổi sau post bị từ chối.
- Ghi công nợ thủ công đi qua RPC `create_finance_obligation`; frontend không còn insert trực tiếp hoặc gửi `status`/`posted_at` do client tự quyết định.
- Save/post voucher và phân bổ ứng trước nhận `request_key` từ intent thao tác; replay cùng key/cùng payload trả lại kết quả cũ, key dùng khác payload bị từ chối.
- Post voucher kiểm tra tenant, tài khoản, khách hàng/nhân viên, chiều công nợ, loại tiền, phạm vi hợp đồng và tổng phân bổ trên toàn bộ voucher; không chỉ kiểm tra từng dòng riêng lẻ.
- Read model công nợ dùng `effective_date`, hiển thị chênh lệch âm thay vì che bằng `greatest(..., 0)`; tổng hợp credit ứng trước chưa phân bổ được tách riêng.
- Frontend chỉ đọc canonical shape mới, không có fallback field/dual-shape cho dữ liệu legacy.

Bằng chứng xác minh:

- `npx tsc --noEmit`: đạt.
- Focused import lint cho các file finance/customer thay đổi: đạt.
- Regression tests finance/customer: 8 test files, 21 tests đạt.
- `npm run build`: đạt; chỉ còn cảnh báo kích thước bundle và annotation từ dependency Zod.
- Runtime route `/finance/obligations`, `/finance/vouchers` và form lập phiếu thu trên port 5174 tải đúng dữ liệu; không có lỗi ứng dụng trong console.
- DB invariant sau migration: không có obligation thiếu `effective_date`, obligation posted thiếu `posted_at`, advance contract thiếu contract hoặc outstanding âm.
- Contract probe rollback: RPC create + replay tạo cùng một kết quả; update trực tiếp obligation posted bị chặn; phân bổ cùng một obligation qua hai dòng vượt tổng bị chặn và voucher vẫn ở trạng thái draft.

Các phần chưa được đánh dấu hoàn tất của spec vẫn giữ nguyên: UI quản trị cho event subledger và khóa kỳ, concurrency test bằng nhiều session thật, user thiếu quyền/sai tenant, VAT/GL và các quyết định kế toán cần owner chốt.

## 21. Trạng thái triển khai tranche nền tảng Phase 2

Ngày triển khai: 16/09/2026. Môi trường: dev database, ứng dụng Vite dev trên port 5174.

Migration additive [`20260916140000_finance_period_and_as_of_read_models.sql`](../../../supabase/migrations/20260916140000_finance_period_and_as_of_read_models.sql) đã được dry-run trong transaction rollback, apply chính thức và ghi vào `supabase_migrations.schema_migrations`. Không xóa bảng, không đổi ID và không xóa dữ liệu test.

Phạm vi đã triển khai:

- Thêm `finance_period_locks` và RPC `close_finance_period`; các thao tác ghi nhận obligation, post voucher, movement và allocation bị chặn khi ngày hiệu lực nằm trong kỳ đã khóa.
- Thêm kiểm tra tenant/customer/currency của contract link ở line; ứng trước theo hợp đồng bắt buộc có hợp đồng và ứng trước theo khách hàng không được gắn hợp đồng.
- Siết `allocate_finance_advance`: hash idempotency bao gồm operation/tenant/source/target/amount/date, replay kiểm tra loại operation và quyền trước khi trả kết quả, kiểm tra ngày không sớm hơn source/target, kiểm tra kỳ khóa và serialize retry cùng request key.
- Thêm các RPC canonical `get_finance_obligation_balances_as_of`, `get_finance_advance_balances_as_of` và `get_customer_finance_summary_as_of`. Read model tính theo `effective_date`, giữ nguyên số dư âm để báo lỗi dữ liệu và tách ứng trước chưa phân bổ khỏi tiền đã phân bổ.
- Báo cáo công nợ cho phép chọn ngày chốt; tổng quan khách hàng hiển thị riêng ứng trước chưa phân bổ và tiền thu thực tế. Form phiếu cho phép một dòng phân bổ nhiều công nợ và lọc công nợ theo khách hàng/phạm vi hợp đồng.
- Frontend chỉ tiêu thụ shape canonical mới; không thêm fallback field hoặc chuyển đổi client cho dữ liệu legacy.

Bằng chứng xác minh tranche:

- Preflight migration history, dry-run và apply transaction: đạt; migration `20260916140000` có trong lịch sử dev.
- Kiểm tra function signature và trigger period/scope: đạt; đủ 6 RPC/read-model function và 5 trigger guard tồn tại.
- Probe rollback: read model obligation/advance/summary gọi được; tạo khóa kỳ và kiểm tra ngày bị khóa trả `true`; transaction được rollback, không để lại probe data.
- `npx tsc --noEmit` và focused import lint sau thay đổi: đạt. Unit tests model/customer/finance và component: 5 file, 16 tests đạt.

Phạm vi vẫn chưa hoàn tất của toàn bộ spec: UI quản trị adjustment/reversal/refund/reconciliation/audit và đóng kỳ; kiểm thử concurrency/security bằng nhiều user thật; invoice/credit note, revenue recognition, contract asset/liability, journal/GL, VAT/tax và các quyết định recognition/tax/period policy cần owner kế toán chốt. Các event subledger đã có DB/RPC nền tảng nhưng chưa được gọi là nghiệm thu đầy đủ cho đến khi có UI, negative/concurrency evidence và đối soát nghiệp vụ.

## 22. Trạng thái triển khai event subledger và contract canonical

Ngày triển khai: 17/09/2026. Môi trường: dev database, ứng dụng Vite dev trên port 5174.

Đã triển khai thêm các migration additive `20260916150000_finance_subledger_events.sql`, `20260916151000_fix_finance_event_operation_links.sql`, `20260916152000_finance_canonical_obligation_detail_read_model.sql`, `20260916153000_finance_event_write_guards.sql` và `20260916154000_finance_allocation_write_guards.sql`. Migration 1500 bổ sung event layer cho điều chỉnh công nợ, đảo phân bổ, hoàn ứng trước, đảo phiếu, audit operation và bank reconciliation; migration 1510 sửa quan hệ tham chiếu operation để event và operation được ghi atomically mà không tạo vòng FK; migration 1520 bổ sung read model canonical cho màn hình chi tiết công nợ; migration 1530 chặn mismatch loại phiếu và khoản mục thu/chi; migration 1540 enforce allocation invariants trên mọi write path, bao gồm post voucher. Cả năm migration đã dry-run trong transaction rollback, apply chính thức và ghi lịch sử trên dev.

Phạm vi đã triển khai:

- `finance_obligation_adjustments` giữ delta điều chỉnh theo ngày hiệu lực; giảm công nợ không được làm thấp hơn số đã phân bổ.
- `finance_allocation_reversals` giữ event đảo phân bổ, hỗ trợ đảo một phần và không sửa allocation gốc.
- `finance_refund_links` và RPC hoàn ứng trước tạo phiếu chi posted, movement tiền và liên kết hoàn tiền về source advance; read model trừ cả allocation và refund.
- RPC đảo phiếu tạo movement đảo chiều, đảo các allocation liên quan bằng event và giữ lại metadata đảo trên voucher.
- `finance_operations.actor_user_id` và RPC audit timeline cung cấp đường truy vết operation/request/result; không coi đây là field-level audit đầy đủ.
- `finance_bank_statements`/`finance_bank_reconciliation_matches` và RPC import/reconcile tách sao kê ngân hàng khỏi movement; match hỗ trợ partial và không làm thay đổi sổ quỹ.
- Trigger allocation write guard kiểm tra tenant/party/currency/direction, ngày source/target, contract scope và số dư sau adjustment cho cả allocation từ post voucher lẫn RPC ứng trước.
- Các read model obligation/customer/advance đã tính adjustment, reversal và refund theo ngày chốt; frontend finance chuyển sang RPC canonical, không đọc fallback/dual-shape.

Bằng chứng xác minh event layer:

- Preflight, dry-run và apply: đạt; migration `20260916150000`, `20260916151000`, `20260916152000`, `20260916153000` và `20260916154000` tồn tại trên dev.
- Probe trong transaction với user/tenant dev: adjustment tạo và replay cùng request key trả cùng kết quả; reverse allocation, refund advance, reverse voucher và audit timeline đều chạy được; toàn bộ probe rollback, không để lại test row.
- Khi probe phát hiện vòng FK operation/event, đã tạo migration sửa riêng, dry-run/apply thành công rồi chạy lại probe đạt.

Giới hạn còn lại: dev tenant hiện chưa có bank account nên chưa chạy được happy path reconcile thật; chưa có màn hình thao tác event; chưa chạy concurrency/security test bằng nhiều session/user. Không triển khai VAT, doanh thu, contract liability hay bút toán GL khi chưa có quyết định kế toán.
