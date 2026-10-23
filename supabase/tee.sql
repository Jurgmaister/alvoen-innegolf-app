-- Alvøen Innegolf – tee-valg: baneverdi (CR) og slope for alle tee-er per runde
-- Kjøres ETTER resultater.sql. Lim inn hele filen i Supabase: SQL Editor → New query → Run.
-- Kan kjøres på nytt uten å ødelegge data (tee-er legges bare inn for runder som ikke har noen fra før).
--
-- Kilder: banenes offisielle tee-tall via golfpass.com og 1golf.eu (se «source» per tee).
-- 9-hullsrunder (3, 5, 7, 9): par9 + (CR18 − par18)/2, slope som 18 hull – samme metode som regnearket. Estimat, kontroller mot Trackman.

create table if not exists public.round_tees (
  id bigint generated always as identity primary key,
  round_no int not null check (round_no between 1 and 10),
  sort int not null default 0,
  name text not null,
  length_m int,
  par_m int, cr_m numeric(4,1), slope_m int,
  par_w int, cr_w numeric(4,1), slope_w int,
  source text not null default '',
  note text not null default ''
);

alter table public.round_tees enable row level security;
drop policy if exists "les tee" on public.round_tees;
create policy "les tee" on public.round_tees for select using (true);
drop policy if exists "admin tee" on public.round_tees;
create policy "admin tee" on public.round_tees for all using (public.is_admin()) with check (public.is_admin());

-- Hvilken tee spilleren brukte (tom = Trackman-standard for runden).
alter table public.scores add column if not exists tee_id bigint references public.round_tees(id) on delete set null;

