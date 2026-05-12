-- Platform-Extension fuer Multi-Platform-Support (Instagram + TikTok).
--
-- Hintergrund: bisher war jeder Creator-Workspace Instagram-only — Profil-
-- Import, Reel-Backfill und Recipe-Import liefen alle ausschliesslich
-- gegen den Instagram-Apify-Scraper. Mai 2026 erweitern wir auf TikTok
-- (clockworks~tiktok-scraper). Diese Migration ergaenzt die zwei Reel-
-- Library-Tabellen um eine `platform`-Spalte, damit Webhook + Klassifikator
-- + Cron wissen, welcher Scraper bei einem Refresh angesprochen werden muss.
--
-- brands.data ist JSONB — `platform` und `audienceAnalysis` werden dort
-- direkt im Object gespeichert, keine extra Spalten noetig.
--
-- Run einmal in der Supabase SQL-Editor — alle bestehenden Rows bekommen
-- den Default 'instagram', sodass kein bestehender Code bricht.

-- ─── creator_scrapes ────────────────────────────────────────────────────────
-- Welcher Apify-Actor wurde fuer den Run aufgerufen. Beim Refresh-Cron
-- + beim Webhook-Receiver wird das gelesen, um den richtigen Dataset-Parser
-- (fetchApifyDataset vs fetchTikTokDataset) anzusprechen.
alter table public.creator_scrapes
  add column if not exists platform text not null default 'instagram';

-- ─── creator_reels ──────────────────────────────────────────────────────────
-- Welche Plattform der Reel stammt von. Wichtig fuer:
--   - Recipe-Pack-Akzeptanz (Reference-First Hero-Pipeline muss wissen, ob
--     scrapeInstagramPost oder scrapeTikTokPost den Source-Post nochmal laden)
--   - Filter im Auto-Pack-Tab ("nur Instagram-Reels" / "nur TikToks")
--   - Pack-Card-Quellen-Attribution
alter table public.creator_reels
  add column if not exists platform text not null default 'instagram';

-- Index fuer Plattform-Filter im Workspace ("nur TikToks der letzten 6 Monate").
create index if not exists creator_reels_brand_platform_idx
  on public.creator_reels (brand_slug, platform);

-- Note zur brand.data JSONB:
-- Neue Felder, die ab dieser Migration unterstuetzt werden (kein DDL noetig):
--   brands.data.platform           text ('instagram' | 'tiktok')
--   brands.data.audienceAnalysis   AudienceAnalysis (siehe lib/ai/analyze-audience.ts)
