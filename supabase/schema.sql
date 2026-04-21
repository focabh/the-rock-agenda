-- The Rock Band — Agenda Schema
-- Run this in your Supabase SQL Editor

-- Shows table
create table if not exists shows (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time not null default '20:00',
  duration_minutes integer not null default 120,
  client_name text not null,
  venue text,
  city text,
  fee numeric(10,2) not null default 0,
  commission_pct numeric(5,2) not null default 10,
  is_paid boolean not null default false,
  status text not null default 'pending' check (status in ('confirmed', 'pending', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

-- Musician availability table
create table if not exists musician_availability (
  id uuid primary key default gen_random_uuid(),
  musician_id text not null check (musician_id in ('foca', 'marco', 'felipe', 'ester', 'rafa')),
  date date not null,
  status text not null default 'unavailable' check (status in ('available', 'unavailable', 'other_band')),
  reason text,
  sub_name text,
  created_at timestamptz not null default now(),
  unique (musician_id, date)
);

-- Indexes for common queries
create index if not exists shows_date_idx on shows (date);
create index if not exists availability_date_idx on musician_availability (date);
create index if not exists availability_musician_idx on musician_availability (musician_id);

-- Row Level Security (RLS) — disabled for now, enable when adding auth
-- alter table shows enable row level security;
-- alter table musician_availability enable row level security;
