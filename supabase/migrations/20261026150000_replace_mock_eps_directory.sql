-- Replace the synthetic active EPS directory with the supplied real catalog.
-- Keep old rows inactive so existing mock employee/profile references remain valid.

-- Avoid a PL/pgSQL variable/column collision in the existing row-sync trigger.
-- Prefix local variables so inserts and updates can keep syncing future records.
create or replace function private.sync_eps_custodian_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source jsonb;
  v_source_type text;
  v_source_id text;
  v_source_code text;
  v_source_name text;
  v_parent_source_id text;
  v_source_active boolean;
  v_parent_party_id uuid;
begin
  v_source := to_jsonb(new);
  if tg_table_name = 'fake_eps_departments' then
    v_source_type := 'eps_department';
    v_source_id := v_source->>'id';
    v_source_code := v_source->>'code';
    v_source_name := v_source->>'name';
    v_source_active := coalesce((v_source->>'is_active')::boolean, true);
  elsif tg_table_name = 'fake_eps_teams' then
    v_source_type := 'eps_team';
    v_source_id := v_source->>'id';
    v_source_code := v_source->>'code';
    v_source_name := v_source->>'name';
    v_parent_source_id := v_source->>'department_id';
    v_source_active := coalesce((v_source->>'is_active')::boolean, true);
  elsif tg_table_name = 'fake_eps_employees' then
    v_source_type := 'eps_person';
    v_source_id := v_source->>'id';
    v_source_code := v_source->>'employee_code';
    v_source_name := concat_ws(' ', v_source->>'last_name', v_source->>'first_name');
    v_parent_source_id := coalesce(nullif(v_source->>'team_id', ''), v_source->>'department_id');
    v_source_active := v_source->>'employment_status' = 'active';
  else
    raise exception 'Unsupported EPS source table: %', tg_table_name using errcode = '22023';
  end if;

  if v_parent_source_id is not null then
    select party.id into v_parent_party_id
    from public.material_custodians party
    where party.source_id = v_parent_source_id
      and party.source_type = case
        when v_source_type = 'eps_person' and exists (
          select 1 from private.fake_eps_teams team where team.id = v_parent_source_id
        ) then 'eps_team'
        else 'eps_department'
      end;
    if v_parent_party_id is null and v_source_type <> 'eps_person' then
      raise exception 'EPS department must be synced before its child' using errcode = '23503';
    end if;
  end if;

  insert into public.material_custodians (
    type, code, name, parent_id, is_active, source_type, source_id
  ) values (
    case v_source_type when 'eps_department' then 'department'
      when 'eps_team' then 'team' else 'person' end,
    v_source_code, v_source_name, v_parent_party_id, v_source_active, v_source_type, v_source_id
  )
  on conflict (source_type, source_id)
    where source_type is not null and source_id is not null
  do update set
    type = excluded.type,
    code = excluded.code,
    name = excluded.name,
    parent_id = excluded.parent_id,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());
  return new;
end;
$$;
revoke all on function private.sync_eps_custodian_source() from public, anon, authenticated;

