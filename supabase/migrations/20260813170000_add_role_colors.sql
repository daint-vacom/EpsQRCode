create type public.role_color as enum (
  'blue',
  'violet',
  'red',
  'green',
  'amber',
  'slate'
);

alter table public.roles
  add column color public.role_color not null default 'blue',
  add column sort_order integer not null default 0;

create or replace function public.set_default_role_display()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sort_order = 0 then
    new.sort_order := case new.code
      when 'admin' then 10
      when 'manager' then 20
      when 'employee' then 30
      when 'viewer' then 40
      else 100
    end;
  end if;

  if new.code = 'admin' then
    new.color := 'red'::public.role_color;
  elsif new.code = 'manager' then
    new.color := 'violet'::public.role_color;
  elsif new.code = 'viewer' then
    new.color := 'slate'::public.role_color;
  end if;

  return new;
end;
$$;

create trigger roles_set_default_display
before insert on public.roles
for each row execute function public.set_default_role_display();

update public.roles
set color = case
  when code = 'admin' then 'red'::public.role_color
  when code = 'manager' then 'violet'::public.role_color
  when code = 'employee' then 'blue'::public.role_color
  when code = 'viewer' then 'slate'::public.role_color
  else 'amber'::public.role_color
end,
sort_order = case code
  when 'admin' then 10
  when 'manager' then 20
  when 'employee' then 30
  when 'viewer' then 40
  else 100
end;
