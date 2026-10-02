/**
 * Il nome del sito di un indirizzo, come lo si direbbe a voce:
 * «ricetteperbimby.it» per `https://www.ricetteperbimby.it/ricette/…`. Lo
 * usano la scheda «Fonte», il tag che l'import propone e la fascia sulla foto.
 * Puro, quindi va bene anche nel browser.
 */

/** Gli indirizzi corti dei social, col nome con cui il sito si conosce. */
const SHORT_HOSTS: Record<string, string> = {
  "youtu.be": "youtube.com",
  "fb.watch": "facebook.com",
  "vm.tiktok.com": "tiktok.com",
  "instagr.am": "instagram.com",
};

export function siteName(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/\.$/, "").replace(/^(?:www\d*|m|mobile)\./, "");
  return SHORT_HOSTS[host] ?? (host || null);
}
