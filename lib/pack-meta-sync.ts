"use client";

// Auto-Sync-Trigger: nach jeder Recipe-Mutation (Add/Delete/Edit/Hide) wird
// fire-and-forget /api/packs/regenerate-meta angepingt. Der Server checkt
// dort gegen pack.editedFields[] und regeneriert nur die Felder, die der
// User nicht selber gesetzt hat.
//
// Fire-and-forget bedeutet: kein await, kein Error-Block fuer den User. Das
// Re-Generate ist eine Ergaenzung — wenn es failed, behaelt der Pack die
// alten Texte. User merkt nichts.
//
// Wird AUSSCHLIESSLICH bei Custom-Packs (is_custom=true) ausgeloest. Curated
// Bienen-Packs haben statische Texte, die wollen wir nicht ueberschreiben —
// der Server filtert das anhand des fehlenden DB-Eintrags auch nochmal.

export function triggerPackMetaSync(
  brandSlug: string,
  packSlug: string
): void {
  // void: explizit fire-and-forget, kein await
  void fetch("/api/packs/regenerate-meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandSlug, packSlug }),
    // keepalive=true: das fetch ueberlebt die aktuelle Page-Navigation,
    // sodass auch ein "speichern + zum Pack-Grid navigieren" den Sync nicht
    // canceled.
    keepalive: true,
  }).catch((err) => {
    console.warn(
      "[pack-meta-sync] regenerate-meta failed (non-fatal):",
      err instanceof Error ? err.message : err
    );
  });
}
