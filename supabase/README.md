# Supabase trong dự án

Supabase chỉ là nơi lưu dữ liệu tạm cho phát triển và thử nghiệm trước khi có
backend EpsQRCode. Mỗi môi trường cần dùng một Supabase project riêng; không
dùng project, dữ liệu hay khóa production của khách hàng trong môi trường phát
triển.

Trong giai đoạn test, tài khoản đăng nhập được tạo riêng trên Supabase Auth;
UUID của tài khoản là identity dùng cho `user_profiles`, `user_roles` và RLS.
EpsQRCode dùng một workspace duy nhất. Không đăng nhập qua EPS cookie và không
lấy account hay dữ liệu danh mục từ EPS Training/PLEpsClient.

Frontend gọi Supabase qua [`src/lib/supabase.ts`](../src/lib/supabase.ts) bằng
publishable/anon key. RLS và các RPC dùng `auth.uid()` để giới hạn dữ liệu theo
tài khoản Supabase đã đăng nhập. Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào
frontend.

## Cấu hình local

Sao chép `.env.example` thành `.env.local`, rồi điền URL và publishable/anon key
cho project thử nghiệm:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
VITE_SUPABASE_SCHEMA=public
```

Nếu dùng luồng tạo tài khoản nhân viên, cấu hình `SUPABASE_LOGIN_DOMAIN` cùng
giá trị trong secrets của Edge Function `employee-account`. Không đưa
`SUPABASE_SERVICE_ROLE_KEY` vào `VITE_*` hoặc frontend.

## Khởi tạo cơ sở dữ liệu

Các migration trong `supabase/migrations` là schema hiện hành của EpsQRCode.
Áp dụng migration theo version; không chạy lại migration đã có trong
`supabase_migrations.schema_migrations`.

## Danh mục nhóm vật tư

`material_groups` là danh mục dùng chung toàn hệ thống. Mã nhóm duy nhất, không
phân biệt chữ hoa/thường; ID UUID do database tự sinh. Nhóm quyền `Nhóm vật tư`
thuộc module `Vật tư`, với hai
quyền `Xem` và `Thêm, sửa, xóa` được kiểm tra theo các mã
`material_catalog:material_group:view` và
`material_catalog:material_group:manage` trong role đang gán cho tài khoản.
Không nạp danh mục cũ từ EPS Training/PLEpsClient.

## Tài khoản và quyền

Tài khoản test được tạo trong Supabase Auth; `user_profiles` là hồ sơ ứng dụng
gắn với `auth.users`. Mỗi Auth account tự có một hồ sơ trong `employees`, liên
kết qua `employees.user_id`. Role được định nghĩa một lần trong `roles`;
`user_roles.user_id` gắn role vào UUID Supabase Auth. Quyền hiệu lực được tính
từ `role_permissions` và account overrides.

Tạo account test trong Supabase Dashboard → Authentication → Users. Hồ sơ ứng
dụng và hồ sơ nhân viên được tạo tự động từ Auth trigger. Vai trò mặc định
`system_admin` tên `Quản trị hệ thống` có toàn quyền và là vai trò hệ thống.
Đăng nhập bằng email đầy đủ; `VITE_SUPABASE_URL` xác định project.

Để khởi tạo quản trị viên đầu tiên trên project phát triển, lấy UUID của account
đã tạo trong Auth rồi gán role `system_admin` một lần bằng SQL:

```sql
insert into public.user_roles (user_id, role_id)
select '<auth-user-uuid>', id
from public.roles
where code = 'system_admin'
on conflict do nothing;
```

Màn hình role, permission catalog, mã quyền và luồng thao tác tham khảo
`C:\Users\PC\Desktop\web-template`. Dùng UI, permission catalog và hành vi
role của model này trong EpsQRCode; gắn role trực tiếp vào account.

Các account, danh mục và nghiệp vụ test phải là dữ liệu mới do EpsQRCode sở
hữu. Chỉ tạo những bảng và seed records tối thiểu để chạy luồng đang làm; không
cần sao chép đầy đủ danh mục EPS Training. Các policy dev-only, nếu có, phải
được ghi rõ và chỉ áp dụng trên project phát triển.

Khi backend EpsQRCode sẵn sàng, thay adapter Supabase bằng API backend, giữ hợp
đồng role/permission của giao diện, xác thực account ở server và kiểm tra quyền
ở phía server trước khi cho phép thao tác dữ liệu.

## Tệp và lưu trữ

Tệp được lưu theo đường dẫn chung của workspace; không phân vùng theo khách
hàng hay tổ chức.
