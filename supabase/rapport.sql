-- Ukerapport: lagrer konkurrentenes prislister (offentlige data fra Albaplay) for å oppdage endringer.
-- Kjøres i SQL Editor. Bare push-funksjonen (service role) leser og skriver.

create table if not exists public.competitor_prices (
  slug text primary key,
  name text not null,
  price_list jsonb,
  summary text,
  previous_summary text,
  checked_at timestamptz,
  changed_at timestamptz,
  last_error text
);
alter table public.competitor_prices enable row level security;

notify pgrst, 'reload schema';
