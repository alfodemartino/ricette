import * as cheerio from "cheerio";
import {
  amountHint,
  countableWanted,
  isStaple,
  limitingAmount,
  matchRecipe,
  rankMatches,
  type WantedIngredient,
} from "@/lib/cook-with";
import { totalMinutes } from "@/lib/duration";
import { decodeBody, safeFetch, type Fetcher } from "@/lib/import/fetch-page";
import { recipeFromHtml } from "@/lib/import/index";
import { ImportError } from "@/lib/import/url";
import { parseIngredientLine } from "@/lib/ingredients";

/**
 * La ricerca di «Cosa cucino con…» sui siti di ricette.
 *
 * Nessun sito cerca davvero per ingrediente: cercano parole nel testo. Quindi
 * si chiedono al sito i risultati per le parole scritte, se ne scaricano i
 * primi e si tengono solo le ricette i cui dati schema.org
 * (`recipeIngredient`) contengono davvero quello che si ha.
 *
 * Un sito è fatto di dati, non di codice: dove si cerca (`searchUrl`, con
 * `{q}` al posto delle parole) e dove stanno i link dei risultati. Così gli
 * stessi campi descrivono i siti dell'app, qui sotto, e quelli che una
 * famiglia aggiunge dopo la verifica di `site-check.ts`.
 *
 * Tutto si scarica con `safeFetch`: le parole cercate le ha scritte l'utente,
 * e un sito aggiunto da una famiglia è un indirizzo scritto da un utente.
 */

export type RecipeSiteConfig = {
  /** Il nome per i siti dell'app («giallozafferano»), l'id del database per gli altri. */
  id: string;
  name: string;
  host: string;
  /** `WORDPRESS`: un JSON `[{ url }]`. `HTML`: i link dentro `linkSelector`. */
  kind: "WORDPRESS" | "HTML";
  /**
   * L'indirizzo della ricerca. `{q}` diventa le parole separate da spazi (in
   * un parametro), `{q+}` e `{q-}` le parole unite da «+» o da «-» (dentro il
   * percorso, come vogliono GialloZafferano e Ricette per Bimby).
   */
  searchUrl: string;
  linkSelector: string | null;
  /** Il pezzo iniziale del percorso delle ricette («/ricetta/»), se ce n'è uno. */
  linkPrefix: string | null;
  builtIn: boolean;
};

function wordpress(id: string, name: string, host: string, linkPrefix: string | null): RecipeSiteConfig {
  return {
    id,
    name,
    host,
    kind: "WORDPRESS",
    searchUrl: `https://${host}/wp-json/wp/v2/search?search={q}&per_page=10&type=post`,
    linkSelector: null,
    linkPrefix,
    builtIn: true,
  };
}

function html(id: string, name: string, host: string, searchUrl: string, linkSelector: string, linkPrefix: string | null): RecipeSiteConfig {
  return { id, name, host, kind: "HTML", searchUrl, linkSelector, linkPrefix, builtIn: true };
}

/**
 * I siti dell'app, verificati a mano a ottobre 2026: tutti hanno i dati
 * schema.org e una ricerca che il loro robots.txt non vieta. Le scelte e i
 * siti scartati sono in PROPOSTE.md.
 */
export const BUILT_IN_SITES: RecipeSiteConfig[] = [
  html(
    "giallozafferano",
    "GialloZafferano",
    "www.giallozafferano.it",
    // Il robots.txt vieta la ricerca solo con i parametri dopo «?».
    "https://www.giallozafferano.it/ricerca-ricette/{q+}/",
    "article.gz-card .gz-title a",
    null,
  ),
  wordpress("ricettedellanonna", "Ricette della Nonna", "www.ricettedellanonna.net", null),
  wordpress("benedetta", "Fatto in casa da Benedetta", "www.fattoincasadabenedetta.it", "/ricetta/"),
  wordpress("misya", "Misya", "www.misya.info", "/ricetta/"),
  html("cucchiaio", "Il Cucchiaio d'Argento", "www.cucchiaio.it", "https://www.cucchiaio.it/ricerca.html?param={q}", "#item-container article h3 a", "/ricetta/"),
  html("casapappagallo", "Casa Pappagallo", "www.casapappagallo.it", "https://www.casapappagallo.it/ricette?s={q}", ".research-results-list article h2 a", "/ricette/"),
  // La colonna «più viste» ha anche lei degli <article>: si leggono solo quelli del contenuto.
  html("ricetteperbimby", "Ricette per Bimby", "www.ricetteperbimby.it", "https://www.ricetteperbimby.it/ricerca/{q-}", "section.content article.post a", "/ricette/"),
];

