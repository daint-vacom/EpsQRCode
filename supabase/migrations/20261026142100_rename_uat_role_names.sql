update public.roles as role
set name = role_labels.name
from (
  values
    (
      'UAT_DEPARTMENT_READER',
      'Người xem dữ liệu theo phòng ban'
    ),
    ('UAT_EPS_READER', 'Người xem dữ liệu toàn EPS'),
    ('UAT_EXTERNAL_OPERATOR', 'Điều phối viên đơn vị ngoài'),
    ('UAT_EXTERNAL_READER', 'Người xem đơn vị ngoài'),
    ('UAT_TEAM_OPERATOR', 'Điều phối viên tổ/nhóm'),
    ('UAT_WAREHOUSE_OPERATOR', 'Nhân viên vận hành kho')
) as role_labels(code, name)
where role.code = role_labels.code
  and upper(btrim(role.name)) = upper(role.code);
