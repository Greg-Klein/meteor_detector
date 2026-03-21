// Nuit = 19h jour J → 8h jour J+1 (à cheval sur 2 jours calendaires)

/**
 * Retourne la clé de nuit "YYYY-MM-DD" pour un timestamp ISO.
 * - 19h–00h jour J → nuit du jour J
 * - 00h–08h jour J+1 → nuit du jour J
 * - 08h–19h → attribué à la nuit précédente (celle qui vient de se terminer)
 */
export function getNightKey(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const h = d.getHours();

  if (h >= 19) {
    return formatDateKey(y, m, day);
  }
  if (h < 8) {
    const prev = new Date(y, m, day);
    prev.setDate(prev.getDate() - 1);
    return formatDateKey(
      prev.getFullYear(),
      prev.getMonth(),
      prev.getDate()
    );
  }
  // 8h–19h : nuit précédente (celle qui s’est terminée à 8h)
  const prev = new Date(y, m, day);
  prev.setDate(prev.getDate() - 1);
  return formatDateKey(
    prev.getFullYear(),
    prev.getMonth(),
    prev.getDate()
  );
}

export function getCurrentNightKey(): string {
  return getNightKey(new Date().toISOString());
}

function formatDateKey(y: number, m: number, day: number): string {
  const yy = y;
  const mm = String(m + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
