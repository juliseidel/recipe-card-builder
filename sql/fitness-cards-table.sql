-- Supabase migration: fitness_cards table (Fitness-Pack-Pipeline)
--
-- Spiegel-Bild zur bestehenden `recipes`-Tabelle, aber fuer Fitness-Karten
-- (Uebungen, Workouts, Wochenplaene, Mindset, Progress-Tracker, Nutrition-
-- Tips). Discriminator: data->>'type'.
--
-- Hintergrund: Aus den 14 Creator-Workspaces sind ~9 Fitness-Coaches (Marvin,
-- Johannes, Simon, Jessica, Laetitia, Alina, Tim, Johny, Jan). Fuer die
-- brauchen wir Trainings-Packs (Hyrox-Stationen, 12-Wochen-Hypertrophie,
-- Abnehm-Wochenplaene, etc.) — keine Rezeptebuecher.
--
-- Pack-Type-Hybrid-Architektur (Option C):
--   - Recipe-Welt bleibt unangetastet (lib/recipes.ts + recipes-Tabelle).
--   - Fitness-Cards leben hier, parallel.
--   - packs.data->>'packType' = 'recipe' | 'fitness' entscheidet welche
--     Pipeline laeuft (default 'recipe' fuer Backward-Compat).
--   - Brand-System, Auth, Hub, PDF-Job-Queue, Hero-Cache, Storage-Buckets
--     bleiben geteilt.
--
-- Run einmal in der Supabase SQL-Editor bevor der erste Fitness-Pack
-- angelegt wird.

create table if not exists public.fitness_cards (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  pack_slug text not null,
  card_slug text not null,
  -- Diskriminator: exercise | workout | weekplan | mindset | progress | nutrition-tip
  -- Wird als top-level Spalte gespiegelt (statt nur in data jsonb), weil
  -- Filter-Queries danach haeufig sind (z.B. "alle Exercise-Cards eines
  -- Packs sortiert nach number").
  type text not null,
  -- Volles FitnessCard-Objekt (siehe lib/fitness/types.ts).
  data jsonb not null,
  is_custom boolean not null default true,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_slug, pack_slug, card_slug)
);

create index if not exists fitness_cards_brand_slug_idx
  on public.fitness_cards (brand_slug);

create index if not exists fitness_cards_brand_pack_idx
  on public.fitness_cards (brand_slug, pack_slug);

create index if not exists fitness_cards_brand_pack_type_idx
  on public.fitness_cards (brand_slug, pack_slug, type);

-- Live-Reihenfolge der Karten innerhalb eines Packs. Pack-Detail-View
-- sortiert nach data->>'number' asc.
create index if not exists fitness_cards_pack_order_idx
  on public.fitness_cards (brand_slug, pack_slug, ((data->>'number')::int));

-- RLS-Policies konsistent zu brands/packs/creator_reels: Public-Read,
-- offene Inserts/Updates/Deletes weil internes Team-Tool.

alter table public.fitness_cards enable row level security;

drop policy if exists "fitness_cards public read" on public.fitness_cards;
create policy "fitness_cards public read"
  on public.fitness_cards for select using (true);

drop policy if exists "fitness_cards public insert" on public.fitness_cards;
create policy "fitness_cards public insert"
  on public.fitness_cards for insert with check (true);

drop policy if exists "fitness_cards public update" on public.fitness_cards;
create policy "fitness_cards public update"
  on public.fitness_cards for update using (true);

drop policy if exists "fitness_cards public delete" on public.fitness_cards;
create policy "fitness_cards public delete"
  on public.fitness_cards for delete using (true);

-- Auto-update updated_at-Trigger. Wird beim Editor-Save genutzt, damit
-- die UI weiss wann zuletzt veraendert (Cache-Invalidation, Stale-Detection).
create or replace function public.fitness_cards_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fitness_cards_updated_at on public.fitness_cards;
create trigger fitness_cards_updated_at
  before update on public.fitness_cards
  for each row execute function public.fitness_cards_set_updated_at();
