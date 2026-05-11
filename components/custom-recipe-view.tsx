"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import { mergeAndRenumber, type Recipe } from "@/lib/recipes";
import {
  getCustomRecipe,
  getCustomRecipesForPack,
  removeCustomRecipe,
} from "@/lib/custom-recipes";
import type { CustomRecipe } from "@/lib/custom-recipes";
import { SiteHeader } from "./site-header";
import { RecipeDetailLayout } from "./recipe-detail-layout";

type Props = {
  brand: Brand;
  pack: Pack;
  recipeSlug: string;
  staticRecipes: Recipe[];
};

export function CustomRecipeView({
  brand,
  pack,
  recipeSlug,
  staticRecipes,
}: Props) {
  const [recipe, setRecipe] = useState<CustomRecipe | null>(null);
  const [allRecipes, setAllRecipes] = useState<(Recipe | CustomRecipe)[]>([]);
  const [loaded, setLoaded] = useState(false);
  // What's still being generated in the background. We track each piece
  // independently so the UI can show "Mikros ✓ · Bild noch …" once the
  // faster Gemini call returns and the slow Flux call is still running.
  const [pending, setPending] = useState<{ micros: boolean; hero: boolean }>({
    micros: false,
    hero: false,
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // microsFailed: TRUE wenn das Mikros-Polling 30 s lang nichts geliefert
  // hat. Triggert die kleine Retry-Notification unten und stoppt die
  // Loading-Animation — sonst sah der User "Mikronaehrstoffe werden
  // analysiert" gefuehlt minutenlang, ohne zu wissen ob er warten oder
  // refreshen soll. Wird zurueckgesetzt sobald entweder ein Retry
  // erfolgreich war oder die Mikros doch noch verspaetet ankamen.
  const [microsFailed, setMicrosFailed] = useState(false);
  // Bumpen wir nach einem Retry — der Polling-useEffect haengt am
  // retryKey und startet so mit frischem attempts=0 neu, ohne dass wir
  // die Polling-Logik duplizieren muessen.
  const [retryKey, setRetryKey] = useState(0);
  const [retryingMicros, setRetryingMicros] = useState(false);
  // Verhindert mehrfache Enrich-Trigger pro Mount. Der Editor sendet
  // bereits einen fire-and-forget Trigger nach Save, aber der wird vom
  // Browser manchmal beim router.push abgebrochen — in dem Fall springt
  // dieser Fallback an und triggert idempotent nochmal.
  const enrichTriggeredRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    // Closure-lokaler Flag, damit der gleiche Polling-Loop weiss ob die
    // Mikros-Schiene schon "abgehakt" ist, ohne dass wir state im
    // tick-Closure stale lesen muessen.
    let microsTimedOut = false;

    const fetchOnce = async () => {
      const [found, customList] = await Promise.all([
        getCustomRecipe(pack.slug, recipeSlug),
        getCustomRecipesForPack(pack.slug),
      ]);
      if (!active) return null;
      const merged = mergeAndRenumber(staticRecipes, customList);
      // Re-pull the current recipe from the merged list so its number/index
      // matches what nutrition table + pack PDF show. Falls back to the raw
      // DB row if the slug somehow doesn't appear in the merge (deleted
      // mid-fetch, etc).
      const fromMerged = found
        ? merged.find((r) => r.slug === found.slug)
        : undefined;
      setRecipe(
        fromMerged
          ? ({ ...(found as CustomRecipe), number: fromMerged.number } as CustomRecipe)
          : (found ?? null)
      );
      setAllRecipes(merged);
      setLoaded(true);
      return found;
    };

    const tick = async () => {
      const found = await fetchOnce();
      if (!active) return;
      const hasMicros = (found?.nutrition?.micros?.length ?? 0) > 0;
      const hasHero = Boolean(found?.hero);
      // Server-Marker: ein vorheriger Versuch ist schon mal gescheitert.
      // Wir respektieren das wie einen Timeout — ohne 30 s zu warten —
      // und zeigen direkt den Retry-Banner. Sonst wuerde jeder Re-Mount
      // nochmal 30 s lang die Loading-Animation drehen, obwohl der
      // Server "fertig versucht" markiert hat.
      const failureMarkerSet = Boolean(
        found?.nutrition?.microsAttemptedAt && !hasMicros
      );

      // Mikros sind doch noch verspaetet angekommen — Failure-Flag zuruecksetzen.
      if (hasMicros && microsTimedOut) {
        microsTimedOut = false;
        setMicrosFailed(false);
      }

      // Wenn der Server-Marker gesetzt ist, sofort als Failure markieren.
      if (failureMarkerSet && !microsTimedOut) {
        microsTimedOut = true;
        setMicrosFailed(true);
      }

      setPending({
        micros: !hasMicros && !microsTimedOut,
        hero: !hasHero,
      });

      // Beide fertig → polling stoppt.
      if (hasMicros && hasHero) return;

      attempts++;

      // Mikros-Timeout: 12 attempts × 2.5 s = 30 s. Genug Puffer fuer
      // Geminis interne Retry-Kette (~16 s bei 5xx/429 + Netz-Latenz),
      // aber wir hangen nicht 2 Minuten an einem Call der eh nie zurueck-
      // kommt. Nach Timeout: Animation aus, Retry-Banner ein.
      if (!hasMicros && !microsTimedOut && attempts >= 12) {
        microsTimedOut = true;
        setMicrosFailed(true);
        setPending((p) => ({ ...p, micros: false }));
      }

      // Hero-Timeout: 50 attempts × 2.5 s = 125 s. Flux ist regulaer
      // langsam (15–25 s, bei Load 60–90 s), daher der grosszuegige Puffer.
      // Mikros-Failure stoppt das Polling NICHT — Hero koennte noch landen.
      if (attempts >= 50) {
        setPending({ micros: false, hero: false });
        return;
      }

      pollTimer = setTimeout(tick, 2500);
    };

    void tick();

    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [pack.slug, recipeSlug, staticRecipes, retryKey]);

  // Fallback-Enrich-Trigger: sobald wir das Recipe geladen haben und
  // erkennen, dass Mikros oder Hero fehlen, triggern wir den Enrich-
  // Endpoint EINMAL pro Mount. Idempotent — der Endpoint prueft selbst,
  // ob noch etwas zu tun ist, und returnt sonst sofort. Schuetzt gegen
  // den Fall, dass der Editor-seitige fire-and-forget Fetch beim
  // router.push abgebrochen wurde und die Lambda nie ankam.
  //
  // ABER: wenn Mikros bereits einmal versucht wurden und gescheitert
  // sind (microsAttemptedAt-Marker steht), und Hero schon da ist,
  // gibt es nichts mehr automatisch zu tun — der Server wuerde den
  // Mikros-Versuch ohnehin ueberspringen. Trigger nur, wenn etwas
  // erfolgsversprechend nachzuholen ist (Hero fehlt, oder Mikros fehlen
  // OHNE vorherigen Failure-Marker).
  useEffect(() => {
    if (!recipe?.id || enrichTriggeredRef.current) return;
    const hasMicros = (recipe.nutrition?.micros?.length ?? 0) > 0;
    const hasHero = Boolean(recipe.hero);
    const microsAlreadyAttempted = Boolean(
      recipe.nutrition?.microsAttemptedAt
    );
    if (hasMicros && hasHero) return;
    // Mikros wurden schon mal versucht (und sind leer geblieben) UND
    // Hero ist auch schon da → kein Auto-Trigger. Wartet auf manuellen
    // Retry-Klick im Banner.
    if (!hasMicros && microsAlreadyAttempted && hasHero) return;
    enrichTriggeredRef.current = true;
    void fetch("/api/recipes/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: recipe.id }),
    }).catch(() => {
      /* swallow — wenn das auch failed, sehen wir das im Polling-Timeout */
    });
  }, [
    recipe?.id,
    recipe?.nutrition?.micros?.length,
    recipe?.hero,
    recipe?.nutrition?.microsAttemptedAt,
  ]);

  if (!loaded) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{ background: pack.mood.background }}
      >
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <div
            className="font-mono text-[12px] uppercase tracking-[0.18em]"
            style={{ color: pack.mood.inkSoft }}
          >
            Karte wird geladen…
          </div>
        </main>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{ background: pack.mood.background }}
      >
        <SiteHeader />
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <span
            className="font-display text-[36px] italic"
            style={{ color: pack.mood.ink }}
          >
            Karte nicht gefunden
          </span>
          <p className="text-[14px]" style={{ color: pack.mood.inkSoft }}>
            Diese Karte existiert nicht (mehr).
          </p>
          <Link
            href={`/${brand.slug}/${pack.slug}`}
            className="mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold"
            style={{
              background: pack.mood.ink,
              color: pack.mood.background,
            }}
          >
            Zurück zu {pack.title}
          </Link>
        </main>
      </div>
    );
  }

  const idx = allRecipes.findIndex((r) => r.slug === recipe.slug);
  const previous =
    idx > 0
      ? {
          href: `/${brand.slug}/${pack.slug}/${allRecipes[idx - 1].slug}`,
          title: allRecipes[idx - 1].title,
        }
      : null;
  const next =
    idx < allRecipes.length - 1
      ? {
          href: `/${brand.slug}/${pack.slug}/${allRecipes[idx + 1].slug}`,
          title: allRecipes[idx + 1].title,
        }
      : null;

  const handleDeleteClick = async () => {
    if (!recipe) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
      confirmTimeout.current = setTimeout(
        () => setConfirmingDelete(false),
        3000
      );
      return;
    }
    setDeleting(true);
    await removeCustomRecipe(recipe.id);
    // Drop workspace + pack-detail caches so the recipe-count badge and the
    // recipe grid both show the lower number when the user lands back on
    // the pack page (and on a back-navigation to /[brand]).
    await fetch("/api/packs/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandSlug: brand.slug,
        packSlug: pack.slug,
      }),
    }).catch(() => {
      /* non-blocking */
    });
    router.push(`/${brand.slug}/${pack.slug}`);
  };

  const deleteAction = (
    <button
      type="button"
      onClick={handleDeleteClick}
      onMouseLeave={() => {
        if (!deleting) setConfirmingDelete(false);
      }}
      disabled={deleting}
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors"
      style={
        confirmingDelete
          ? {
              borderColor: "transparent",
              background: "#dc2626",
              color: "white",
            }
          : {
              borderColor: pack.mood.ink + "20",
              color: pack.mood.inkSoft,
              background: "rgba(255,255,255,0.6)",
            }
      }
    >
      {deleting ? (
        <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3 4h8m-7 0v7a1 1 0 001 1h4a1 1 0 001-1V4M5.5 4V2.5h3V4M6 6.5v3M8 6.5v3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {deleting
        ? "Lösche…"
        : confirmingDelete
        ? "Wirklich löschen?"
        : "Löschen"}
    </button>
  );

  const handleRetryMicros = async () => {
    if (!recipe?.id || retryingMicros) return;
    setRetryingMicros(true);
    setMicrosFailed(false);
    setPending((p) => ({ ...p, micros: true }));
    try {
      // force=true sagt dem Server "ignoriere den microsAttemptedAt-
      // Marker und versuche es nochmal". Ohne dieses Flag wuerde der
      // Endpoint den vorherigen Failure-Marker respektieren und den
      // Mikros-Call ueberspringen.
      await fetch("/api/recipes/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: recipe.id, force: true }),
      });
    } catch {
      // Network-Fehler hier ist OK — der Polling-Loop merkt nach 30 s
      // wieder dass nichts ankam und setzt microsFailed erneut. Der User
      // kann dann nochmal druecken.
    }
    // Polling-useEffect rerunnen, damit attempts wieder bei 0 startet
    // und die Animation frisch laeuft. Cleanup→Re-Run macht React via
    // Dependencies-Aenderung.
    setRetryKey((k) => k + 1);
    setRetryingMicros(false);
  };

  return (
    <>
      <RecipeDetailLayout
        brand={brand}
        pack={pack}
        recipe={recipe}
        recipeId={recipe?.id}
        totalRecipes={allRecipes.length}
        previous={previous}
        next={next}
        isCustom
        deleteAction={deleteAction}
        enriching={pending.hero || pending.micros ? pending : undefined}
      />
      <EnrichmentToast pending={pending} pack={pack} />
      {microsFailed ? (
        <MicrosFailedBanner
          pack={pack}
          onRetry={handleRetryMicros}
          retrying={retryingMicros}
        />
      ) : null}
    </>
  );
}