insert into private.fake_eps_departments (id, code, name, is_active) values
  ('ccafa80a-e1c5-4f51-9657-0687020cb140', 'P06', 'Phòng Kinh Doanh', true),
  ('da35e95f-8854-43f8-be59-200a4309268e', 'P03', 'Phòng Kế Hoạch - Vật Tư', true),
  ('7df5b38a-9b3f-4711-9b1c-227921531b39', 'P12', 'Phân xưởng Sửa chữa Điện - Tự động Mông Dương', true),
  ('dc4f18c3-d44b-4bb4-bd56-6d72b8ef836b', 'P13', 'Phân xưởng Sửa chữa Cơ - Nhiệt Mông Dương', true),
  ('acde23d7-ddfa-492e-a592-755ba43d85c8', 'P09', 'Phân xưởng Sửa chữa Cơ - Nhiệt Phú Mỹ', true),
  ('7a263b98-ece2-43e1-9d16-7a5a7e3cbc45', 'P04', 'Phòng Kỹ Thuật - An Toàn', true),
  ('8ffa0e3c-14d6-4151-988c-878d7eb87b3b', 'P05', 'Phòng Kiểm Tra - Đánh Giá', true),
  ('77a4b784-0c2b-4fb0-b451-a3d04b3b62ff', 'P02', 'Phòng Tài Chính - Kế Toán', true),
  ('9bcba2c0-2058-4d92-a63b-bc1b5178a1e4', 'P11', 'Phân xưởng Sửa chữa Cơ - Nhiệt Vĩnh Tân', true),
  ('5007bcd7-98e5-4b9a-8775-d19af5e0e2a5', 'P10', 'Phân xưởng Sửa chữa Điện - Tự động Vĩnh Tân', true),
  ('dee68390-db0a-4200-8148-e344464956f0', 'P07', 'Phân xưởng Gia công - Phục hồi', true),
  ('23cef76d-761b-48e8-9016-e61d670fef8f', 'P00', 'Lãnh đạo Công ty', true),
  ('3cb63570-7368-40c6-baa9-f60426636d49', 'P08', 'Phân xưởng Sửa chữa Điện - Tự động Phú Mỹ', true),
  ('1da97a49-f5ba-4419-b05c-fa047a958f5b', 'P01', 'Phòng Hành Chính - Lao Động', true)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  is_active = excluded.is_active;

