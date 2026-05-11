-- Supabase migration: brands table (custom user-created creator workspaces)
--
-- Mirrors the structure of packs/recipes: a jsonb column holds the full Brand-
-- shaped object (name, handle, bio, tagline, signature, avatar_url, stats,
-- tokens, fonts) so we can evolve fields later without further migrations.
--
-- Curated brands (currently only Biene) stay in lib/brands.ts as code. This
-- table holds all user-onboarded creators on top. lib/brands.ts merges both
-- sources for the workspace hub.
--
-- Run this once in the Supabase SQL editor before using the workspace hub.

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);

create index if not exists brands_slug_idx
  on public.brands (slug);

create index if not exists brands_created_at_idx
  on public.brands (created_at desc);

-- Public read so the workspace hub can list custom brands without
-- authenticated context (matches the packs/recipes RLS pattern). Inserts
-- and deletes are also open to authenticated users — this is an internal
-- team tool, every signed-in user can onboard new creators.
alter table public.brands enable row level security;

drop policy if exists "brands are publicly readable" on public.brands;
create policy "brands are publicly readable"
  on public.brands for select
  using (true);

drop policy if exists "authenticated can insert brands" on public.brands;
create policy "authenticated can insert brands"
  on public.brands for insert
  with check (true);

drop policy if exists "authenticated can update brands" on public.brands;
create policy "authenticated can update brands"
  on public.brands for update
  using (true);

drop policy if exists "authenticated can delete brands" on public.brands;
create policy "authenticated can delete brands"
  on public.brands for delete
  using (true);
