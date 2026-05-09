// Subtile Top-Progress-Bar fuer Server-Roundtrip-Latenz beim Page-
// Wechsel. Wichtig: TRANSPARENT, keine full-canvas Hintergrund —
// dadurch bleibt der vorherige Page-Hintergrund (z. B. Pack-Mood-Farbe)
// sichtbar waehrend die neue Page rendered, View Transitions API
// macht den Cross-Fade weich.
//
// Honey → Pink Gradient (Bienens Signatur), 2 px Hoehe, animiert
// von 0 % auf 88 % und wartet dann auf den Server-Render. Sobald
// die echte Page kommt, wird das loading.tsx unmounted.

export function RouteProgress() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]">
      <div
        className="route-progress-bar absolute left-0 top-0 h-full"
        style={{
          background:
            "linear-gradient(90deg, #f4c44a, #e8889b, #f4c44a)",
          backgroundSize: "200% 100%",
        }}
      />
      <style>{`
        @keyframes routeProgressGrow {
          0%   { width: 0%; }
          50%  { width: 60%; }
          100% { width: 88%; }
        }
        @keyframes routeProgressShimmer {
          from { background-position: 0% 50%; }
          to   { background-position: 200% 50%; }
        }
        .route-progress-bar {
          width: 0%;
          animation:
            routeProgressGrow 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards,
            routeProgressShimmer 1.5s linear infinite;
        }
        /* View Transitions API soll den Cross-Fade nicht auf den
           Progress-Indicator anwenden — sonst fadet die Bar selbst,
           was wir nicht wollen. */
        :root::view-transition-old(route-progress),
        :root::view-transition-new(route-progress) {
          animation: none;
        }
      `}</style>
    </div>
  );
}
