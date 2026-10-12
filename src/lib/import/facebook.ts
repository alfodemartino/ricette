import { cleanText } from "@/lib/import/html";

/**
 * Facebook risponde 400 a un browser senza login, e una pagina vuota a un
 * telefono. Al suo lettore delle anteprime, quello che prepara i riquadri dei
 * link condivisi, segue invece i link `share/…` fino al post e risponde con
 * l'anteprima completa: titolo, immagine e didascalia.
 */
export const FACEBOOK_HEADERS = {
  "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
};

const FACEBOOK_HOSTS = ["facebook.com", "fb.watch", "fb.me"];

export function isFacebookHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return FACEBOOK_HOSTS.some((facebook) => host === facebook || host.endsWith(`.${facebook}`));
}

/** «Visualizzazioni: 180.473 · Reazioni: 22.635 | », o lo stesso in inglese. */
const STATS_PREFIX = /^[^|\n]*\d[^|\n]*·[^|\n]*\|\s*/;

/** « | Nome della pagina» in fondo, dopo la didascalia. */
const AUTHOR_SUFFIX = /\s+\|\s+[^|\n]+$/;

/**
 * La didascalia di un post. Nell'anteprima `og:description` è tagliata dopo
 * poche righe, mentre `og:title` la contiene intera, tra i contatori e il
 * nome della pagina: «Visualizzazioni: … · Reazioni: … | <didascalia> | <pagina>».
 * Se il titolo non ha questa forma non si tocca niente e si torna `null`.
 */
export function facebookCaption(ogTitle: string): string | null {
  const text = cleanText(ogTitle);
  if (!STATS_PREFIX.test(text)) return null;
  return text.replace(STATS_PREFIX, "").replace(AUTHOR_SUFFIX, "").trim() || null;
}

/** Il titolo della ricetta: la prima riga della didascalia. */
export function facebookTitle(caption: string): string {
  return caption.split("\n").find((line) => line.trim())?.trim() ?? "";
}