// ════════════════════════════════════════════════
// MicrosFailedBanner — diskrete Notification rechts unten, wenn die
// Mikros-Pipeline 30 s lang nichts geliefert hat. Statt den User mit
// einer endlosen Loading-Animation hängen zu lassen, geben wir ihm hier
// klare Information ("konnten nicht analysiert werden") und einen
// Single-Klick-Retry. Der Rest der Karte bleibt funktional — Mikros
// sind zwar visuell der Wow-Faktor von Bienes Karten, aber die Karte
// ist auch ohne sie eine vollwertige Recipe-Card.
//
// Nicht modal, nicht sticky-toast: bewusst klein und unten, damit es
// die Lese-Erfahrung der Karte nicht stört.
// ════════════════════════════════════════════════
function MicrosFailedBanner({
  pack,
  onRetry,
  retrying,
}: {
  pack: Pack;
  onRetry: () => void | Promise<void>;
  retrying: boolean;
}) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex w-[min(94vw,360px)] flex-col gap-2 rounded-2xl border bg-white/95 px-4 py-3.5 shadow-[0_18px_48px_-16px_rgba(26,18,11,0.32)] backdrop-blur-xl toast-slide-down"
      style={{ borderColor: pack.mood.ink + "1f" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 inline-flex size-4 items-center justify-center"
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle
              cx="7"
              cy="7"
              r="6"
              stroke={pack.mood.accent}
              strokeWidth="1.4"
              fill="none"
            />
            <path
              d="M7 4v3.5"
              stroke={pack.mood.accent}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="7" cy="10" r="0.85" fill={pack.mood.accent} />
          </svg>
        </span>
        <div className="flex-1">
          <p
            className="text-[12.5px] font-semibold leading-tight"
            style={{ color: pack.mood.ink }}
          >
            Mikronährstoffe konnten nicht analysiert werden
          </p>
          <p
            className="mt-1 text-[11.5px] leading-snug"
            style={{ color: pack.mood.inkSoft }}
          >
            Die Karte ist trotzdem komplett. Du kannst es nochmal versuchen.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void onRetry()}
        disabled={retrying}
        className="inline-flex items-center justify-center gap-1.5 self-end rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-opacity disabled:opacity-60"
        style={{
          background: pack.mood.ink,
          color: pack.mood.background,
        }}
      >
        {retrying ? (
          <>
            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Analysiere…
          </>
        ) : (
          "Erneut versuchen"
        )}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════
// EnrichmentToast — top-center, prominent, stage-aware.
//
// Three stages: (1) both pending, (2) only hero pending (micros came back
// fast from Gemini), (3) "complete" celebration card that auto-dismisses
// after 2.5 s so the user gets explicit closure when the slow Flux render
// lands.
//
// `previousState` lets us hold the toast in a "✓ done" state for a beat
// before fading out, instead of vanishing the moment polling stops.
// ════════════════════════════════════════════════
function EnrichmentToast({
  pending,
  pack,
}: {
  pending: { micros: boolean; hero: boolean };
  pack: Pack;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    const isPending = pending.micros || pending.hero;
    if (wasPendingRef.current && !isPending) {
      // Just finished — celebrate for 2.5 s
      setShowCompleted(true);
      const t = setTimeout(() => setShowCompleted(false), 2500);
      return () => clearTimeout(t);
    }
    wasPendingRef.current = isPending;
  }, [pending.micros, pending.hero]);

  const visible = pending.micros || pending.hero || showCompleted;
  if (!visible) return null;

  // Pick stage label, mode and progress duration. Progress fills at a slow
  // rate that roughly matches the actual remaining wait, never reaching
  // 100 % because that would imply we're done before we are.
  let mode: "both" | "hero" | "micros" | "done";
  if (showCompleted) mode = "done";
  else if (pending.micros && pending.hero) mode = "both";
  else if (pending.hero) mode = "hero";
  else mode = "micros";

  return (
    <div
      className={`fixed left-1/2 top-6 z-50 flex w-[min(94vw,520px)] flex-col gap-2.5 rounded-2xl border bg-white/95 px-5 py-4 shadow-[0_18px_48px_-16px_rgba(26,18,11,0.32)] backdrop-blur-xl ${
        showCompleted ? "toast-fade-out" : "toast-slide-down"
      }`}
      style={{
        borderColor: pack.mood.ink + "1f",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        {mode === "done" ? (
          <CheckBadge color={pack.mood.accent} />
        ) : (
          <span
            className="relative flex size-5 items-center justify-center"
            aria-hidden
          >
            <span
              className="absolute inset-0 rounded-full pending-dot"
              style={{ background: pack.mood.accent + "30" }}
            />
            <span
              className="relative size-2 rounded-full"
              style={{ background: pack.mood.accent }}
            />
          </span>
        )}
        <div className="flex flex-1 flex-col gap-0.5">
          <span
            className="text-[12.5px] font-semibold leading-tight"
            style={{ color: pack.mood.ink }}
          >
            {mode === "done"
              ? "Karte komplett — Mikros & Bild sind drin"
              : mode === "both"
              ? "Bienes Küche zaubert deine Karte"
              : mode === "hero"
              ? "KI rendert dein Hero-Bild"
              : "Mikronährstoffe werden analysiert"}
          </span>
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.14em]"
            style={{ color: pack.mood.inkSoft }}
          >
            {mode === "done"
              ? "Fertig"
              : mode === "both"
              ? "Story + Mikros + Bild · noch ~30–60 Sek"
              : mode === "hero"
              ? "Noch ~15–25 Sek · Story & Mikros sind bereits drin"
              : "Noch ~5 Sek · Bild ist bereits drin"}
          </span>
        </div>
      </div>

      {/* Stage chips — ✓ for done, pulsing dot for active */}
      <div className="flex items-center gap-2 pt-0.5">
        <StageChip
          label="Mikros"
          state={pending.micros ? "active" : "done"}
          accent={pack.mood.accent}
          inkSoft={pack.mood.inkSoft}
          ink={pack.mood.ink}
        />
        <StageChip
          label="Hero-Bild"
          state={pending.hero ? "active" : "done"}
          accent={pack.mood.accent}
          inkSoft={pack.mood.inkSoft}
          ink={pack.mood.ink}
        />
      </div>

      {/* Progress creep — visual hint that work is happening, never reaches
          100 % so the user doesn't feel cheated when reality lags */}
      {mode !== "done" ? (
        <div
          className="relative h-0.5 w-full overflow-hidden rounded-full"
          style={{ background: pack.mood.ink + "10" }}
          aria-hidden
        >
          <div
            key={mode}
            className="absolute inset-y-0 left-0 right-0 origin-left rounded-full progress-creep"
            style={
              {
                background: pack.mood.accent,
                "--progress-from": mode === "both" ? "0" : "0.5",
                "--progress-duration": mode === "both" ? "45s" : "20s",
              } as React.CSSProperties
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function StageChip({
  label,
  state,
  accent,
  inkSoft,
  ink,
}: {
  label: string;
  state: "active" | "done";
  accent: string;
  inkSoft: string;
  ink: string;
}) {
  const isDone = state === "done";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-all"
      style={{
        borderColor: isDone ? accent + "55" : ink + "1a",
        background: isDone ? accent + "12" : "transparent",
        color: isDone ? accent : inkSoft,
      }}
    >
      {isDone ? (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2 6.5L4.5 9L10 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span
          className="size-1.5 rounded-full pending-dot"
          style={{ background: accent }}
        />
      )}
      {label}
    </span>
  );
}

function CheckBadge({ color }: { color: string }) {
  return (
    <span
      className="flex size-5 items-center justify-center rounded-full"
      style={{ background: color + "1a", color }}
      aria-hidden
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M2 6.5L4.5 9L10 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
