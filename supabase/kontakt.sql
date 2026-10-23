-- Kontaktskjema: kunder sender meldinger til eierne. Kjøres i SQL Editor (etter schema.sql).
-- Meldingene lagres via push-funksjonen (handling «contact»), som også varsler admin.
-- Bare innloggede administratorer kan lese, endre og slette meldingene.

create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  contact text not null default '' check (char_length(contact) <= 120),
  topic text not null default 'annet',
  message text not null check (char_length(message) between 1 and 2000),
  device_id text,
  handled boolean not null default false,
  handled_at timestamptz,
  handled_by text
);
create index if not exists contact_messages_created on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;

drop policy if exists "admin kontakt" on public.contact_messages;
create policy "admin kontakt" on public.contact_messages
  for all using (public.is_admin()) with check (public.is_admin());

-- Enheter der admin vil ha varsel om nye kontaktmeldinger. Kun push-funksjonen kommer til.
create table if not exists public.admin_push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_push_subscriptions enable row level security;
