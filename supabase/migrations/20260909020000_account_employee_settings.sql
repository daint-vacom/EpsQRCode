create policy "Users can view their own employee profile"
on public.employees
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_tenant_member(tenant_id)
);

create or replace function public.update_my_employee_profile(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_employee_code text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_status public.employee_status,
  p_joined_at date,
  p_note text,
  p_avatar_url text
)
returns setof public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_manage boolean;
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tài khoản không thuộc tổ chức hiện tại.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.employees employee
    where employee.id = p_employee_id
      and employee.tenant_id = p_tenant_id
      and employee.user_id = auth.uid()
  ) then
    raise exception 'Không tìm thấy hồ sơ nhân viên của tài khoản.' using errcode = '42501';
  end if;

  v_can_manage := public.has_tenant_permission(
    p_tenant_id,
    'organization:employee:update'
  );
  if nullif(btrim(p_first_name), '') is null then
    raise exception 'Tên nhân viên không được để trống.' using errcode = '23514';
  end if;

  return query
  update public.employees employee
  set
    employee_code = case
      when v_can_manage then coalesce(nullif(btrim(p_employee_code), ''), employee.employee_code)
      else employee.employee_code
    end,
    first_name = btrim(p_first_name),
    last_name = btrim(coalesce(p_last_name, '')),
    phone = btrim(coalesce(p_phone, '')),
    status = case
      when v_can_manage then coalesce(p_status, employee.status)
      else employee.status
    end,
    joined_at = case
      when v_can_manage then p_joined_at
      else employee.joined_at
    end,
    note = case
      when v_can_manage then btrim(coalesce(p_note, ''))
      else employee.note
    end,
    avatar_url = p_avatar_url,
    updated_at = timezone('utc', now())
  where employee.id = p_employee_id
    and employee.tenant_id = p_tenant_id
    and employee.user_id = auth.uid()
  returning employee.*;
end;
$$;

revoke all on function public.update_my_employee_profile(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  public.employee_status,
  date,
  text,
  text
) from public, anon;
grant execute on function public.update_my_employee_profile(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  public.employee_status,
  date,
  text,
  text
) to authenticated;

create policy "Users can upload their own employee avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tenant-assets'
  and (storage.foldername(name))[2] = 'employees'
  and exists (
    select 1
    from public.employees employee
    where employee.id = (storage.foldername(name))[3]::uuid
      and employee.tenant_id = (storage.foldername(name))[1]::uuid
      and employee.user_id = auth.uid()
  )
);

create policy "Users can update their own employee avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tenant-assets'
  and (storage.foldername(name))[2] = 'employees'
  and exists (
    select 1
    from public.employees employee
    where employee.id = (storage.foldername(name))[3]::uuid
      and employee.tenant_id = (storage.foldername(name))[1]::uuid
      and employee.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'tenant-assets'
  and (storage.foldername(name))[2] = 'employees'
  and exists (
    select 1
    from public.employees employee
    where employee.id = (storage.foldername(name))[3]::uuid
      and employee.tenant_id = (storage.foldername(name))[1]::uuid
      and employee.user_id = auth.uid()
  )
);

create policy "Members can view employee custom field definitions"
on public.tenant_custom_field_definitions
for select
to authenticated
using (
  entity_type = 'employee'
  and public.is_tenant_member(tenant_id)
);

create policy "Members can view employee custom field options"
on public.tenant_custom_field_options
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_custom_field_definitions definition
    where definition.id = field_id
      and definition.entity_type = 'employee'
      and public.is_tenant_member(definition.tenant_id)
  )
);
