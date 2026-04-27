-- Maid Bridge Supabase Schema
-- Run this in the Supabase SQL Editor to prepare your project.

-- Config (key/value store for idc counters, prefs, etc.)
create table if not exists public.config (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Addresses (canvassing pins)
create table if not exists public.addresses (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Zones (blocks/polygons drawn on map)
create table if not exists public.zones (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Schedules (daily runs)
create table if not exists public.schedules (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Customers (leads/clients)
create table if not exists public.customers (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Logs (activity log)
create table if not exists public.logs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Do-Not-Visit list
create table if not exists public.dnd (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Enable RLS on all tables
alter table public.config enable row level security;
alter table public.addresses enable row level security;
alter table public.zones enable row level security;
alter table public.schedules enable row level security;
alter table public.customers enable row level security;
alter table public.logs enable row level security;
alter table public.dnd enable row level security;

-- Create permissive policies for anon (open access). In production, switch to authenticated users.
create policy "Allow all" on public.config for all using (true) with check (true);
create policy "Allow all" on public.addresses for all using (true) with check (true);
create policy "Allow all" on public.zones for all using (true) with check (true);
create policy "Allow all" on public.schedules for all using (true) with check (true);
create policy "Allow all" on public.customers for all using (true) with check (true);
create policy "Allow all" on public.logs for all using (true) with check (true);
create policy "Allow all" on public.dnd for all using (true) with check (true);

-- Realtime publication (if not already enabled for all tables)
begin;
  -- Confirm publication exists; if not, create it:
  do $$
  begin
    if not exists (
      select 1 from pg_publication where pubname = 'supabase_realtime'
    ) then
      create publication supabase_realtime;
    end if;
  end $$;
commit;

alter publication supabase_realtime add table public.config;
alter publication supabase_realtime add table public.addresses;
alter publication supabase_realtime add table public.zones;
alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.logs;
alter publication supabase_realtime add table public.dnd;
