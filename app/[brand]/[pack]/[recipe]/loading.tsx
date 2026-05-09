import { RouteProgress } from "@/components/route-progress";

// Recipe-Detail kann je nach Layout (Sidebar-Patisserie vs. Cookbook-
// Cover-Minimal) sehr unterschiedlich aussehen. Ein Layout-Skelett
// wuerde fuer die "falsche" Variante zwangslaeufig einen Sprung
// erzeugen. Stattdessen: nur die Top-Progress-Bar, cream-Hintergrund.
// Sobald die echte Page fertig ist, ploppt die Brand-Farbe direkt
// rein — ohne Skelett-Zwischenbild.

export default function RecipeLoading() {
  return <RouteProgress />;
}
