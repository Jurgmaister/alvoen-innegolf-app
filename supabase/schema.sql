-- Alvøen Innegolf – databaseoppsett
-- Lim inn hele filen i Supabase: SQL Editor → New query → Run.
-- Kan kjøres på nytt uten å ødelegge data.

-- ---------- Administratorer ----------
create table if not exists public.admins (
  email text primary key
);

-- Administratorer legges inn i en egen spørring etter denne filen (se OPPSETT.md, steg 1),
-- slik at e-postadresser ikke ligger i den offentlige koden.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Meldinger ----------
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  category text not null check (category in ('turnering', 'drift', 'tilbud')),
  title text not null,
  body text not null default ''
);

-- ---------- Push-abonnementer (skrives kun av push-funksjonen) ----------
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  topics text[] not null default array['turnering', 'drift', 'tilbud'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Turnering ----------
create table if not exists public.tournament (
  id int primary key default 1 check (id = 1),
  title text not null default 'Vinterserien 2026/27',
  summary text not null default '10 runder, 7 tellende. Topp 4 går til sluttspill i matchplay søndag 11.04.2027.',
  next_round_title text not null default 'Runde 1',
  next_round_course text not null default '',
  next_round_dates text not null default '',
  standings_after text not null default '',
  signup_open boolean not null default true,
  rules text not null default 'Krever egen Trackman-konto. Handicapindeks = 50 % av Golfbox-HCP med én desimal, låst ved påmelding. Resultat: brutto slag + playing handicap beregnet per bane (slope/CR).'
);
insert into public.tournament (id) values (1) on conflict do nothing;

create table if not exists public.standings (
  id bigint generated always as identity primary key,
  position int not null,
  name text not null,
  points text not null default ''
);

create table if not exists public.signups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null default '',
  golfbox_hcp numeric(4,1) not null,
  locked_index numeric(4,1) not null
);

-- ---------- Infosider ----------
create table if not exists public.info_pages (
  slug text primary key,
  title text not null,
  body text not null default '',
  sort int not null default 0
);
insert into public.info_pages (slug, title, body, sort) values
  ('simulator', 'Slik bruker du simulatoren', 'Skriv inn veiledningen her fra adminsiden.', 1),
  ('adgang', 'Adgang, kiosk og regler', 'Skriv inn adgang, kioskinfo og regler her fra adminsiden.', 2)
on conflict do nothing;

-- ---------- Tilgangsregler (Row Level Security) ----------
alter table public.admins enable row level security;
alter table public.messages enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.tournament enable row level security;
alter table public.standings enable row level security;
alter table public.signups enable row level security;
alter table public.info_pages enable row level security;

drop policy if exists "admins leser seg selv" on public.admins;
create policy "admins leser seg selv" on public.admins for select using (public.is_admin());

-- Alle kan lese meldinger, turnering, tabell og infosider. Bare admin kan endre.
drop policy if exists "les meldinger" on public.messages;
create policy "les meldinger" on public.messages for select using (true);
drop policy if exists "admin meldinger" on public.messages;
create policy "admin meldinger" on public.messages for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "les turnering" on public.tournament;
create policy "les turnering" on public.tournament for select using (true);
drop policy if exists "admin turnering" on public.tournament;
create policy "admin turnering" on public.tournament for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "les tabell" on public.standings;
create policy "les tabell" on public.standings for select using (true);
drop policy if exists "admin tabell" on public.standings;
create policy "admin tabell" on public.standings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "les infosider" on public.info_pages;
create policy "les infosider" on public.info_pages for select using (true);
drop policy if exists "admin infosider" on public.info_pages;
create policy "admin infosider" on public.info_pages for all using (public.is_admin()) with check (public.is_admin());

-- Påmelding: alle kan melde seg på (mens påmeldingen er åpen), bare admin kan lese og slette.
drop policy if exists "meld deg på" on public.signups;
create policy "meld deg på" on public.signups for insert
  with check (exists (select 1 from public.tournament where id = 1 and signup_open));
drop policy if exists "admin påmeldte" on public.signups;
create policy "admin påmeldte" on public.signups for select using (public.is_admin());
drop policy if exists "admin slett påmeldte" on public.signups;
create policy "admin slett påmeldte" on public.signups for delete using (public.is_admin());

-- push_subscriptions har ingen regler for appen: kun push-funksjonen (service role) kommer til.
