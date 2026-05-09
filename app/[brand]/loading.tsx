// Loading-Skeleton fuer den Brand-Workspace (/biene). Brand-Hero +
// Pack-Grid Skelett.

export default function BrandLoading() {
  return (
    <div className="bg-canvas min-h-screen animate-pulse">
      <div className="border-b border-line/40">
        <div className="mx-auto max-w-[1400px] px-6 pt-10 pb-8 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="size-[88px] shrink-0 rounded-2xl bg-line-strong/30" />
              <div className="flex flex-col gap-2">
                <div className="h-10 w-48 rounded-xl bg-line-strong/40" />
                <div className="h-4 w-72 rounded bg-line-strong/25" />
                <div className="mt-1 h-6 w-32 rounded-full bg-line-strong/30" />
              </div>
            </div>
            <div className="h-20 w-full max-w-[420px] rounded-2xl bg-line-strong/15" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 pt-12 pb-20 lg:px-10">
        <div className="mb-6 flex items-end justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-24 rounded bg-line-strong/30" />
            <div className="h-8 w-44 rounded-lg bg-line-strong/40" />
          </div>
          <div className="h-4 w-44 rounded bg-line-strong/25" />
        </div>
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
