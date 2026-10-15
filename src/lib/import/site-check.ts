import * as cheerio from "cheerio";
import { decodeBody, safeFetch, type Fetcher } from "@/lib/import/fetch-page";
import { robotsAllows } from "@/lib/import/robots";
import { fetchSiteRecipe, mapLimit, resultLinks, searchUrlFor, type RecipeSiteConfig } from "@/lib/import/sites";
import { ImportError, parseImportUrl } from "@/lib/import/url";
import { siteName } from "@/lib/site";

/**
 * La verifica di un sito che una famiglia vuole aggiungere a «Cosa cucino
 * con…». Un sito va bene se:
 *
 *  1. ha una ricerca che si legge senza JavaScript: l'API di WordPress
 *     (`/wp-json/wp/v2/search`) o la ricerca classica `/?s=`;
 *  2. il suo robots.txt non la vieta;
 *  3. cercando una parola comune, almeno due dei primi risultati sono ricette
 *     con i dati schema.org (`recipeIngredient`).
 *
 * Da qui esce la descrizione del sito, con gli stessi campi dei siti già
 * provati: dove si cerca, dove stanno i link e, se le ricette hanno un
 * percorso comune («/ricetta/»), quale. Siti con una ricerca fatta a modo loro
 * (GialloZafferano, il Cucchiaio) non si riconoscono da soli: per quelli c'è
 * il catalogo `KNOWN_SITES`, che l'azione guarda prima di arrivare qui.
 */

export type CheckedSite = Omit<RecipeSiteConfig, "id">;

export type SiteCheck =
  | { ok: true; site: CheckedSite; samples: string[] }
  | { ok: false; reason: string; message: string };

/** Le parole con cui si prova la ricerca: due ingredienti che ogni sito ha. */
const PROBES = ["zucchine", "pollo"];

/** Quante ricette si scaricano per prova, e quante devono avere i dati schema.org. */
const SAMPLE = 4;
const NEEDED = 2;

/** I modi di cercare che si provano, nell'ordine. */
function strategies(origin: string): Omit<CheckedSite, "name" | "host" | "linkPrefix">[] {
  return [
    { kind: "WORDPRESS", searchUrl: `${origin}/wp-json/wp/v2/search?search={q}&per_page=10&type=post`, linkSelector: null },
    // Nella ricerca classica di WordPress i risultati sono <article>; se non
    // ce ne sono, si guarda in <main>.
    { kind: "HTML", searchUrl: `${origin}/?s={q}`, linkSelector: "article a" },
    { kind: "HTML", searchUrl: `${origin}/?s={q}`, linkSelector: "main a" },
  ];
}

/**
 * Il pezzo iniziale comune ai percorsi delle ricette trovate («/ricetta/»),
 * se tutte ce l'hanno e non è tutto il percorso. Serve a scartare, in
 * ricerca, i link a categorie e articoli.
 */
export function commonPrefix(urls: string[]): string | null {
  const firsts = urls.map((url) => new URL(url).pathname.split("/").filter(Boolean));
  if (firsts.length === 0 || firsts.some((parts) => parts.length < 2)) return null;
  const first = firsts[0][0];
  return firsts.every((parts) => parts[0] === first) ? `/${first}/` : null;
}

/** Il nome del sito dalla sua home page: `og:site_name`, o il titolo prima del trattino. */
export function siteTitle(html: string): string | null {
  const $ = cheerio.load(html);
  const fromMeta = $('meta[property="og:site_name"]').attr("content")?.trim();
  if (fromMeta) return fromMeta.slice(0, 60);
  const title = $("title").first().text().split(/\s[-–—|·]\s/)[0]?.trim();
  return title ? title.slice(0, 60) : null;
}

async function readText(url: URL, fetcher: Fetcher, accept: string): Promise<string | null> {
  try {
    return decodeBody(await fetcher(url, { accept, maxBytes: 1024 * 1024 }));
  } catch (error) {
    if (error instanceof ImportError && error.reason === "indirizzo_privato") throw error;
    return null;
  }
}

export async function checkSite(raw: string, options: { fetcher?: Fetcher } = {}): Promise<SiteCheck> {
  const fetcher = options.fetcher ?? safeFetch;

  let start: URL;
  try {
    start = parseImportUrl(raw);
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, reason: error.reason, message: error.message };
    throw error;
  }
  const origin = start.origin;
  const host = start.hostname.toLowerCase();

  try {
    let home: string;
    try {
      home = decodeBody(await fetcher(new URL(`${origin}/`), { accept: "text/html,*/*;q=0.5", maxBytes: 1024 * 1024 }));
    } catch (error) {
      if (error instanceof ImportError && /^http_(401|403|429)$/.test(error.reason)) {
        return { ok: false, reason: "sito_blocca", message: "Il sito non permette ai programmi di leggere le sue pagine." };
      }
      if (error instanceof ImportError && error.reason === "indirizzo_privato") throw error;
      return { ok: false, reason: "irraggiungibile", message: "Il sito non risponde: controlla l'indirizzo." };
    }
    const robots = (await readText(new URL(`${origin}/robots.txt`), fetcher, "text/plain,*/*;q=0.5")) ?? "";
    const name = siteTitle(home) ?? siteName(origin) ?? host;

    let blocked = 0;
    let foundLinks = false;
    for (const strategy of strategies(origin)) {
      const probeUrl = searchUrlFor(strategy, [PROBES[0]]);
      if (!robotsAllows(robots, probeUrl.pathname + probeUrl.search)) {
        blocked += 1;
        continue;
      }
      for (const probe of PROBES) {
        const url = searchUrlFor(strategy, [probe]);
        const body = await readText(url, fetcher, strategy.kind === "WORDPRESS" ? "application/json,*/*;q=0.5" : "text/html,*/*;q=0.5");
        if (body === null) break;
        const links = resultLinks({ ...strategy, host, linkPrefix: null }, body, url).slice(0, SAMPLE);
        if (links.length === 0) continue;
        foundLinks = true;
        const recipes = (await mapLimit(links, 2, (link) => fetchSiteRecipe(link, fetcher))).filter(
          (recipe) => recipe !== null,
        );
        if (recipes.length >= NEEDED) {
          return {
            ok: true,
            site: { ...strategy, name, host, linkPrefix: commonPrefix(recipes.map((recipe) => recipe.url)) },
            samples: recipes.map((recipe) => recipe.title),
          };
        }
      }
    }

    if (blocked === strategies(origin).length) {
      return { ok: false, reason: "robots_vieta", message: "Il sito chiede ai programmi di non usare la sua ricerca (robots.txt)." };
    }
    if (foundLinks) {
      return {
        ok: false,
        reason: "niente_schema",
        message: "Le ricette del sito non hanno i dati strutturati che l'app sa leggere.",
      };
    }
    return {
      ok: false,
      reason: "nessuna_ricerca",
      message: "Non ho trovato una ricerca che l'app sappia leggere. I siti fatti con WordPress di solito vanno bene.",
    };
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, reason: error.reason, message: error.message };
    throw error;
  }
}
