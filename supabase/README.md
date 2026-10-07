# Supabase trong dự án

Supabase được giữ làm backend tạm thời cho các luồng nguyên mẫu trước khi có
backend riêng. Mỗi môi trường cần dùng một Supabase project riêng; không dùng
project, dữ liệu hay khóa production của khách hàng trong môi trường phát triển.

Frontend gọi Supabase Auth, PostgREST và Storage qua
[`src/lib/supabase.ts`](../src/lib/supabase.ts). Browser chỉ dùng publishable/anon
key; dữ liệu tenant được giới hạn bằng RLS và kiểm tra quyền ở database.

## Cấu hình local

Sao chép `.env.example` thành `.env.local`, rồi điền URL, publishable/anon key
và domain đăng nhập username cho project thử nghiệm:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
VITE_SUPABASE_SCHEMA=public
VITE_SUPABASE_LOGIN_DOMAIN=<development-login-domain>
```

Nếu dùng luồng tạo tài khoản nhân viên, cấu hình `SUPABASE_LOGIN_DOMAIN` cùng
giá trị trong secrets của Edge Function `employee-account`. Không đưa
`SUPABASE_SERVICE_ROLE_KEY` vào `VITE_*` hoặc frontend.

## Khởi tạo cơ sở dữ liệu

Các migration trong `supabase/migrations` là nguồn cấu trúc cho project mới.
Chúng bao gồm tenant và hồ sơ người dùng, role cùng quyền theo tenant, nhân viên,
nhãn dùng chung, cấu hình trường bổ sung, chế độ xem đã lưu, tiền tệ và định dạng,
tệp, quota lưu trữ, avatar nhân viên, cùng các RPC hỗ trợ danh sách và phân vai.

Chạy migration theo thứ tự timestamp bằng Supabase CLI trên project phát triển
được cấu hình rõ ràng. Không chạy migration lên project production hoặc project
khách hàng từ repository này.

## Tenant, tài khoản và quyền

- `auth.users` là identity đăng nhập toàn cục. `user_profiles` lưu hồ sơ dùng
  chung, còn `tenant_members` liên kết người dùng với từng tenant.
- `create_tenant` tạo tenant, membership owner, các role mặc định theo tenant và
  gán role quản trị viên cho người tạo.
- Role được lưu trong `roles` theo tenant; thành viên có thể nhận nhiều role
  qua `tenant_member_roles`. Quyền hiệu lực kết hợp role và override user.
- Các bảng tenant bật RLS. RPC có quyền cao dùng `SECURITY DEFINER`, cố định
  `search_path`, kiểm tra membership/quyền và chỉ cấp execute cho role cần thiết.

## Nhãn và dữ liệu mở rộng

`tag_groups`, `tags` và `tag_assignments` là bộ nhãn dùng chung cho các loại đối
tượng. Nhóm nhãn hệ thống bảo vệ cấu trúc nhóm; quyền `system:tag:*` kiểm soát
việc xem và thay đổi catalog. Trường mở rộng theo tenant hiện chỉ được cấu hình
cho nhân viên; khi bổ sung loại đối tượng cần thêm hỗ trợ một cách chủ động.

## Tệp và lưu trữ

File Manager dùng `files`, `file_links`, `file_folders` và
`tenant_storage_quotas`. Folder có thể là root dùng chung, root tùy chỉnh hoặc
folder gắn với một đối tượng có hỗ trợ. Tệp được lưu trong bucket riêng tư và
được truy cập theo tenant; không dùng khóa service role ở client.