-- Tee-er per runde
insert into public.round_tees (round_no, sort, name, length_m, par_m, cr_m, slope_m, par_w, cr_w, slope_w, source, note)
select v.* from (values
  (2, 1, '68', 6808, 72, 77.3, 153, null, null, null, 'golfpass.com (offisielle tee-tall)', ''),
  (2, 2, '64', 6440, 72, 75.5, 147, null, null, null, 'golfpass.com (offisielle tee-tall)', ''),
  (2, 3, '60', 5996, 72, 72.9, 139, 72, 79.5, 153, 'golfpass.com (offisielle tee-tall)', 'Trackman-standard herre.'),
  (2, 4, '56', 5585, 72, 70.9, 136, 72, 77.2, 148, 'golfpass.com (offisielle tee-tall)', ''),
  (2, 5, '52', 5158, 72, 68.6, 131, 72, 74.1, 141, 'golfpass.com (offisielle tee-tall)', 'Trackman-standard dame.'),
  (2, 6, '47', 4700, 72, 66.5, 121, 72, 71.4, 130, 'golfpass.com (offisielle tee-tall)', ''),
  (3, 1, 'White', 5499, 36, 36.2, 125, 36, 38.5, 142, 'golfpass.com – Wanstead GC (WGC London)', '9-hullsverdi beregnet (estimat).'),
  (3, 2, 'Blue (Trackman: Yellow)', 5321, 36, 35.8, 120, 36, 37.9, 139, 'golfpass.com – Wanstead GC (WGC London)', 'Samme lengde som Trackman-standard herre (Yellow 5321 m). 9-hullsverdi beregnet (estimat).'),
  (3, 3, 'Green (≈ Trackman: Red)', 5165, 36, 35.3, 117, 36, 37.2, 136, 'golfpass.com – Wanstead GC (WGC London)', 'Nærmest Trackman-standard dame (Red 5149 m). 9-hullsverdi beregnet (estimat).'),
  (4, 1, 'Vit', null, 72, 73.2, 123, null, null, null, 'Karlstad GK, sløyfe Gul + Röd (1golf.eu)', ''),
  (4, 2, 'Gul', 5956, 72, 71.7, 120, 72, 78.2, 138, 'Karlstad GK, sløyfe Gul + Röd (1golf.eu)', 'Trackman-standard herre.'),
  (4, 3, 'Blå', null, 72, 69.8, 115, 72, 75.8, 133, 'Karlstad GK, sløyfe Gul + Röd (1golf.eu)', ''),
  (4, 4, 'Röd', 5069, 72, 66.5, 108, 72, 71.7, 124, 'Karlstad GK, sløyfe Gul + Röd (1golf.eu)', 'Trackman-standard dame.'),
  (4, 5, 'Orange', null, null, null, null, 72, 67.5, 115, 'Karlstad GK, sløyfe Gul + Röd (1golf.eu)', ''),
  (5, 1, 'Black', 6453, 37, 38.1, 140, 37, 41.5, 150, 'golfpass.com – Riverside CC, Saskatoon', '9-hullsverdi beregnet (estimat).'),
  (5, 2, 'Gold', 6107, 37, 37.2, 136, 37, 40.5, 148, 'golfpass.com – Riverside CC, Saskatoon', '9-hullsverdi beregnet (estimat).'),
  (5, 3, 'Gold/Blue', 5896, 37, 36.8, 134, 37, 39.9, 147, 'golfpass.com – Riverside CC, Saskatoon', 'Trackman-standard herre. Kombinasjonstee: snitt av Gold og Blue (estimat). 9-hullsverdi beregnet (estimat).'),
  (5, 4, 'Blue', 5767, 37, 36.3, 132, 37, 39.3, 146, 'golfpass.com – Riverside CC, Saskatoon', '9-hullsverdi beregnet (estimat).'),
  (5, 5, 'Blue/White', 5485, 37, 35.5, 131, 37, 38.5, 142, 'golfpass.com – Riverside CC, Saskatoon', '9-hullsverdi beregnet (estimat).'),
  (5, 6, 'White', 5115, 37, 34.6, 121, 37, 37.4, 134, 'golfpass.com – Riverside CC, Saskatoon', 'Trackman-standard dame (White 5112 m). 9-hullsverdi beregnet (estimat).'),
  (5, 7, 'White/Red', 4735, 37, 33.4, 116, 37, 36.3, 127, 'golfpass.com – Riverside CC, Saskatoon', '9-hullsverdi beregnet (estimat).'),
  (5, 8, 'Red', 4541, 37, 33.0, 113, 37, 35.6, 123, 'golfpass.com – Riverside CC, Saskatoon', '9-hullsverdi beregnet (estimat).'),
  (6, 1, 'I', 6506, 72, 75.0, 142, null, null, null, 'golfpass.com – Pete Dye Course at Hideaway', ''),
  (6, 2, 'II', 6095, 72, 72.8, 137, null, null, null, 'golfpass.com – Pete Dye Course at Hideaway', 'Trackman-standard herre.'),
  (6, 3, 'III', 5650, 72, 70.5, 129, null, null, null, 'golfpass.com – Pete Dye Course at Hideaway', ''),
  (6, 4, 'IV', 5164, null, null, null, 72, 73.4, 132, 'golfpass.com – Pete Dye Course at Hideaway', ''),
  (6, 5, 'V', 4694, null, null, null, 72, 70.5, 127, 'golfpass.com – Pete Dye Course at Hideaway', 'Trackman-standard dame.'),
  (7, 1, 'Gold', 6866, null, null, null, null, null, null, 'Ikke funnet – fyll inn fra Trackman', ''),
  (7, 2, 'White', 5948, null, null, null, null, null, null, 'Ikke funnet – fyll inn fra Trackman', 'Trackman-standard herre.'),
  (7, 3, 'Green', 5358, null, null, null, null, null, null, 'Ikke funnet – fyll inn fra Trackman', ''),
  (7, 4, 'Red', 4682, null, null, null, null, null, null, 'Ikke funnet – fyll inn fra Trackman', 'Trackman-standard dame.'),
  (8, 1, 'Outrigger', 6436, 72, 74.7, 138, null, null, null, 'golfpass.com – Makena Beach & Golf Resort', ''),
  (8, 2, 'I', 6005, 72, 72.7, 134, null, null, null, 'golfpass.com – Makena Beach & Golf Resort', ''),
  (8, 3, 'II (Trackman: Mauka II)', 5644, 72, 71.0, 132, 72, 76.7, 132, 'golfpass.com – Makena Beach & Golf Resort', 'Trackman-standard herre.'),
  (8, 4, 'III', 5282, 72, 69.2, 121, 72, 74.4, 127, 'golfpass.com – Makena Beach & Golf Resort', ''),
  (8, 5, 'IV (Trackman: Mauka IV)', 4706, 72, 66.2, 115, 72, 70.6, 121, 'golfpass.com – Makena Beach & Golf Resort', 'Trackman-standard dame.'),
  (9, 1, 'Bear', 6475, 36, 37.7, 144, null, null, null, 'USIKKER: golfpass.com etter ombygging (par 72) – Trackman viser par 70', '9-hullsverdi beregnet (estimat).'),
  (9, 2, 'Tee 1', 6137, 36, 36.8, 142, null, null, null, 'USIKKER: golfpass.com etter ombygging (par 72) – Trackman viser par 70', '9-hullsverdi beregnet (estimat).'),
  (9, 3, 'Tee 2 (≈ Trackman: Blue)', 5805, 36, 36.0, 136, 36, 38.5, 143, 'USIKKER: golfpass.com etter ombygging (par 72) – Trackman viser par 70', 'Nærmest Trackman-standard herre (Blue 5827 m). 9-hullsverdi beregnet (estimat).'),
  (9, 4, 'Tee 3', 5475, 36, 35.2, 133, 36, 38.2, 141, 'USIKKER: golfpass.com etter ombygging (par 72) – Trackman viser par 70', '9-hullsverdi beregnet (estimat).'),
  (9, 5, 'Tee 4', 4828, 36, 33.5, 125, 36, 36.2, 132, 'USIKKER: golfpass.com etter ombygging (par 72) – Trackman viser par 70', '9-hullsverdi beregnet (estimat).'),
  (9, 6, 'Tee 5 (≈ Trackman: Red)', 4628, 36, 33.0, 123, 36, 35.7, 130, 'USIKKER: golfpass.com etter ombygging (par 72) – Trackman viser par 70', 'Nærmest Trackman-standard dame (Red 4705 m). 9-hullsverdi beregnet (estimat).'),
  (10, 1, 'Black', 6474, 73, 74.0, 130, null, null, null, 'golfpass.com – Brocket Hall, Palmerston', ''),
  (10, 2, 'Silver (Trackman: White)', 6227, 73, 72.6, 131, null, null, null, 'golfpass.com – Brocket Hall, Palmerston', 'Trackman-standard herre.'),
  (10, 3, 'Gold', 5946, 73, 71.2, 132, null, null, null, 'golfpass.com – Brocket Hall, Palmerston', ''),
  (10, 4, 'Blue (Trackman: Red)', 5360, null, null, null, 73, 73.9, 125, 'golfpass.com – Brocket Hall, Palmerston', 'Trackman-standard dame.')
) as v(round_no, sort, name, length_m, par_m, cr_m, slope_m, par_w, cr_w, slope_w, source, note)
where not exists (select 1 from public.round_tees t where t.round_no = v.round_no);

-- Standardverdier (Trackman-oppsettet) for runder som manglet dem. Endrer bare tomme felt.
update public.round_ratings set par_m = 36, cr_m = 35.8, slope_m = 120, par_w = 36, cr_w = 37.2, slope_w = 136,
  note = 'Estimat fra Wanstead GC (Blue / Green), 9 hull – kontroller'
  where round_no = 3 and cr_m is null and cr_w is null;
update public.round_ratings set par_m = 37, cr_m = 36.8, slope_m = 134, par_w = 37, cr_w = 37.4, slope_w = 134,
  note = 'Estimat fra Riverside CC (Gold/Blue / White), 9 hull – kontroller'
  where round_no = 5 and cr_m is null and cr_w is null;
update public.round_ratings set par_m = 36, cr_m = 36.0, slope_m = 136, par_w = 36, cr_w = 35.7, slope_w = 130,
  note = 'USIKKER: PGA National etter ombygging (par 72), Trackman viser par 70 – kontroller'
  where round_no = 9 and cr_m is null and cr_w is null;
