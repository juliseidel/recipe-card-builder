// Loading-Skeleton fuer die Recipe-Detail-Page. Faengt die Wahrnehmung
// einer Server-Roundtrip-Latenz ab — der User sieht sofort eine
// strukturierte Page (Hero-Block + zwei Spalten Body), nicht den
// vorherigen Tab. Pulsiert subtle.
//
// Cream-Background ohne Brand-Tokens, weil die zur Render-Zeit nicht
// bekannt sind (loading laeuft VOR dem param-resolve). Der Wechsel zur
// gefuellten Page ist visuell weich, weil die finale Page denselben
// Cream-Hintergrund hat.

export default function RecipeLoading() {
  return (
    <div className="bg-canvas min-h-screen animate-pulse">
      <div className="mx-auto max-w-[1400px] px-6 pt-12 pb-16 lg:px-10">
        {/* Hero-Bereich */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="h-3 w-28 rounded bg-line-strong/30" />
            <div className="h-10 w-72 rounded-xl bg-line-strong/40" />
            <div className="h-4 w-56 rounded bg-line-strong/25" />
          </div>
          <div className="size-[180px] rounded-2xl bg-line-strong/30 lg:size-[220px]" />
        </div>

        {/* Body 2-Spalten */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[280px_1fr]">
          {/* Linke Spalte — Macros + Mikros */}
          <div className="flex flex-col gap-3">
            <div className="h-3 w-24 rounded bg-line-strong/30" />
            <div className="h-24 rounded-2xl bg-line-strong/20" />
            <div className="h-3 w-20 rounded bg-line-strong/25" />
            <div className="flex flex-col gap-2">
              <div className="h-7 rounded-lg bg-line-strong/15" />
              <div className="h-7 rounded-lg bg-line-strong/15" />
              <div className="h-7 rounded-lg bg-line-strong/15" />
              <div className="h-7 rounded-lg bg-line-strong/15" />
              <div className="h-7 rounded-lg bg-line-strong/15" />
            </div>
          </div>

          {/* Rechte Spalte — Zutaten + Steps */}
          <div className="flex flex-col gap-5">
            <div className="h-3 w-28 rounded bg-line-strong/30" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 rounded-lg bg-line-strong/15"
                  style={{ width: `${75 + ((i * 7) % 20)}%` }}
                />
              ))}
            </div>
            <div className="mt-6 h-3 w-32 rounded bg-line-strong/30" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="size-8 shrink-0 rounded-full bg-line-strong/25" />
                  <div className="flex flex-1 flex-col gap-1.5 pt-1">
                    <div className="h-3 rounded bg-line-strong/20" />
                    <div className="h-3 w-4/5 rounded bg-line-strong/15" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
