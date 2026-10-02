# Button

> Hub: [`docs/06-component-usage-guide.md`](../06-component-usage-guide.md).

Variant (giữ nguyên tên API): `primary` (CTA xanh template), `light` (nền primary nhẹ), `secondary`,
`outline`, `outline-primary` (nền trong suốt, viền neutral, chữ primary), `ghost`, `dashed`,
`destructive`, `mono`. Size: `sm | md | lg | icon`. `mode="icon"` cho nút chỉ có icon;
`mode="input"` cho nút trông như ô field (dùng làm trigger Combobox/MultiSelect).

```tsx
import { Plus, Filter, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

<Button variant="primary"><Plus /> Cấp tài khoản</Button>

<Button variant="outline" mode="icon" aria-label="Lọc danh sách"><Filter /></Button>
<Button variant="outline-primary"><Filter /> Lọc</Button>

<Button variant="secondary" size="sm"><ShieldCheck /> Phân quyền</Button>
```

- Nút icon **bắt buộc** có `aria-label`.
- Không tự đặt `h-9 px-4 bg-[#...]` — nếu default chưa đúng template, sửa default trong `button.tsx`.
