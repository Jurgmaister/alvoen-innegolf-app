-- Alvøen Innegolf – handicapkontroll (GolfBox-sjekk og kontroll av handicap i Trackman)
-- Kjøres ETTER resultater.sql. Lim inn hele filen i Supabase: SQL Editor → New query → Run.
-- Kan kjøres på nytt uten å ødelegge data.

-- GolfBox-sjekk på spilleren (kun synlig for admin; ikke med i den offentlige visningen).
alter table public.players add column if not exists golfbox_verified boolean not null default false;
alter table public.players add column if not exists golfbox_checked_on date;

-- Kontrollogg: handicapet som står på scorekortet i Trackman mot det riktige.
create table if not exists public.hcp_checks (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  checked_on date not null default current_date,
  player_id bigint not null references public.players(id) on delete cascade,
  round_no int check (round_no between 1 and 10),
  course text not null default '',
  mode text not null check (mode in ('spill', 'indeks')),  -- spillehandicap eller handicapindeks
  entered numeric(4,1) not null,   -- det som sto i Trackman
  correct numeric(4,1) not null,   -- det som skulle stått
  hcp_index numeric(4,1),
  slope int, cr numeric(4,1), par int,
  ok boolean not null
);

alter table public.hcp_checks enable row level security;
drop policy if exists "admin handicapkontroll" on public.hcp_checks;
create policy "admin handicapkontroll" on public.hcp_checks for all using (public.is_admin()) with check (public.is_admin());