insert into private.fake_eps_teams (id, code, name, department_id, is_active) values
  ('48011b8d-67ea-469a-a430-0139a776f3b6', 'P04.05', 'Tổ An toàn - HSE', '7a263b98-ece2-43e1-9d16-7a5a7e3cbc45', true),
  ('54a99ba3-3484-4977-af46-050bfebb0f7f', 'P13.01', 'Tổ Kế hoạch - Kỹ thuật', 'dc4f18c3-d44b-4bb4-bd56-6d72b8ef836b', true),
  ('6948d29f-474b-4f8d-9595-0520abd97ed2', 'P02.03', 'Tổ Vật tư', 'da35e95f-8854-43f8-be59-200a4309268e', true),
  ('3e384d11-3058-4701-85e1-0c76d0e4145c', 'P08.05', 'Tổ Kế hoạch - Vật tư - Văn phòng', '3cb63570-7368-40c6-baa9-f60426636d49', true),
  ('453e662b-c2c9-4b20-81b5-104453bcbf04', 'P01.01', 'Tổ Pháp chế - Tổ chức - Cán bộ', '1da97a49-f5ba-4419-b05c-fa047a958f5b', true),
  ('32553a51-e128-40b0-8db8-17b2f2dc2817', 'P10.02', 'Tổ Sửa chữa điện', '5007bcd7-98e5-4b9a-8775-d19af5e0e2a5', true),
  ('75fe4697-11d2-450e-884a-1f599476f6f9', 'P12.03', 'Tổ Thí nghiệm điện', '7df5b38a-9b3f-4711-9b1c-227921531b39', true),
  ('07909153-cdb9-4faa-9281-211fc47aeebb', 'P13.06', 'Tổ sửa chữa Nhiên liệu', 'dc4f18c3-d44b-4bb4-bd56-6d72b8ef836b', true),
  ('6dcba758-0430-47ea-929d-22b40c74cd01', 'P08.03', 'Tổ Thí nghiệm điện', '3cb63570-7368-40c6-baa9-f60426636d49', true),
  ('4207c883-be48-4fc2-a617-23e336ce7460', 'P13.02', 'Tổ Kiểm tra - Đánh giá - Vật tư', 'dc4f18c3-d44b-4bb4-bd56-6d72b8ef836b', true),
  ('9e392591-e854-4022-a421-261af5647f63', 'P13.03', 'Tổ sửa chữa Tuabin', 'dc4f18c3-d44b-4bb4-bd56-6d72b8ef836b', true),
  ('37821f5a-da3c-402b-8a88-277de06e449c', 'P06.03', 'Khác', 'ccafa80a-e1c5-4f51-9657-0687020cb140', true),
  ('db611448-adbf-403e-90e6-30d0f3df9279', 'P03.03', 'Tổ Tổng hợp - Tài chính', '77a4b784-0c2b-4fb0-b451-a3d04b3b62ff', true),
  ('ab576cc5-d808-4e9e-a191-34ac4bc785a8', 'P10.05', 'Tổ Sửa chữa Thường xuyên', '5007bcd7-98e5-4b9a-8775-d19af5e0e2a5', true),
  ('1ed15e6b-320c-4888-a96e-361d6ee31bed', 'P03.01', 'Tổ Thanh toán', '77a4b784-0c2b-4fb0-b451-a3d04b3b62ff', true),
  ('fee0c2bf-868d-4d6a-b413-38eb5897053a', 'P07.01', 'Tổ Kế hoạch - Kỹ thuật', 'dee68390-db0a-4200-8148-e344464956f0', true),
  ('b90bb259-e6b4-4f98-9936-41056012546a', 'P13.05', 'Tổ SC Bơm van - Gia công phục hồi', 'dc4f18c3-d44b-4bb4-bd56-6d72b8ef836b', true),
  ('b5c47803-12c5-423c-9924-43906c04b278', 'P02.00', 'Lãnh đạo phòng', 'da35e95f-8854-43f8-be59-200a4309268e', true),
  ('be364812-24ec-45e6-b582-468f3b0fdecd', 'P11.00', 'Lãnh đạo Phân xưởng', '9bcba2c0-2058-4d92-a63b-bc1b5178a1e4', true),
  ('bcd327c7-b43e-4e53-9fbd-48e0fd4ab0f5', 'P11.05', 'Tổ Sửa chữa Bơm van', '9bcba2c0-2058-4d92-a63b-bc1b5178a1e4', true),
  ('3096c20d-689a-4609-a20d-4d4facd0fc7b', 'P04.03', 'Tổ Kỹ thuật Điện - I&C', '7a263b98-ece2-43e1-9d16-7a5a7e3cbc45', true),
  ('a843aa0d-bf1e-458b-96e9-542eafc037be', 'P07.00', 'Lãnh đạo Phân xưởng', 'dee68390-db0a-4200-8148-e344464956f0', true),
  ('b7b5cc8b-ca8d-401a-a297-54bcffc9f0f3', 'P05.00', 'Lãnh đạo Phòng', '8ffa0e3c-14d6-4151-988c-878d7eb87b3b', true),
  ('bd6007a9-9fe0-44ee-a516-5753bb90ffc5', 'P11.07', 'Tổ Sửa chữa Thường xuyên', '9bcba2c0-2058-4d92-a63b-bc1b5178a1e4', true),
  ('3ef558a1-0237-4e61-829f-58098b393d20', 'P09.05', 'Tổ Sửa chữa tuabin PM21 và PM4', 'acde23d7-ddfa-492e-a592-755ba43d85c8', true),
  ('cfc1d6eb-0c24-4493-a35f-5ac183949830', 'P00.00', 'Ban lãnh đạo', '23cef76d-761b-48e8-9016-e61d670fef8f', true),
  ('5d9d8db7-d4ce-46f3-9939-5ef0d7408e7f', 'P04.06', 'Tổ Đầu tư - Xây dựng', '7a263b98-ece2-43e1-9d16-7a5a7e3cbc45', true),
  ('ae2f9d07-10de-46dc-8c9b-62b09fd2025f', 'P07.04', 'Tổ Hàn - Phun phủ', 'dee68390-db0a-4200-8148-e344464956f0', true),
  ('b43c790d-f28f-4e56-98f6-646b8776a5bc', 'P09.00', 'Lãnh đạo Phân xưởng', 'acde23d7-ddfa-492e-a592-755ba43d85c8', true),
  ('45966a9a-33bb-418d-b5c9-6f868c4d45da', 'P11.06', 'Tổ Sửa chữa Hệ thống nhiên liệu', '9bcba2c0-2058-4d92-a63b-bc1b5178a1e4', true),
  ('68ff8682-4905-4040-bb20-74ffa642c1d7', 'P09.06', 'Tổ Hàn - Sửa chữa Lò Hơi', 'acde23d7-ddfa-492e-a592-755ba43d85c8', true),
  ('0cc16ce2-6890-4b03-b31b-75f09b2299a3', 'P04.02', 'Tổ Công nghệ Thông tin', '7a263b98-ece2-43e1-9d16-7a5a7e3cbc45', true),
  ('26e6ef04-7592-499a-821b-79160e2faa0d', 'P02.02', 'Tổ Hợp đồng ngoại', 'da35e95f-8854-43f8-be59-200a4309268e', true),
  ('eaa7a322-933d-4d9f-a1ed-7b845d596d1d', 'P02.05', 'Tổ Dự toán', 'da35e95f-8854-43f8-be59-200a4309268e', true),
  ('0168120b-3c97-4ded-8bd2-7edaa9d5fb6b', 'P13.07', 'Tổ Sửa chữa thường xuyên', 'dc4f18c3-d44b-4bb4-bd56-6d72b8ef836b', true),
  ('d7b2b312-30c5-45e8-b328-7ef691e24721', 'P03.00', 'Lãnh đạo phòng', '77a4b784-0c2b-4fb0-b451-a3d04b3b62ff', true),
  ('2fa21395-7306-492c-9994-7ff35e8dba2d', 'P08.01', 'Tổ Kế hoạch - Kỹ thuật', '3cb63570-7368-40c6-baa9-f60426636d49', true),
  ('c9e49e36-ce3c-4e9a-b394-8140f0af67dd', 'P07.03', 'Tổ Cân bằng động', 'dee68390-db0a-4200-8148-e344464956f0', true),
  ('1e7f1e70-2a6f-4bb5-95f9-83336cc037fa', 'P02.01', 'Tổ Đấu thầu - Hợp đồng', 'da35e95f-8854-43f8-be59-200a4309268e', true),
  ('8d9df783-f40c-4bda-b4d6-87e4410ca68b', 'P12.01', 'Tổ Kế hoạch - Kỹ thuật', '7df5b38a-9b3f-4711-9b1c-227921531b39', true),
  ('f317d961-e468-44fe-a6a8-88c694c4780e', 'P12.04', 'Tổ Kiểm nhiệt', '7df5b38a-9b3f-4711-9b1c-227921531b39', true),
  ('e4864721-1b3e-4460-a5fd-8a77f54ffcf0', 'P06.01', 'Tổ Phát triển thị trường', 'ccafa80a-e1c5-4f51-9657-0687020cb140', true),
  ('24c3502f-fcb4-4047-983c-8ae61419ba98', 'P07.02', 'Tổ Kiểm tra - Đánh giá - Vật tư', 'dee68390-db0a-4200-8148-e344464956f0', true),
  ('0dd54fa9-883d-4fb3-ae7b-8b74f7c4f004', 'P11.04', 'Tổ Sửa chữa Hàn Lò hơi', '9bcba2c0-2058-4d92-a63b-bc1b5178a1e4', true),
  ('6c083188-508d-4c4c-b046-8cf05c90e102', 'P09.02', 'Tổ Kiểm tra - Đánh giá - Vật tư', 'acde23d7-ddfa-492e-a592-755ba43d85c8', true),
  ('2d4ef02b-66a2-4eec-ae8e-910c52bdd5e7', 'P04.00', 'Lãnh đạo phòng', '7a263b98-ece2-43e1-9d16-7a5a7e3cbc45', true),
  ('cee2f234-d805-4155-8daa-9863a1150b1f', 'P06.02', 'Tổ Truyền thông', 'ccafa80a-e1c5-4f51-9657-0687020cb140', true),
  ('5d9b7d92-1c58-4208-aa5f-9f3deedaae77', 'P06.00', 'Lãnh đạo phòng', 'ccafa80a-e1c5-4f51-9657-0687020cb140', true),
  ('09013d4d-c019-4ca9-b03e-a463c7e4560e', 'P01.00', 'Lãnh đạo phòng', '1da97a49-f5ba-4419-b05c-fa047a958f5b', true),
  ('a1c7ada9-ad67-4936-bebb-a4c0b9e78417', 'P01.03', 'Tổ Đào tạo', '1da97a49-f5ba-4419-b05c-fa047a958f5b', true),
  ('20670454-0a7d-4a0e-93dc-b2fb43b74e5a', 'P04.01', 'Tổ Kế hoạch - Kỹ thuật', '7a263b98-ece2-43e1-9d16-7a5a7e3cbc45', true),
  ('ac2bafac-107b-48ae-9dec-b43ac2fb8a0a', 'P08.02', 'Tổ Sửa chữa điện', '3cb63570-7368-40c6-baa9-f60426636d49', true),
  ('78fcfcd8-5c15-4f04-aa3d-b4cbe33a0045', 'P04.04', 'Tổ Kỹ thuật Cơ -Nhiệt', '7a263b98-ece2-43e1-9d16-7a5a7e3cbc45', true),
  ('314002c3-a96b-4a70-956b-b58f53c001f0', 'P09.07', 'Tổ Sửa chữa Bơm, Van, Máy nén', 'acde23d7-ddfa-492e-a592-755ba43d85c8', true),
  ('3ed1571a-27cc-4758-be6e-ba27f6b4674e', 'P09.01', 'Tổ Kế hoạch - Kỹ thuật', 'acde23d7-ddfa-492e-a592-755ba43d85c8', true),
  ('662227b6-dfe5-46e4-b613-bc4692fa81d3', 'P09.08', 'Tổ Sửa chữa thường xuyên', 'acde23d7-ddfa-492e-a592-755ba43d85c8', true),
  ('9288d804-77aa-400c-9e7a-bf603a561d7f', 'P01.04', 'Tổ Lao động - Tiền lương - Chế độ', '1da97a49-f5ba-4419-b05c-fa047a958f5b', true),
  ('fd2ce4f1-1053-4fb1-bc81-c0d734b140c9', 'P12.02', 'Tổ sửa chữa điện', '7df5b38a-9b3f-4711-9b1c-227921531b39', true),
  ('93638260-6d34-4b3f-a557-c407aed31c1f', 'P09.04', 'Tổ Sửa chữa tuabin PM1', 'acde23d7-ddfa-492e-a592-755ba43d85c8', true),
  ('7a500958-58b7-486c-98a6-c4708b7d5e55', 'P11.02', 'Tổ Kiểm tra - Đánh giá - Vật tư', '9bcba2c0-2058-4d92-a63b-bc1b5178a1e4', true),
  ('ca4876a5-f521-4e3e-b6bf-c8d5e689510e', 'P07.06', 'Tổ Công xa', 'dee68390-db0a-4200-8148-e344464956f0', true),
  ('0edac97c-a53b-4770-9335-c90b3356b255', 'P05.02', 'Tổ Phân tích - Chẩn đoán - Đánh giá', '8ffa0e3c-14d6-4151-988c-878d7eb87b3b', true),
  ('40a3b2c3-1a16-42b7-8553-c9688720e1b5', 'P10.00', 'Lãnh đạo Phân xưởng', '5007bcd7-98e5-4b9a-8775-d19af5e0e2a5', true),
  ('9d5d9fc4-4354-4a65-b963-cb1548a054b9', 'P10.03', 'Tổ Thí nghiệm điện', '5007bcd7-98e5-4b9a-8775-d19af5e0e2a5', true),
  ('f5ab9ce3-c4c6-4fa7-aaa3-cf7d3f3bfd8f', 'P08.00', 'Lãnh đạo Phân xưởng', '3cb63570-7368-40c6-baa9-f60426636d49', true),
  ('dfed4da7-c91f-413d-9f1c-d069d3d73fca', 'P03.02', 'Tổ Vật tư - Tài sản', '77a4b784-0c2b-4fb0-b451-a3d04b3b62ff', true),
  ('25efa61b-de5e-4dac-b542-d22856b6be03', 'P08.04', 'Tổ Kiểm nhiệt', '3cb63570-7368-40c6-baa9-f60426636d49', true),
  ('a092eefd-a0e9-4454-9261-d23286fb5fbe', 'P05.01', 'Tổ Nghiên cứu và Phát triển công nghệ', '8ffa0e3c-14d6-4151-988c-878d7eb87b3b', true),
  ('c673b419-7584-4c9d-8176-d6ce9d90539e', 'P11.01', 'Tổ Kế hoạch - Kỹ thuật', '9bcba2c0-2058-4d92-a63b-bc1b5178a1e4', true),
  ('4df035d9-e943-40bf-a44a-d86a6d3fdfde', 'P01.02', 'Tổ Hành chính', '1da97a49-f5ba-4419-b05c-fa047a958f5b', true),
  ('5d3ec602-eba7-46bd-93b6-da11797bb759', 'P11.03', 'Tổ Sửa chữa tuabin', '9bcba2c0-2058-4d92-a63b-bc1b5178a1e4', true),
  ('4d380d47-0e24-416d-b997-db02e2cb5cf8', 'P13.00', 'Lãnh đạo phòng', 'dc4f18c3-d44b-4bb4-bd56-6d72b8ef836b', true),
  ('965fc639-4099-470d-b078-e136ef5560a3', 'P09.03', 'Tổ Sửa chữa tuabin hơi', 'acde23d7-ddfa-492e-a592-755ba43d85c8', true),
  ('f48888b2-6887-4753-afc7-e1bdef5d914b', 'P13.04', 'Tổ Hàn - Sửa chữa Lò Hơi', 'dc4f18c3-d44b-4bb4-bd56-6d72b8ef836b', true),
  ('b31060d9-226f-457e-b5ac-ebf1f01fa6d3', 'P07.07', 'Tổ Sửa chữa thường xuyên', 'dee68390-db0a-4200-8148-e344464956f0', true),
  ('743fcf19-622a-4481-9838-ec288fdf8b2b', 'P12.00', 'Lãnh đạo Phân xưởng', '7df5b38a-9b3f-4711-9b1c-227921531b39', true),
  ('d45aeb2b-2673-43ec-915e-ed49aa9be4ae', 'P02.04', 'Tổ Kế hoạch', 'da35e95f-8854-43f8-be59-200a4309268e', true),
  ('e1de2f08-7141-4625-a5d6-edc051793349', 'P10.01', 'Tổ Kế hoạch - Kỹ thuật', '5007bcd7-98e5-4b9a-8775-d19af5e0e2a5', true),
  ('8d68f5b7-1953-484f-bc53-f3accd0c9a29', 'P10.04', 'Tổ Kiểm Nhiệt', '5007bcd7-98e5-4b9a-8775-d19af5e0e2a5', true),
  ('01c1e9cf-4331-48f8-832a-fda47f9873a6', 'P07.05', 'Tổ Gia công - Phục hồi', 'dee68390-db0a-4200-8148-e344464956f0', true)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  department_id = excluded.department_id,
  is_active = excluded.is_active;

update private.fake_eps_departments
set is_active = false
where (id, code) in (
  ('EPS-MOCK-D01', 'MOCK-D01'),
  ('EPS-MOCK-D02', 'MOCK-D02')
);

update private.fake_eps_teams
set is_active = false
where (id, code) in (
  ('EPS-MOCK-T01', 'MOCK-T01'),
  ('EPS-MOCK-T02', 'MOCK-T02'),
  ('EPS-MOCK-T03', 'MOCK-T03')
);

do $catalog_check$
begin
  if (select count(*) from private.fake_eps_departments where is_active) <> 14 then
    raise exception 'Expected 14 active EPS departments after catalog replacement';
  end if;
  if (select count(*) from private.fake_eps_teams where is_active) <> 80 then
    raise exception 'Expected 80 active EPS teams after catalog replacement';
  end if;
  if exists (
    select 1 from private.fake_eps_teams team
    join private.fake_eps_departments department on department.id = team.department_id
    where team.is_active and not department.is_active
  ) then
    raise exception 'An active EPS team is attached to an inactive department';
  end if;
end;
$catalog_check$;
