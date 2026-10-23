-- Spillere melder inn Golfbox-HCP fra turneringsfanen. Kjøres i SQL Editor (etter resultater.sql).
-- Alle kan sende inn. Bare admin kan lese og behandle innmeldingene.

create table if not exists public.hcp_submissions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  trackman_name text not null default '' check (char_length(trackman_name) <= 80),
  gender text not null check (gender in ('H', 'D')),
  golfbox_hcp numeric(4,1) not null check (golfbox_hcp between -10 and 54),
  contact text not null default '' check (char_length(contact) <= 120),
  status text not null default 'ny' check (status in ('ny', 'brukt', 'avvist')),
  player_id bigint references public.players(id) on delete set null,
  handled_by text,
  handled_at timestamptz
);
alter table public.hcp_submissions enable row level security;

drop policy if exists "meld inn hcp" on public.hcp_submissions;
create policy "meld inn hcp" on public.hcp_submissions for insert to anon, authenticated
  with check (status = 'ny' and player_id is null and handled_by is null and handled_at is null);

drop policy if exists "admin hcp innmeldinger" on public.hcp_submissions;
create policy "admin hcp innmeldinger" on public.hcp_submissions
  for all using (public.is_admin()) with check (public.is_admin());

grant insert on public.hcp_submissions to anon, authenticated;

notify pgrst, 'reload schema';
