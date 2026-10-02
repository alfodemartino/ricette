import * as cheerio from "cheerio";
import { decodeBody, safeFetch, type Fetcher } from "@/lib/import/fetch-page";
import { linksInText, pageText } from "@/lib/import/html";
import { extractJsonLdRecipe } from "@/lib/import/jsonld";
import { extractPreview } from "@/lib/import/preview";
import { parseRecipeText } from "@/lib/import/text-recipe";
import { isComplete, type ImportedRecipe, type RecipeEnhancer } from "@/lib/import/types";
import { ImportError, isVideoHost, parseImportUrl, youtubeVideoId } from "@/lib/import/url";
import { extractYouTubeDetails, YOUTUBE_CONSENT_COOKIE, youtubeThumbnail } from "@/lib/import/youtube";

/**
 * Import di una ricetta da un link. La catena, nell'ordine:
 *
 *  1. YouTube: titolo e descrizione del video, e nella descrizione la ricetta
 *     scritta a testo (`parseRecipeText`).
 *  2. Ogni altra pagina: i dati strutturati schema.org (`jsonld.ts`), che
 *     quasi tutti i siti di ricette pubblicano.
 *  3. Senza dati strutturati: anteprima Open Graph più l'euristica sul testo.
 *  4. Se dopo questi passi mancano ingredienti o procedimento e il testo
 *     contiene link ad altre pagine (il classico «ricetta completa sul
 *     sito»), si prova a importare da lì.
 *  5. Gli `enhancers`: oggi nessuno. È il punto in cui aggiungere
 *     l'estrazione con Claude — un `RecipeEnhancer` attivo solo se
 *     `ANTHROPIC_API_KEY` è valorizzata, che riceve `rawText` e completa
 *     ingredienti e passi — senza toccare il resto della catena.
 */

const HTML_ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5";
const MAX_HTML_BYTES = 5 * 1024 * 1024;

/** I link da non seguire nella descrizione di un video: negozi, social, accorciatori di affiliazione. */
const SKIP_LINK_HOSTS = ["amazon.", "amzn.", "spotify.", "apple.com", "patreon.", "paypal.", "linktr.ee", "t.me", "whatsapp.", "twitter.", "x.com", "pinterest."];

export type ImportOptions = {
  fetcher?: Fetcher;
  enhancers?: RecipeEnhancer[];
};

/** Gli estrattori aggiuntivi attivi. Vuoto finché non si aggiunge l'AI. */
export const DEFAULT_ENHANCERS: RecipeEnhancer[] = [];

async function fetchHtml(url: URL, fetcher: Fetcher, headers?: Record<string, string>) {
  const response = await fetcher(url, { accept: HTML_ACCEPT, maxBytes: MAX_HTML_BYTES, headers });
  if (response.contentType && !/html|xml/i.test(response.contentType)) {
    throw new ImportError("Il link non porta a una pagina web.", "non_html");
  }
  return { url: response.url, html: decodeBody(response) };
}

/** La ricetta ricavata da una pagina HTML già scaricata. */
export function recipeFromHtml(html: string, pageUrl: URL, sourceUrl: URL): ImportedRecipe {
  const $ = cheerio.load(html);
  const preview = extractPreview($, pageUrl);
  const sourceKind = isVideoHost(sourceUrl) ? "VIDEO" : "SITO";

  const structured = extractJsonLdRecipe($, pageUrl, sourceUrl.href);
  if (structured) {
    return {
      ...structured,
      title: structured.title || preview.title,
      imageUrl: structured.imageUrl ?? preview.imageUrl,
      sourceKind,
    };
  }

  // Sui social il corpo della pagina è solo il contorno dell'app: conta la
  // didascalia, che arriva nella descrizione dell'anteprima.
  const body = sourceKind === "VIDEO" ? "" : pageText($);
  const rawText = [preview.description, body].filter(Boolean).join("\n\n");
  const parsed = parseRecipeText(rawText);

  return {
    title: preview.title,
    description: sourceKind === "VIDEO" ? null : preview.description || null,
    servings: parsed.servings,
    prepMinutes: null,
    cookMinutes: null,
    category: null,
    keywords: [],
    ingredients: parsed.ingredients,
    steps: parsed.steps,
    imageUrl: preview.imageUrl,
    sourceUrl: sourceUrl.href,
    sourceKind,
    rawText: rawText || null,
    method: parsed.ingredients.length > 0 || parsed.steps.length > 0 ? "testo" : "anteprima",
  };
}

