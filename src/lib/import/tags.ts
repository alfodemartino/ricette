import type { ImportedRecipe } from "@/lib/import/types";
import { normalizeForSearch } from "@/lib/text";

/**
 * I tag che l'import propone da solo, ricavati da quello che dice la fonte.
 * Finiscono nella bozza: chi la controlla può toglierli prima di salvare.
 */

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
  const text = normalizeForSearch(
    [
      recipe.title,
      recipe.description,
      recipe.sourceUrl,
      recipe.rawText,
      ...recipe.ingredients.map((item) => item.text),
      ...recipe.steps.map((step) => step.text),
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return mentionsBimby(text) ? ["bimby"] : [];
}
