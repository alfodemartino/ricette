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

/**
 * Il titolo di un post: nell'anteprima c'è tutta la didascalia, preceduta dai
 * contatori. Si tolgono i contatori e si tiene la prima riga.
 */
export function facebookTitle(ogTitle: string): string {
  const text = cleanText(ogTitle).replace(STATS_PREFIX, "");
  return text.split("\n").find((line) => line.trim())?.trim() ?? "";
}
