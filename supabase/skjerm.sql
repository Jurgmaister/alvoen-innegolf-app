-- Skjerm i lokalet: innstillinger, egne visninger og bilder. Kjøres i SQL Editor.
-- Alle kan lese (skjermen er åpen), bare administratorer kan endre.

create table if not exists public.display_settings (
  id int primary key default 1 check (id = 1),
  seconds int not null default 20 check (seconds between 8 and 120),
  slide_order text[] not null default array['leaderboard','runde','neste','velkommen','terminliste','meldinger'],
  hidden text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);
insert into public.display_settings (id) values (1) on conflict do nothing;

create table if not exists public.display_slides (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null default 'tekst' check (kind in ('tekst', 'bilde')),
  kicker text not null default '' check (char_length(kicker) <= 60),
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 800),
  image_url text,
  qr_url text,
  qr_label text not null default '' check (char_length(qr_label) <= 60),
  theme text not null default 'lys' check (theme in ('lys', 'mork', 'gronn')),
  seconds int check (seconds is null or seconds between 5 and 120),
  active boolean not null default true,
  show_from date,
  show_to date
);

alter table public.display_settings enable row level security;
alter table public.display_slides enable row level security;

drop policy if exists "les skjerminnstillinger" on public.display_settings;
create policy "les skjerminnstillinger" on public.display_settings for select using (true);
drop policy if exists "admin skjerminnstillinger" on public.display_settings;
create policy "admin skjerminnstillinger" on public.display_settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "les skjermvisninger" on public.display_slides;
create policy "les skjermvisninger" on public.display_slides for select using (true);
drop policy if exists "admin skjermvisninger" on public.display_slides;
create policy "admin skjermvisninger" on public.display_slides for all using (public.is_admin()) with check (public.is_admin());

-- Bilder til skjermen (offentlig lesbare, bare admin kan laste opp og slette).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('skjerm', 'skjerm', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "admin leser skjermbilder" on storage.objects;
create policy "admin leser skjermbilder" on storage.objects for select to authenticated
  using (bucket_id = 'skjerm' and public.is_admin());
drop policy if exists "admin laster opp skjermbilder" on storage.objects;
create policy "admin laster opp skjermbilder" on storage.objects for insert to authenticated
  with check (bucket_id = 'skjerm' and public.is_admin());
drop policy if exists "admin endrer skjermbilder" on storage.objects;
create policy "admin endrer skjermbilder" on storage.objects for update to authenticated
  using (bucket_id = 'skjerm' and public.is_admin());
drop policy if exists "admin sletter skjermbilder" on storage.objects;
create policy "admin sletter skjermbilder" on storage.objects for delete to authenticated
  using (bucket_id = 'skjerm' and public.is_admin());

notify pgrst, 'reload schema';
