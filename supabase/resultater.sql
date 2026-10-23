-- Alvøen Innegolf – resultater for vinterserien (spillere, baneverdier, score)
-- Lim inn hele filen i Supabase: SQL Editor → New query → Run.
-- Kan kjøres på nytt uten å ødelegge data.

-- ---------- Spillere ----------
-- Kontaktinfo og merknad er kun for admin. Offentlig vises bare navn og HCP-indeks (via visningen under).
create table if not exists public.players (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  trackman_name text not null default '',
  gender text not null check (gender in ('H', 'D')),
  golfbox_hcp numeric(4,1),            -- Golfbox HCP-indeks ved påmelding
  index_no_golfbox numeric(4,1),       -- brukes når spilleren ikke har Golfbox (maks 36)
  hcp_index numeric(4,1) not null,     -- HCP-indeks brukt (50 %), låst ved påmelding
  contact text not null default '',
  note text not null default ''
);

alter table public.players enable row level security;
drop policy if exists "admin spillere" on public.players;
create policy "admin spillere" on public.players for all using (public.is_admin()) with check (public.is_admin());

-- Offentlig visning uten kontaktinfo (kjører med eierens rettigheter).
create or replace view public.players_public as
  select id, name, gender, hcp_index, created_at from public.players;
grant select on public.players_public to anon, authenticated;

-- ---------- Baneverdier per runde ----------
create table if not exists public.round_ratings (
  round_no int primary key check (round_no between 1 and 10),
  par_m int, cr_m numeric(4,1), slope_m int,
  par_w int, cr_w numeric(4,1), slope_w int,
  note text not null default ''
);

alter table public.round_ratings enable row level security;
drop policy if exists "les baneverdier" on public.round_ratings;
create policy "les baneverdier" on public.round_ratings for select using (true);
drop policy if exists "admin baneverdier" on public.round_ratings;
create policy "admin baneverdier" on public.round_ratings for all using (public.is_admin()) with check (public.is_admin());

-- Verdier fra regnearket (Vinterserie_2026-27_resultater_v4). Runde 3, 5, 7 og 9 må fylles inn i admin.
insert into public.round_ratings (round_no, par_m, cr_m, slope_m, par_w, cr_w, slope_w, note) values
  (1, 36, 35.6, 129, 36, 36.5, 129, 'Estimat (9 hull) – kontroller'),
  (2, 72, 72.9, 139, 72, 74.1, 141, 'Offisiell (bernardusgolf.com)'),
  (3, null, null, null, null, null, null, 'Mangler – hent fra Trackman/scorekort'),
  (4, 72, 71.7, 120, 72, 71.7, 124, 'Offisiell (karlstadgk.se)'),
  (5, null, null, null, null, null, null, 'Mangler – hent fra Trackman/scorekort'),
  (6, 72, 72.8, 137, 72, 70.5, 127, 'Scorekort (golfpass.com)'),
  (7, null, null, null, null, null, null, 'Mangler – Adare Manor, bakre ni'),
  (8, 72, 71.0, 132, 72, 70.6, 121, 'Scorekort (golfpass.com)'),
  (9, null, null, null, null, null, null, 'Mangler – hent fra Trackman/scorekort'),
  (10, 73, 72.6, 131, 73, 73.9, 125, 'Scorekort (golfpass.com)')
on conflict (round_no) do nothing;

-- ---------- Score ----------
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  round_no int not null check (round_no between 1 and 10),
  player_id bigint not null references public.players(id) on delete cascade,
  gross int not null check (gross between 1 and 200),
  struck boolean not null default false,  -- «Strøket»: runden teller ikke
  updated_at timestamptz not null default now(),
  unique (round_no, player_id)
);

alter table public.scores enable row level security;
drop policy if exists "les score" on public.scores;
create policy "les score" on public.scores for select using (true);
drop policy if exists "admin score" on public.scores;
create policy "admin score" on public.scores for all using (public.is_admin()) with check (public.is_admin());