// ---------------------------------------------------------------------------
// Indirizzi e link
// ---------------------------------------------------------------------------

/** Il dominio senza `www.`/`m.`: le ricette di GialloZafferano stanno su `ricette.`, la ricerca su `www.`. */
function baseHost(host: string): string {
  return host.toLowerCase().replace(/^(?:www\d*|m)\./, "");
}

/** Se due nomi sono lo stesso sito, sottodomini compresi. */
export function sameSite(a: string, b: string): boolean {
  const [x, y] = [baseHost(a), baseHost(b)];
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}

/** L'indirizzo della ricerca per queste parole. */
export function searchUrlFor(site: Pick<RecipeSiteConfig, "searchUrl">, words: string[]): URL {
  const clean = words.map((word) => word.trim()).filter(Boolean);
  return new URL(
    site.searchUrl
      .replace("{q+}", clean.map(encodeURIComponent).join("+"))
      .replace("{q-}", clean.map(encodeURIComponent).join("-"))
      .replace("{q}", encodeURIComponent(clean.join(" "))),
  );
}

/** I percorsi che non sono mai ricette: archivi, autori, pagine dei risultati, file. */
const NOT_A_RECIPE = /^\/(?:tag|tags|category|categoria|categorie|author|autore|autori|page|feed|wp-content|wp-json|search|ricerca|cerca)(?:\/|$)/i;

/**
 * I link alle ricette nella risposta della ricerca: sullo stesso sito, col
 * percorso giusto, senza ancore né parametri, senza doppioni e nell'ordine
 * del sito.
 */
export function resultLinks(site: Pick<RecipeSiteConfig, "kind" | "host" | "linkSelector" | "linkPrefix">, body: string, pageUrl: URL): string[] {
  const raw: string[] = [];
  if (site.kind === "WORDPRESS") {
    try {
      const data: unknown = JSON.parse(body);
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") raw.push((item as { url: string }).url);
        }
      }
    } catch {
      return [];
    }
  } else {
    const $ = cheerio.load(body);
    $(site.linkSelector ?? "a").each((_, element) => {
      const href = $(element).attr("href");
      if (href) raw.push(href);
    });
  }

  const links: string[] = [];
  for (const href of raw) {
    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (!sameSite(url.hostname, site.host)) continue;
    url.hash = "";
    url.search = "";
    if (url.pathname === "/" || NOT_A_RECIPE.test(url.pathname)) continue;
    if (site.linkPrefix && !url.pathname.startsWith(site.linkPrefix)) continue;
    if (url.href === pageUrl.href || links.includes(url.href)) continue;
    links.push(url.href);
  }
  return links;
}

// ---------------------------------------------------------------------------
// Scaricamento, con una piccola cache
// ---------------------------------------------------------------------------

const HTML_ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5";
const JSON_ACCEPT = "application/json;q=1,*/*;q=0.5";
const MAX_BYTES = 5 * 1024 * 1024;
const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;

/**
 * Risultati e ricette restano in memoria per qualche ora: tornando indietro o
 * togliendo un ingrediente non si riscarica niente, e i siti non vedono
 * arrivare la stessa domanda due volte. Si perde a ogni riavvio, e va bene.
 */
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { expires: now + CACHE_MS, value });
  // Un errore non resta in cache: la prossima volta si riprova.
  value.catch(() => cache.delete(key));
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return value;
}

/** Una pagina che non si legge si ricorda per poco: può essere stato un momento. */
const FAILURE_MS = 10 * 60 * 1000;

function remember<T>(key: string, value: T, ms: number) {
  cache.set(key, { expires: Date.now() + ms, value: Promise.resolve(value) });
}

/** Per i test: si riparte senza niente in memoria. */
export function clearSiteCache() {
  cache.clear();
}

/** Una ricetta trovata su un sito, ridotta a quello che serve per il confronto. */
export type SiteRecipe = {
  url: string;
  title: string;
  imageUrl: string | null;
  servings: number | null;
  minutes: number | null;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
};

