-- Unifica definitivamente el rol operativo en tutor.
-- Conserva las cuentas existentes y traslada todos los permisos antes de retirar
-- el valor legado de restricciones, funciones y politicas RLS.

update public.profiles set role = 'tutor' where role = 'coordinator';

do $$
begin
  if to_regclass('public.user_profiles') is not null then
    execute 'update public.user_profiles set role = ''tutor'' where role = ''coordinator''';
  end if;
end $$;

insert into public.role_permissions (role, permission, description)
select 'tutor', permission, description
from public.role_permissions
where role = 'coordinator'
on conflict (role, permission) do update
set description = excluded.description;

delete from public.role_permissions where role = 'coordinator';

do $$
declare
  item record;
  replacement text;
begin
  -- Actualiza funciones propias de la aplicacion que aun comparen el rol legado.
  for item in
    select p.oid, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind <> 'a'
      and pg_get_functiondef(p.oid) like '%coordinator%'
  loop
    replacement := replace(item.definition, 'coordinator', 'tutor');
    execute replacement;
  end loop;

  -- Recrea politicas RLS conservando comando, roles y expresiones.
  for item in
    select * from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%coordinator%' or coalesce(with_check, '') like '%coordinator%')
  loop
    execute format('drop policy %I on %I.%I', item.policyname, item.schemaname, item.tablename);
    replacement := format(
      'create policy %I on %I.%I as %s for %s to %s%s%s',
      item.policyname,
      item.schemaname,
      item.tablename,
      item.permissive,
      item.cmd,
      array_to_string(item.roles, ', '),
      case when item.qual is null then '' else ' using (' || replace(item.qual, 'coordinator', 'tutor') || ')' end,
      case when item.with_check is null then '' else ' with check (' || replace(item.with_check, 'coordinator', 'tutor') || ')' end
    );
    execute replacement;
  end loop;

  -- Sustituye restricciones CHECK para que el valor legado deje de ser valido.
  for item in
    select n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%coordinator%'
  loop
    execute format('alter table %I.%I drop constraint %I', item.nspname, item.relname, item.conname);
    execute format(
      'alter table %I.%I add constraint %I %s',
      item.nspname,
      item.relname,
      item.conname,
      replace(item.definition, ', ''coordinator''', '')
    );
  end loop;
end $$;
