import { normalizeForSearch } from "@/lib/text";

/**
 * Le portate in cui si divide il ricettario. L'ordine è quello di un menu,
 * dall'antipasto al dolce, ed è lo stesso dei filtri nell'elenco.
 *
 * Deve coincidere con l'enum `RecipeCategory` dello schema: lo verifica un
 * test, così una categoria aggiunta in un posto solo non passa inosservata.
 */
export const CATEGORIES = [
  { id: "ANTIPASTO", label: "Antipasto", plural: "Antipasti" },
  { id: "PRIMO", label: "Primo", plural: "Primi" },
  { id: "SECONDO", label: "Secondo", plural: "Secondi" },
  { id: "CONTORNO", label: "Contorno", plural: "Contorni" },
  { id: "PIATTO_UNICO", label: "Piatto unico", plural: "Piatti unici" },
  { id: "DOLCE", label: "Dolce", plural: "Dolci" },
  { id: "LIEVITATO", label: "Pane e lievitati", plural: "Pane e lievitati" },
  { id: "SALSA", label: "Salsa o condimento", plural: "Salse e condimenti" },
  { id: "BEVANDA", label: "Bevanda", plural: "Bevande" },
  { id: "ALTRO", label: "Altro", plural: "Altro" },
] as const;

export type RecipeCategory = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id) as [
  RecipeCategory,
  ...RecipeCategory[],
];

export function isCategory(value: unknown): value is RecipeCategory {
  return typeof value === "string" && (CATEGORY_IDS as string[]).includes(value);
}

export function categoryLabel(category: RecipeCategory): string {
  return CATEGORIES.find((entry) => entry.id === category)?.label ?? category;
}

/**
 * Parole con cui i siti di ricette chiamano le portate (`recipeCategory` dei
 * dati strutturati, in italiano o in inglese). Si confrontano con il testo
 * normalizzato, quindi senza accenti e in minuscolo; vince la prima che
 * compare, perciò le più specifiche stanno in alto («piatto unico» prima di
 * «piatto»).
 */
const CATEGORY_HINTS: [RegExp, RecipeCategory][] = [
  [/piatt[oi] unic|one.?pot|main dish/, "PIATTO_UNICO"],
  // Prima dei dolci: «torta» da sola è un dolce, una torta salata no.
  [/torte? salat|quiche|rustic/, "ANTIPASTO"],
  [/antipast|starter|appetizer|finger food|stuzzichin/, "ANTIPASTO"],
  [/prim[oi]\b|primi piatti|pasta|risott|zupp|minestr|soup/, "PRIMO"],
  [/second[oi]\b|secondi piatti|main course|carne|pesce/, "SECONDO"],
  [/contorn|side dish|verdur/, "CONTORNO"],
  [/dolc|dessert|torta|biscott|cake|cookie|pasticcer/, "DOLCE"],
  [/lievitat|pane\b|pizza|focacc|bread/, "LIEVITATO"],
  [/salsa|salse|sugo|sughi|condiment|sauce|pesto/, "SALSA"],
  [/bevand|drink|cocktail|liquor|frullat|smoothie/, "BEVANDA"],
];

/** La categoria che corrisponde a un'etichetta libera, se se ne riconosce una. */
export function guessCategory(text: string | null | undefined): RecipeCategory | null {
  if (!text) return null;
  const normalized = normalizeForSearch(text);
  for (const [pattern, category] of CATEGORY_HINTS) {
    if (pattern.test(normalized)) return category;
  }
  return null;
}
