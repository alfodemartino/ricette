"use server";

import { listFamilyRecipesToShare } from "@/lib/recipes";
import { familyViewerOrNull, isId } from "@/lib/session";
import type { ShareableRecipe } from "@/lib/share";

export type ShareRecipesResult = { recipes: ShareableRecipe[] } | { error: string };

/** Oltre, un messaggio solo non lo legge più nessuno. */
const MAX_RECIPES = 50;

/**
 * Le ricette scelte nell'elenco, da mandare come messaggio: l'elenco non ha
 * quantità né passi, e il testo si compone nel browser. Come ogni lettura
 * passa dalla famiglia: l'id di una ricetta di un'altra famiglia qui non
 * trova niente.
 */
export async function recipesToShareAction(ids: string[]): Promise<ShareRecipesResult> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: "La sessione è scaduta o non fai più parte della famiglia: ricarica la pagina." };

  // Gli id arrivano dal browser: si tengono solo quelli che hanno la forma giusta.
  const wanted = Array.isArray(ids) ? [...new Set(ids.filter(isId))] : [];
  if (wanted.length > MAX_RECIPES) return { error: `Si possono mandare al massimo ${MAX_RECIPES} ricette alla volta.` };

  const recipes = wanted.length > 0 ? await listFamilyRecipesToShare(viewer.familyId, wanted) : [];
  if (recipes.length === 0) return { error: "Non trovo più la ricetta: forse è stata eliminata. Ricarica la pagina." };
  return { recipes };
}
