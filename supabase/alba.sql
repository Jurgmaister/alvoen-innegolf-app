-- Kunder fra Alba (bookingsystemet). Kjøres i SQL Editor.
-- Push-funksjonen henter bookinger, kunder og betalinger fra Alba Partner API (lesetilgang) og lagrer dem her.
-- Bare innloggede administratorer kan lese. Fødselsdato hentes ikke.

create table if not exists public.alba_contacts (
  id text primary key,
  first_name text,
  last_name text,
  email text,
  phone text,
  language text,
  email_on boolean,
  created_at timestamptz,
  modified_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.alba_bookings (
  id text primary key,
  contact_id text,
  status text,
  title text,
  start_at timestamptz,
  end_at timestamptz,
  player_count int,
  resources jsonb,
  created_at timestamptz,
  modified_at timestamptz,
  deleted_at timestamptz
);
create index if not exists alba_bookings_contact on public.alba_bookings (contact_id);
create index if not exists alba_bookings_start on public.alba_bookings (start_at);

create table if not exists public.alba_orders (
  id text primary key,
  contact_id text,
  reference text,
  category text,
  currency text,
  total_amount_minor bigint,
  refunded_amount_minor bigint,
  payment_status text,
  line_items jsonb,
  ordered_at timestamptz,
  modified_at timestamptz,
  deleted_at timestamptz
);
create index if not exists alba_orders_contact on public.alba_orders (contact_id);

-- Hvor langt synkroniseringen har kommet per type.
create table if not exists public.alba_sync (
  entity text primary key,
  last_modified timestamptz,
  cursor text,
  walk_since timestamptz,
  walk_max timestamptz,
  last_run timestamptz,
  last_error text,
  rows_total int not null default 0
);

alter table public.alba_contacts enable row level security;
alter table public.alba_bookings enable row level security;
alter table public.alba_orders enable row level security;
alter table public.alba_sync enable row level security;

drop policy if exists "admin les alba kunder" on public.alba_contacts;
create policy "admin les alba kunder" on public.alba_contacts for select using (public.is_admin());
drop policy if exists "admin les alba bookinger" on public.alba_bookings;
create policy "admin les alba bookinger" on public.alba_bookings for select using (public.is_admin());
drop policy if exists "admin les alba betalinger" on public.alba_orders;
create policy "admin les alba betalinger" on public.alba_orders for select using (public.is_admin());
drop policy if exists "admin les alba sync" on public.alba_sync;
create policy "admin les alba sync" on public.alba_sync for select using (public.is_admin());

-- Samlet oversikt til Kunder-fanen (regnes ut i databasen; tider i norsk tid).
create or replace function public.alba_overview()
returns json
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'Bare administratorer';
  end if;

  with b as (
    select * from public.alba_bookings
    where deleted_at is null and status = 'confirmed'
  ),
  o as (
    select contact_id,
           sum(coalesce(total_amount_minor, 0) - coalesce(refunded_amount_minor, 0)) as net_minor
    from public.alba_orders
    where deleted_at is null
    group by contact_id
  ),
  per as (
    select c.id,
           trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) as name,
           c.email, c.phone, c.email_on, c.created_at,
           count(b.id) as bookings,
           coalesce(sum(extract(epoch from (b.end_at - b.start_at)) / 3600.0), 0) as hours,
           min(b.start_at) as first_at,
           max(b.start_at) filter (where b.start_at <= now()) as last_at,
           min(b.start_at) filter (where b.start_at > now()) as next_at,
           count(b.id) filter (where b.start_at > now() - interval '90 days' and b.start_at <= now()) as last90,
           coalesce(o.net_minor, 0) as spent_minor
    from public.alba_contacts c
    left join b on b.contact_id = c.id
    left join o on o.contact_id = c.id
    where c.deleted_at is null
    group by c.id, o.net_minor
  ),
  weeks as (
    select to_char(g.wk_start, 'IYYY-IW') as wk, g.wk_start,
           (select count(*) from per
             where per.first_at is not null
               and date_trunc('week', per.first_at at time zone 'Europe/Oslo') = g.wk_start) as n
    from generate_series(date_trunc('week', (now() at time zone 'Europe/Oslo')) - interval '11 weeks',
                         date_trunc('week', (now() at time zone 'Europe/Oslo')), interval '1 week') as g(wk_start)
  ),
  heat as (
    select extract(isodow from start_at at time zone 'Europe/Oslo')::int as dow,
           extract(hour from start_at at time zone 'Europe/Oslo')::int as hr,
           count(*) as n
    from b
    where start_at > now() - interval '90 days' and start_at <= now()
    group by 1, 2
  ),
  rev as (
    select to_char(date_trunc('month', ordered_at at time zone 'Europe/Oslo'), 'YYYY-MM') as mnd,
           sum(coalesce(total_amount_minor, 0) - coalesce(refunded_amount_minor, 0)) as net_minor,
           count(*) as n
    from public.alba_orders
    where deleted_at is null and ordered_at > now() - interval '12 months'
    group by 1
  )
  select json_build_object(
    'customers', coalesce((select json_agg(row_to_json(per) order by per.last_at desc nulls last) from per), '[]'::json),
    'new_per_week', coalesce((select json_agg(json_build_object('week', wk, 'start', wk_start, 'n', n) order by wk_start) from weeks), '[]'::json),
    'heatmap', coalesce((select json_agg(json_build_object('dow', dow, 'hr', hr, 'n', n)) from heat), '[]'::json),
    'revenue', coalesce((select json_agg(json_build_object('month', mnd, 'net_minor', net_minor, 'n', n) order by mnd) from rev), '[]'::json),
    'bookings_total', (select count(*) from b),
    'currency', (select currency from public.alba_orders where currency is not null limit 1),
    'sync', coalesce((select json_agg(row_to_json(s)) from public.alba_sync s), '[]'::json)
  ) into result;
  return result;
end;
$$;

grant execute on function public.alba_overview() to authenticated;

notify pgrst, 'reload schema';
