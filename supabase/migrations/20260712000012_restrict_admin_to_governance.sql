-- The platform administrator is a governance-only role, not an academic operator.
delete from public.role_permissions
where role = 'admin'
  and permission <> 'governance:view';

insert into public.role_permissions(role, permission, description)
values ('admin', 'governance:view', 'Administrar cuentas, roles, privilegios y bitacora de auditoria')
on conflict (role, permission) do update set description = excluded.description;

-- Preserve the designated master governance account.
update public.profiles
set role = 'admin', account_status = 'active', updated_at = now()
where lower(email) = 'admin@syncut.test';
