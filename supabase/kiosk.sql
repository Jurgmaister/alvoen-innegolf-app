-- Alvøen Innegolf – kiosk/varebeholdning
-- Lim inn hele filen i Supabase: SQL Editor → New query → Run.
-- Kan kjøres på nytt uten å ødelegge data.

create table if not exists public.kiosk_products (
  id bigint generated always as identity primary key,
  name text not null,
  stock int not null default 0 check (stock >= 0),
  min_level int not null default 0 check (min_level >= 0),
  target_level int not null default 0 check (target_level >= 0),
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.kiosk_products enable row level security;

drop policy if exists "admin kiosk" on public.kiosk_products;
create policy "admin kiosk" on public.kiosk_products for all
  using (public.is_admin()) with check (public.is_admin());

-- Endrer lagertallet med +/- uten at to personer overskriver hverandre.
create or replace function public.adjust_stock(product_id bigint, delta int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_stock int;
begin
  if not public.is_admin() then
    raise exception 'Ikke tilgang';
  end if;
  update public.kiosk_products
     set stock = greatest(0, stock + delta),
         updated_at = now(),
         updated_by = auth.jwt() ->> 'email'
   where id = product_id
  returning stock into new_stock;
  return new_stock;
end;
$$;

revoke all on function public.adjust_stock(bigint, int) from public, anon;
grant execute on function public.adjust_stock(bigint, int) to authenticated;
