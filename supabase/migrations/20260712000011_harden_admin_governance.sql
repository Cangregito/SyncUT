-- Governance hardening: account lifecycle, atomic role changes and immutable audit evidence.

alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.profiles(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended', 'deactivated'));

alter table public.audit_logs
  add column if not exists result text not null default 'success',
  add column if not exists reason text,
  add column if not exists severity text not null default 'info',
  add column if not exists request_id uuid;

alter table public.audit_logs drop constraint if exists audit_logs_result_check;
alter table public.audit_logs add constraint audit_logs_result_check check (result in ('success', 'denied', 'failed'));
alter table public.audit_logs drop constraint if exists audit_logs_severity_check;
alter table public.audit_logs add constraint audit_logs_severity_check check (severity in ('info', 'warning', 'critical'));

create index if not exists idx_profiles_account_status on public.profiles(account_status);
create index if not exists idx_audit_logs_result on public.audit_logs(result, created_at desc);

create or replace function public.prevent_audit_log_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Audit records are immutable' using errcode = '42501';
end;
$$;

drop trigger if exists audit_logs_immutable_update on public.audit_logs;
create trigger audit_logs_immutable_update before update or delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

revoke update, delete, truncate on public.audit_logs from authenticated, anon;

create or replace function public.admin_change_user_role(
  target_user_id uuid,
  new_role text,
  change_reason text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous_role text;
  active_admins integer;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can assign roles' using errcode = '42501';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Administrators cannot change their own role' using errcode = '42501';
  end if;
  if new_role not in ('student', 'teacher', 'tutor', 'admin') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if length(btrim(coalesce(change_reason, ''))) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;

  select role into previous_role from public.profiles where id = target_user_id for update;
  if previous_role is null then raise exception 'Profile not found' using errcode = 'P0002'; end if;

  if previous_role = 'admin' and new_role <> 'admin' then
    select count(*) into active_admins from public.profiles where role = 'admin' and account_status = 'active';
    if active_admins <= 1 then raise exception 'The last active administrator cannot be demoted' using errcode = '42501'; end if;
  end if;

  update public.profiles set role = new_role, updated_at = now() where id = target_user_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, old_values, new_values, result, reason, severity, request_id)
  values(auth.uid(), 'role.changed', 'profiles', target_user_id,
    jsonb_build_object('role', previous_role), jsonb_build_object('role', new_role),
    'success', btrim(change_reason), case when new_role = 'admin' then 'critical' else 'warning' end, gen_random_uuid());
end;
$$;

create or replace function public.admin_set_account_status(
  target_user_id uuid,
  new_status text,
  change_reason text
)
returns void language plpgsql security definer set search_path = '' as $$
declare previous_status text; target_role text; active_admins integer;
begin
  if not public.is_admin() then raise exception 'Only administrators can manage accounts' using errcode = '42501'; end if;
  if target_user_id = auth.uid() then raise exception 'Administrators cannot change their own status' using errcode = '42501'; end if;
  if new_status not in ('active', 'suspended', 'deactivated') then raise exception 'Invalid status' using errcode = '22023'; end if;
  if length(btrim(coalesce(change_reason, ''))) < 8 then raise exception 'A reason of at least 8 characters is required' using errcode = '22023'; end if;
  select account_status, role into previous_status, target_role from public.profiles where id = target_user_id for update;
  if previous_status is null then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  if target_role = 'admin' and new_status <> 'active' then
    select count(*) into active_admins from public.profiles where role = 'admin' and account_status = 'active';
    if active_admins <= 1 then raise exception 'The last active administrator cannot be suspended' using errcode = '42501'; end if;
  end if;
  update public.profiles set account_status = new_status, status_reason = btrim(change_reason),
    status_changed_at = now(), status_changed_by = auth.uid(), updated_at = now() where id = target_user_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, old_values, new_values, result, reason, severity, request_id)
  values(auth.uid(), 'account.status_changed', 'profiles', target_user_id,
    jsonb_build_object('status', previous_status), jsonb_build_object('status', new_status),
    'success', btrim(change_reason), 'critical', gen_random_uuid());
end;
$$;

revoke all on function public.admin_change_user_role(uuid,text,text) from public;
revoke all on function public.admin_set_account_status(uuid,text,text) from public;
grant execute on function public.admin_change_user_role(uuid,text,text) to authenticated;
grant execute on function public.admin_set_account_status(uuid,text,text) to authenticated;

-- Suspended/deactivated accounts cannot pass central role checks.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and account_status = 'active');
$$;
create or replace function public.has_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = any(allowed_roles) and account_status = 'active');
$$;
