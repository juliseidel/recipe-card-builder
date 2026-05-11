-- Creator-Reels-Library: pro Brand alle gescrapten Reels der letzten 2 Jahre.
--
-- Hintergrund: das Onboarding scrapt heute nur Bio + ~30 latestPosts fuer
-- Style-Templates. Ingo will, dass beim Onboarding die KOMPLETTE Reel-
-- Library (2 Jahre, bis ~500 Reels) eingelesen wird und die KI daraus
-- automatisch 10-20 Pack-Vorschlaege baut. Diese Tabelle speichert die
-- Reels. Klassifikations-Felder (is_recipe, meal_type, ...) werden in
-- Phase 2 von Gemini Flash gefuellt; Pack-Vorschlaege landen in der
-- separaten pack_suggestions-Tabelle (siehe unten).
--
-- Run einmal in der Supabase SQL-Editor, BEVOR der erste Backfill startet.

create table if not exists public.creator_reels (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,

  -- Instagram-Side: ig_id ist der Shortcode (z.B. "CkdF3vQM2bX"), unique
  -- pro Brand fuer Dedup beim periodischen Re-Scrape.
  ig_id text not null,
  post_url text not null,
  type text not null,                       -- 'Video' (Reel), 'Image', 'Sidecar'
  caption text not null default '',
  display_url text,                         -- Reel-Cover / Image-URL
  video_url text,                           -- Direct MP4 (nur bei Reels)
  posted_at timestamptz,                    -- aus Apify timestamp
  like_count int,
  view_count int,                           -- nur bei Reels
  comment_count int,
  hashtags text[] not null default '{}',

  -- KI-Klassifikation (Phase 2 gefuellt). Bleibt null, bis Gemini Flash
  -- den Reel klassifiziert hat. is_recipe=false bedeutet: kein Rezept
  -- (Talking-Head, Werbung, Reise, ...). Pack-Generator filtert auf
  -- is_recipe=true.
  is_recipe boolean,
  recipe_confidence float,                  -- 0..1
  recipe_title text,
  meal_type text,                           -- breakfast/lunch/dinner/snack/dessert/drink
  cuisine text,                             -- italian/asian/german/healthy/baking/...
  main_ingredient text,                     -- chicken/oats/pasta/eggs/...
  dietary text[] not null default '{}',     -- highprotein/lowcarb/vegan/...
  estimated_time_minutes int,
  classified_at timestamptz,

  -- Raw Apify-Response fuer Replay/Debug. Klein genug (typisch 2-5 KB
  -- pro Reel) um 500 Stueck pro Brand zu speichern, gross genug um neue
  -- Features ohne Re-Scrape nachzubauen.
  raw jsonb,
  scraped_at timestamptz not null default now(),

  unique (brand_slug, ig_id)
);

-- Indexe fuer typische Queries:
--   - Liste aller Reels eines Brands (Workspace, Pack-Generator)
--   - Sortiert nach Datum (Timeframe-Filter: letzte 2 Wochen, etc.)
--   - Filter auf "nur Rezepte" + nach Kategorie (Pack-Vorschlaege)
create index if not exists creator_reels_brand_slug_idx
  on public.creator_reels (brand_slug);

create index if not exists creator_reels_brand_posted_idx
  on public.creator_reels (brand_slug, posted_at desc);

create index if not exists creator_reels_brand_recipe_idx
  on public.creator_reels (brand_slug, is_recipe)
  where is_recipe = true;

create index if not exists creator_reels_brand_meal_type_idx
  on public.creator_reels (brand_slug, meal_type)
  where is_recipe = true;

-- ─── creator_scrapes ────────────────────────────────────────────────────────
-- Job-Tracker fuer asynchrone Apify-Runs. Ein Backfill dauert 3-10 Min und
-- passt nicht in eine Vercel-Lambda. Wir starten den Apify-Run mit Webhook-
-- Callback, schreiben hier den apify_run_id rein, und der Webhook matcht
-- darueber die Bearbeitung dem Brand zu.
--
-- Status-Lifecycle:
--   1. 'running' (Apify-Run gestartet, Webhook noch nicht eingegangen)
--   2a. 'classifying' (Dataset eingelesen, Klassifikation laeuft)
--   2b. 'failed' (Apify-Run-Error, Webhook konnte nicht resolved werden, ...)
--   3. 'done' (Klassifikation + Pack-Vorschlaege fertig — Frontend kann sie zeigen)
--
-- Die UI polled diese Tabelle alle ~3-5s ueber /api/brands/[slug]/library-status
-- waehrend der Onboarding-Banner laeuft.

