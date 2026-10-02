import type { ImportedRecipe } from "@/lib/import/types";
import { siteName } from "@/lib/site";
import { MAX_TAG_LENGTH } from "@/lib/tags";
import { normalizeForSearch } from "@/lib/text";

/**
 * I tag che l'import propone da solo, ricavati da quello che dice la fonte:
 * `bimby` per le ricette fatte col Bimby e il nome del sito da cui arriva la
 * ricetta. Finiscono nella bozza: chi la controlla può toglierli prima di
 * salvare.
 */

export const BIMBY_TAG = "bimby";

/** Nomi e accessori che esistono solo per il Bimby: ne basta uno. */
const BIMBY_NAMES = /bimby|thermomix|\bvaroma\b|\btm ?(?:21|31|5|6|7)\b/;

/**
 * La notazione delle ricette per il Bimby: la velocità abbreviata («10 sec.
 * vel. 5») insieme a una parola del boccale («antiorario», «misurino»…). Prese
 * da sole possono comparire anche altrove, insieme no.
 */
const BIMBY_SPEED = /\bvel\.\s*(?:\d|soft|spiga)/;
const BIMBY_WORDS = /\b(?:antiorario|boccale|misurino)\b/;

function mentionsBimby(text: string): boolean {
  return BIMBY_NAMES.test(text) || (BIMBY_SPEED.test(text) && BIMBY_WORDS.test(text));
}

export function suggestedTags(recipe: ImportedRecipe): string[] {
  const tags: string[] = [];
  const text = normalizeForSearch(
    [
      recipe.title,
      recipe.description,
      recipe.category,
      ...recipe.keywords,
      recipe.sourceUrl,
      recipe.rawText,
      ...recipe.ingredients.map((item) => item.text),
      ...recipe.steps.map((step) => step.text),
    ]
      .filter(Boolean)
      .join("\n"),
  );
  if (mentionsBimby(text)) tags.push(BIMBY_TAG);

  // Un dominio troncato non direbbe più da dove arriva la ricetta: piuttosto
  // niente tag.
  const site = siteName(recipe.sourceUrl);
  if (site && site.length <= MAX_TAG_LENGTH) tags.push(site);
  return tags;
}

/**
 * Le menzioni del Bimby in un titolo: «Bimby», «Thermomix», col modello
 * («Bimby TM6») e con la preposizione che le lega al resto («al Bimby», «con
 * il Bimby», «ricetta Bimby»). Il Varoma resta: dice come si cuoce.
 */
const TITLE_MENTION =
  /(?:\b(?:ricett[ae]|con|col|al|nel|per)\s+(?:(?:il|la)\s+)?)?#?\b(?:bimby|thermomix)\b(?:\s*®)?(?:\s*tm\s?(?:21|31|5|6|7)\b)?|\btm\s?(?:21|31|5|6|7)\b/giu;
const BIMBY_SUFFIX = " - Bimby";

/**
 * Il titolo di una ricetta per il Bimby: la menzione del Bimby si sposta in
 * fondo, così le ricette Bimby finiscono tutte allo stesso modo.
 * «Risotto con zucchine Bimby» → «Risotto con zucchine - Bimby».
 */
export function bimbyTitle(title: string, maxLength: number): string {
  const base = title
    .replace(TITLE_MENTION, " ")
    // Quello che la menzione lascia dietro: parentesi vuote, spazi prima
    // della punteggiatura, separatori doppi o rimasti in testa e in coda.
    .replace(/[([{]\s*[)\]}]/g, " ")
    .replace(/\s+([,.;:!?)\]}])/g, "$1")
    .replace(/([-–—:|,·])(?:\s*[-–—:|,·])+/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:|,·]+|[\s\-–—:|,·]+$/g, "");
  if (!base) return title.trim().slice(0, maxLength);

  const capitalized = base.charAt(0).toLocaleUpperCase("it-IT") + base.slice(1);
  return `${capitalized.slice(0, maxLength - BIMBY_SUFFIX.length).trimEnd()}${BIMBY_SUFFIX}`;
}
