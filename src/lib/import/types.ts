/**
 * Quello che l'import riesce a ricavare da un link, prima che diventi una
 * bozza del form. È il punto d'incontro degli estrattori: ognuno lo riempie
 * per quanto può, e la pagina di import mostra il risultato da controllare.
 */
export type ImportedStep = { section: string | null; text: string };

export type ImportedRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  category: string | null;
  /** Le righe degli ingredienti così come le scrive la fonte. */
  ingredients: { section: string | null; text: string }[];
  steps: ImportedStep[];
  imageUrl: string | null;
  sourceUrl: string;
  sourceKind: "SITO" | "VIDEO";
  /**
   * Il testo grezzo da cui si è partiti quando non c'erano dati strutturati:
   * la descrizione di un video, la didascalia di un post, il corpo di una
   * pagina. Oggi serve solo all'estrazione euristica; è anche quello che un
   * futuro estrattore con un modello linguistico riceverebbe.
   */
  rawText: string | null;
  /** Come è stata ricavata, per dirlo a chi controlla la bozza. */
  method: "dati-strutturati" | "testo" | "anteprima";
};

/** Completa se ci sono sia gli ingredienti sia il procedimento. */
export function isComplete(recipe: ImportedRecipe): boolean {
  return recipe.ingredients.length > 0 && recipe.steps.length > 0;
}

/**
 * Un passaggio facoltativo che migliora una ricetta importata in modo
 * parziale. La catena oggi è vuota: è il punto in cui si aggancerà
 * l'estrazione con Claude (vedi `src/lib/import/index.ts`).
 */
export type RecipeEnhancer = {
  name: string;
  /** Vero se il passaggio è configurato (ad esempio, c'è la chiave API). */
  enabled(): boolean;
  enhance(recipe: ImportedRecipe): Promise<ImportedRecipe>;
};
