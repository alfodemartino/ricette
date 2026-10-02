/**
 * Tempi delle ricette, sempre in minuti interi.
 */

/**
 * Una durata ISO 8601 come la scrivono i dati strutturati dei siti
 * (`PT1H20M`, `P0DT0H45M`, `PT90M`) in minuti. `null` se manca o non si
 * capisce; zero vale come «non indicato», perché diversi siti lo scrivono così.
 */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value
    .trim()
    .toUpperCase()
    .match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match.map((part) => (part ? Number(part) : 0));
  const total = Math.round(days * 1440 + hours * 60 + minutes + seconds / 60);
  return total > 0 ? total : null;
}

/** «1 h 20 min», «45 min», «2 h». */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

/** Tempo complessivo; `null` se non è indicato nessuno dei due. */
export function totalMinutes(prep: number | null, cook: number | null): number | null {
  if (prep === null && cook === null) return null;
  return (prep ?? 0) + (cook ?? 0);
}
