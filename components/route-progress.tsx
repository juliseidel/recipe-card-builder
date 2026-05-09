// Subtile Top-Progress-Bar fuer Server-Roundtrip-Latenz beim Page-
// Wechsel. Statt eines auffaelligen Skeletons (das zu Brand-Farb-
// Spruengen fuehrt) zeigt der User eine 2-px-Linie oben am Viewport,
// die animiert von 0 → 80 % laeuft und dann auf die echte Page wartet.
//
// Wenn die neue Page rendered ist, wird das loading.tsx unmounted und
// die Bar verschwindet automatisch.
//
// Visuelles Konzept: Honey → Pink Gradient (Bienens Signatur-Farben),
// damit es zur Brand passt; cream-Hintergrund unter der Bar matcht
// die meisten App-Pages (canvas) und vermeidet Spruenge.

export function RouteProgress() {
  return (
    <div className="bg-canvas fixed inset-0 z-[100]">
      <div
        className="route-progress-bar absolute left-0 top-0 h-[2px]"
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
      `}</style>
    </div>
  );
}
