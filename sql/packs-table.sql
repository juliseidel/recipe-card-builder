-- Supabase migration: packs table (custom user-created packs)
--
-- Mirrors the structure of the existing `recipes` table: a jsonb column
-- holds the full Pack-shaped object (title, mood, layout, etc.) so we can
-- evolve fields without further migrations.
--
-- Run this once in the Supabase SQL editor before using the pack-editor.

create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  pack_slug text not null,
  data jsonb not null,
  is_custom boolean not null default true,
  created_at timestamptz not null default now(),
  unique (brand_slug, pack_slug)
);

create index if not exists packs_brand_slug_idx
  on public.packs (brand_slug);

create index if not exists packs_brand_custom_created_at_idx
  on public.packs (brand_slug, is_custom, created_at desc);

-- Public read access (anon role) so the workspace and pack-detail pages
-- can list/read custom packs from the browser. Inserts/updates also need
-- to be reachable from the editor (anon client), but in production you'd
-- normally restrict this to authenticated users.
alter table public.packs enable row level security;

drop policy if exists "packs are publicly readable" on public.packs;
create policy "packs are publicly readable"
  on public.packs for select
  using (true);

drop policy if exists "anyone can insert custom packs" on public.packs;
create policy "anyone can insert custom packs"
  on public.packs for insert
  with check (is_custom = true);

drop policy if exists "anyone can delete custom packs" on public.packs;
create policy "anyone can delete custom packs"
  on public.packs for delete
  using (is_custom = true);

-- UPDATE-Policy fehlte in V1 — Folge war ein silent-fail beim Layout-
-- Lock-In: User waehlt im LayoutPicker z. B. "amber", aber
-- updateCustomPackLayout() wurde von Supabase mit "0 rows affected"
-- geantwortet, ohne dass error gesetzt war. Der Pack blieb auf seinem
-- Default ("editorial") haengen, ab der zweiten Recipe-Karte sah man das
-- als "Layout wird nicht uebernommen". Update-Policy spiegelt insert/
-- delete: jedem ist erlaubt, custom packs zu aendern (Team-Demo-Tool,
-- spaeter ggf. auf authenticated einschraenken).
drop policy if exists "anyone can update custom packs" on public.packs;
create policy "anyone can update custom packs"
  on public.packs for update
  using (is_custom = true)
  with check (is_custom = true);