/** La ricetta ricavata dalla pagina di un video YouTube già scaricata. */
export function recipeFromYouTube(html: string, videoUrl: URL, videoId: string): ImportedRecipe {
  const details = extractYouTubeDetails(html);
  const $ = cheerio.load(html);
  const preview = extractPreview($, videoUrl);
  const description = details?.description ?? preview.description;
  const parsed = parseRecipeText(description);

  return {
    title: details?.title ?? preview.title,
    description: null,
    servings: parsed.servings,
    prepMinutes: null,
    cookMinutes: null,
    category: null,
    keywords: [],
    ingredients: parsed.ingredients,
    steps: parsed.steps,
    imageUrl: youtubeThumbnail(videoId),
    sourceUrl: videoUrl.href,
    sourceKind: "VIDEO",
    rawText: description || null,
    method: parsed.ingredients.length > 0 || parsed.steps.length > 0 ? "testo" : "anteprima",
  };
}

/**
 * Prova i link scritti nel testo della ricetta parziale, al massimo due: se
 * uno porta a una pagina con i dati strutturati, la ricetta si prende da lì
 * e la fonte resta il link incollato.
 */
async function followLinkedRecipe(partial: ImportedRecipe, fetcher: Fetcher): Promise<ImportedRecipe> {
  if (!partial.rawText) return partial;
  const candidates = linksInText(partial.rawText)
    .map((link) => {
      try {
        return parseImportUrl(link);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => url !== null)
    .filter((url) => !isVideoHost(url) && !SKIP_LINK_HOSTS.some((host) => url.hostname.includes(host)))
    .slice(0, 2);

  for (const candidate of candidates) {
    try {
      const page = await fetchHtml(candidate, fetcher);
      const $ = cheerio.load(page.html);
      const linked = extractJsonLdRecipe($, page.url, partial.sourceUrl);
      if (linked && isComplete(linked)) {
        return {
          ...linked,
          title: linked.title || partial.title,
          imageUrl: linked.imageUrl ?? partial.imageUrl,
          sourceKind: partial.sourceKind,
          rawText: partial.rawText,
        };
      }
    } catch {
      // Un link che non risponde non toglie niente a quello che si ha già.
    }
  }
  return partial;
}

export async function importRecipe(rawUrl: string, options: ImportOptions = {}): Promise<ImportedRecipe> {
  const fetcher = options.fetcher ?? safeFetch;
  const enhancers = options.enhancers ?? DEFAULT_ENHANCERS;
  const url = parseImportUrl(rawUrl);

  let recipe: ImportedRecipe;
  const videoId = youtubeVideoId(url);
  if (videoId) {
    const watchUrl = new URL(`https://www.youtube.com/watch?v=${videoId}`);
    const page = await fetchHtml(watchUrl, fetcher, { Cookie: YOUTUBE_CONSENT_COOKIE });
    recipe = recipeFromYouTube(page.html, url, videoId);
  } else {
    const page = await fetchHtml(url, fetcher);
    recipe = recipeFromHtml(page.html, page.url, url);
  }

  if (!isComplete(recipe)) recipe = await followLinkedRecipe(recipe, fetcher);

  for (const enhancer of enhancers) {
    if (isComplete(recipe)) break;
    if (enhancer.enabled()) recipe = await enhancer.enhance(recipe);
  }

  if (!recipe.title && recipe.ingredients.length === 0) {
    throw new ImportError("Non ho trovato una ricetta a questo indirizzo.", "nessuna_ricetta");
  }
  return recipe;
}