create table if not exists public.creator_scrapes (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  apify_run_id text unique,                 -- null bis Apify-Run gestartet
  status text not null default 'running',   -- running | classifying | done | failed
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  reel_count int not null default 0,        -- Anzahl persistierter Reels
  recipe_count int not null default 0,      -- Anzahl als Rezept klassifizierter Reels
  suggestion_count int not null default 0,  -- Anzahl Pack-Vorschlaege
  error text                                -- bei status='failed' der Fehler
);

create index if not exists creator_scrapes_brand_idx
  on public.creator_scrapes (brand_slug, started_at desc);

create index if not exists creator_scrapes_run_id_idx
  on public.creator_scrapes (apify_run_id);

-- ─── pack_suggestions ───────────────────────────────────────────────────────
-- KI-vorgeschlagene Packs aus der Reel-Library. Gemini Pro generiert nach
-- der Klassifikation 10-20 Pack-Konzepte (Mix aus Zeit-basiert, Kategorie-
-- basiert, Ingredient-basiert, Engagement-basiert). User klickt im
-- Workspace "Annehmen" oder "Verwerfen".
--
-- Bei Annahme: neuer packs-Row + recipes-Rows fuer jeden zugewiesenen Reel
-- werden angelegt (mit sourceUrl auf den Reel → triggert die existierende
-- Reference-First Hero-Pipeline), accepted_pack_id wird befuellt.

create table if not exists public.pack_suggestions (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  title text not null,
  subtitle text not null default '',
  tagline text not null default '',
  description text not null default '',
  category text not null default '',
  -- Welche Reels gehoeren zu diesem Vorschlag? Array von creator_reels.id-
  -- UUIDs. Pro Pack typischerweise 5-15 Reels.
  reel_ids uuid[] not null default '{}',
  -- Begruendung aus Gemini ("Top 12 Reels aus Mai 2026 nach Engagement",
  -- "Suesse Backwerke der letzten 6 Monate", ...). Wird auf der Card im
  -- Workspace als Subline angezeigt.
  reasoning text not null default '',
  -- Sortier-Score (0..1) — Engagement-Pakete oben, Saisonal-Pakete unten.
  -- Gemini setzt das mit; null = unbekannt → ans Ende.
  score float,
  status text not null default 'pending',  -- pending | accepted | dismissed
  accepted_pack_id uuid,                    -- nach Annahme: FK zu packs.id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pack_suggestions_brand_status_idx
  on public.pack_suggestions (brand_slug, status, score desc nulls last, created_at desc);

-- ─── RLS-Policies ───────────────────────────────────────────────────────────
-- Konsistent mit brands/packs/recipes: Public-Read fuer Browser-Zugriff,
-- offene Inserts/Updates/Deletes weil internes Team-Tool.

alter table public.creator_reels enable row level security;
drop policy if exists "creator_reels public read" on public.creator_reels;
create policy "creator_reels public read"
  on public.creator_reels for select using (true);
drop policy if exists "creator_reels public insert" on public.creator_reels;
create policy "creator_reels public insert"
  on public.creator_reels for insert with check (true);
drop policy if exists "creator_reels public update" on public.creator_reels;
create policy "creator_reels public update"
  on public.creator_reels for update using (true);
drop policy if exists "creator_reels public delete" on public.creator_reels;
create policy "creator_reels public delete"
  on public.creator_reels for delete using (true);

alter table public.creator_scrapes enable row level security;
drop policy if exists "creator_scrapes public read" on public.creator_scrapes;
create policy "creator_scrapes public read"
  on public.creator_scrapes for select using (true);
drop policy if exists "creator_scrapes public insert" on public.creator_scrapes;
create policy "creator_scrapes public insert"
  on public.creator_scrapes for insert with check (true);
drop policy if exists "creator_scrapes public update" on public.creator_scrapes;
create policy "creator_scrapes public update"
  on public.creator_scrapes for update using (true);

alter table public.pack_suggestions enable row level security;
drop policy if exists "pack_suggestions public read" on public.pack_suggestions;
create policy "pack_suggestions public read"
  on public.pack_suggestions for select using (true);
drop policy if exists "pack_suggestions public insert" on public.pack_suggestions;
create policy "pack_suggestions public insert"
  on public.pack_suggestions for insert with check (true);
drop policy if exists "pack_suggestions public update" on public.pack_suggestions;
create policy "pack_suggestions public update"
  on public.pack_suggestions for update using (true);
drop policy if exists "pack_suggestions public delete" on public.pack_suggestions;
create policy "pack_suggestions public delete"
  on public.pack_suggestions for delete using (true);