/** Una pagina di ricetta con i dati schema.org, o `null` se non li ha o non si scarica. */
export async function fetchSiteRecipe(url: string, fetcher: Fetcher = safeFetch): Promise<SiteRecipe | null> {
  const key = `ricetta ${url}`;
  return cached(key, async () => {
    const start = new URL(url);
    const response = await fetcher(start, { accept: HTML_ACCEPT, maxBytes: MAX_BYTES });
    const imported = recipeFromHtml(decodeBody(response), response.url, start);
    if (imported.method !== "dati-strutturati" || imported.ingredients.length === 0 || !imported.title) return null;
    return {
      url,
      title: imported.title,
      imageUrl: imported.imageUrl,
      servings: imported.servings,
      minutes: totalMinutes(imported.prepMinutes, imported.cookMinutes),
      ingredients: imported.ingredients
        .map((line) => parseIngredientLine(line.text))
        .filter((line) => line.name)
        .map(({ name, quantity, unit }) => ({ name, quantity, unit })),
    };
  }).catch(() => {
    remember(key, null, FAILURE_MS);
    return null;
  });
}

/** I link dei risultati per queste parole. */
export async function fetchResultLinks(site: RecipeSiteConfig, words: string[], fetcher: Fetcher = safeFetch): Promise<string[]> {
  const url = searchUrlFor(site, words);
  return cached(`ricerca ${site.kind} ${site.linkSelector} ${site.linkPrefix} ${url.href}`, async () => {
    const response = await fetcher(url, { accept: site.kind === "WORDPRESS" ? JSON_ACCEPT : HTML_ACCEPT, maxBytes: MAX_BYTES });
    return resultLinks(site, decodeBody(response), response.url);
  });
}

/** `items` trasformati al più `limit` alla volta, nell'ordine di partenza. */
export async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// La ricerca
// ---------------------------------------------------------------------------

/** Una ricetta del sito che usa quello che si ha. */
export type WebMatch = {
  url: string;
  title: string;
  imageUrl: string | null;
  minutes: number | null;
  /** Gli ingredienti scritti che la ricetta non usa: al più uno. */
  missing: string[];
  alsoNeeded: string[];
  /** Quanto si fa con quello che si ha («Basta per circa 3 persone»), se si sa. */
  amount: string | null;
};

export type SiteSearchResult = { all: WebMatch[]; almost: WebMatch[]; checked: number };

/**
 * Le parole da dare alla ricerca del sito: gli ingredienti scritti, senza
 * sale, olio e simili, che troverebbero mezzo sito.
 */
export function searchWords(wanted: WantedIngredient[]): string[] {
  return wanted.filter((item) => !isStaple(item.name)).map((item) => item.name.toLowerCase());
}

export type SearchSiteOptions = { fetcher?: Fetcher; limit?: number };

/**
 * Cerca sul sito le ricette con quello che si ha. Con molte parole i siti
 * spesso non trovano niente: allora si riprova con le prime due, e il
 * confronto sugli ingredienti fa il resto. Le ricette che non si scaricano o
 * non hanno i dati schema.org si saltano; se non risponde la ricerca, è un
 * `ImportError`.
 */
export async function searchSite(site: RecipeSiteConfig, wanted: WantedIngredient[], options: SearchSiteOptions = {}): Promise<SiteSearchResult> {
  const fetcher = options.fetcher ?? safeFetch;
  const limit = options.limit ?? 6;
  const words = searchWords(wanted);
  if (countableWanted(wanted) === 0) return { all: [], almost: [], checked: 0 };

  let links: string[];
  try {
    links = await fetchResultLinks(site, words, fetcher);
    if (links.length === 0 && words.length > 2) links = await fetchResultLinks(site, words.slice(0, 2), fetcher);
  } catch (error) {
    const reason = error instanceof ImportError ? error.reason : "errore";
    throw new ImportError(`${site.name} non ha risposto.`, `ricerca_${reason}`);
  }

  const recipes = await mapLimit(links.slice(0, limit), 3, (url) => fetchSiteRecipe(url, fetcher));
  const items = recipes
    .filter((recipe): recipe is SiteRecipe => recipe !== null)
    .map((recipe) => ({ recipe, title: recipe.title, match: matchRecipe(wanted, recipe.ingredients) }));
  const ranked = rankMatches(items, wanted);

  const toWebMatch = ({ recipe, match }: (typeof items)[number]): WebMatch => ({
    url: recipe.url,
    title: recipe.title,
    imageUrl: recipe.imageUrl,
    minutes: recipe.minutes,
    missing: match.missing.map((item) => item.name),
    alsoNeeded: match.alsoNeeded,
    amount: amountHint(recipe.servings, limitingAmount(match)),
  });
  return { all: ranked.all.map(toWebMatch), almost: ranked.almost.map(toWebMatch), checked: items.length };
}
