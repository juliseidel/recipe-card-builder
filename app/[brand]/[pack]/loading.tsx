// Loading-Skeleton fuer die Pack-Detail-Page (/biene/<pack>). Auch wenn
// die Page SSG ist, kann es kurz dauern bis sie an den Browser
// ausgeliefert ist (Middleware-Auth-Check + Custom-Pack-Lookup). Das
// Skeleton zeigt die spaetere Page-Struktur — Pack-Cover oben, dann
// Recipe-Grid darunter.

export default function PackLoading() {
  return (
    <div className="bg-canvas min-h-screen animate-pulse">
      {/* Pack-Cover-Skeleton (full-width, Brand-mood-tinted Block) */}
      <div className="border-b border-line/40">
        <div className="mx-auto max-w-[1400px] px-6 pt-10 pb-16 lg:px-10">
          <div className="flex flex-col gap-4">
            <div className="h-3 w-24 rounded bg-line-strong/30" />
            <div className="h-12 w-80 rounded-xl bg-line-strong/40" />
            <div className="h-4 w-2/3 max-w-xl rounded bg-line-strong/25" />
            <div className="mt-4 h-10 w-44 rounded-full bg-line-strong/35" />
          </div>
        </div>
      </div>

      {/* Recipe-Grid */}
      <div className="mx-auto max-w-[1400px] px-6 pt-12 pb-20 lg:px-10">
        <div className="mb-7 h-5 w-40 rounded bg-line-strong/30" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] rounded-[var(--radius-card)] bg-line-strong/15"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
