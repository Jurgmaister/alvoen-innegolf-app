-- Alvøen Innegolf – anonym bruksstatistikk
-- Lim inn hele filen i Supabase: SQL Editor → New query → Run.
-- Kan kjøres på nytt uten å ødelegge data.
--
-- Hver enhet får et tilfeldig, anonymt nummer første gang appen åpnes.
-- Det lagres ingen navn, e-post, IP-adresse eller andre personopplysninger.

create table if not exists public.app_devices (
  id uuid primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  installed boolean not null default false,   -- åpnet fra hjemskjermen
  platform text not null default 'annet',     -- ios / android / pc / annet
  visits int not null default 1
);

alter table public.app_devices enable row level security;
-- Ingen regler: appen kommer bare til tabellen via funksjonene under.

-- Kalles av appen ved oppstart. Et nytt besøk telles når det har gått minst 30 minutter.
create or replace function public.track_device(device_id uuid, is_installed boolean, device_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p text := case when device_platform in ('ios', 'android', 'pc') then device_platform else 'annet' end;
begin
  insert into public.app_devices (id, installed, platform)
  values (device_id, coalesce(is_installed, false), p)
  on conflict (id) do update set
    installed = app_devices.installed or excluded.installed,
    platform = excluded.platform,
    visits = app_devices.visits + case when app_devices.last_seen < now() - interval '30 minutes' then 1 else 0 end,
    last_seen = now();
end;
$$;

revoke all on function public.track_device(uuid, boolean, text) from public;
grant execute on function public.track_device(uuid, boolean, text) to anon, authenticated;

-- Tall til admin-siden. Kun for administratorer.
create or replace function public.app_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'Ikke tilgang';
  end if;
  select json_build_object(
    'total',      (select count(*) from app_devices),
    'installed',  (select count(*) from app_devices where installed),
    'active_7',   (select count(*) from app_devices where last_seen > now() - interval '7 days'),
    'active_30',  (select count(*) from app_devices where last_seen > now() - interval '30 days'),
    'new_7',      (select count(*) from app_devices where first_seen > now() - interval '7 days'),
    'push',       (select count(*) from push_subscriptions),
    'since',      (select min(first_seen) from app_devices),
    'platforms',  (select coalesce(json_object_agg(platform, n), '{}'::json)
                   from (select platform, count(*) n from app_devices group by platform) x),
    'weeks',      (select coalesce(json_agg(json_build_object('week', w, 'n', n) order by w), '[]'::json)
                   from (
                     select gs::date as w,
                            (select count(*) from app_devices d
                              where d.first_seen >= gs and d.first_seen < gs + interval '7 days') as n
                     from generate_series(date_trunc('week', now()) - interval '7 weeks',
                                          date_trunc('week', now()), interval '1 week') gs
                   ) y)
  ) into result;
  return result;
end;
$$;

revoke all on function public.app_stats() from public, anon;
grant execute on function public.app_stats() to authenticated;
