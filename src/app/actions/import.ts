"use server";

import { importRecipe } from "@/lib/import";
import { isComplete } from "@/lib/import/types";
import { ImportError } from "@/lib/import/url";
import { logEvent } from "@/lib/log";
import { draftFromImport, type RecipeDraft } from "@/lib/recipe-draft";
import { findFamilyRecipesFromSource } from "@/lib/recipes";
import { familyViewerOrNull } from "@/lib/session";

export type ImportState = {
  error?: string;
  url?: string;
  draft?: RecipeDraft;
  /** Vero se sono arrivati sia gli ingredienti sia il procedimento. */
  complete?: boolean;
  method?: "dati-strutturati" | "testo" | "anteprima";
  /** Il testo da cui partire a mano quando l'import è parziale. */
  rawText?: string;
  /** Le ricette della famiglia che vengono già da questo link. */
  existing?: { id: string; title: string }[];
};

/**
 * Prepara la bozza di una ricetta a partire da un link. Non salva niente: la
 * bozza torna al browser, che la mostra nel form da controllare. Se la
 * famiglia ha già una ricetta da quel link lo dice, ma non impedisce di
 * salvarne un'altra: può essere una variante voluta.
 */
export async function importRecipeAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: "La sessione è scaduta: ricarica la pagina." };

  const url = String(formData.get("url") ?? "").trim();
  try {
    const imported = await importRecipe(url);
    return {
      url,
      draft: draftFromImport(imported),
      complete: isComplete(imported),
      method: imported.method,
      rawText: imported.rawText?.slice(0, 5000) ?? undefined,
      existing: await findFamilyRecipesFromSource(viewer.familyId, [url, imported.sourceUrl, imported.resolvedUrl]),
    };
  } catch (error) {
    if (error instanceof ImportError) {
      logEvent("warn", error.reason === "indirizzo_privato" ? "import_bloccato" : "import_fallito", {
        url: url.slice(0, 300),
        motivo: error.reason,
        utente: viewer.id,
      });
      return { url, error: error.message };
    }
    logEvent("error", "import_fallito", { url: url.slice(0, 300), motivo: String(error).slice(0, 200), utente: viewer.id });
    return { url, error: "Qualcosa è andato storto leggendo la pagina. Puoi sempre inserire la ricetta a mano." };
  }
}
