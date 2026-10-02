import { categoryLabel, isCategory, type RecipeCategory } from "@/lib/categories";
import { totalMinutes } from "@/lib/duration";
import { normalizeForSearch } from "@/lib/text";
import { tagKey } from "@/lib/tags";

/**
 * Ricerca e filtri dell'elenco delle ricette. I criteri stanno nell'indirizzo
 * (`?q=zucchine&categoria=PRIMO&tag=veloce&tempo=30`), così una ricerca si
 * ricarica, si condivide e si torna indietro senza perderla.
 *
 * Una famiglia ha al più qualche centinaio di ricette: si filtra qui, in
 * memoria, con lo stesso confronto senza accenti di finanze, invece di
 * chiedere a Postgres di ignorare gli accenti con un'estensione in più.
 */

export type RecipeFilters = {
  q: string;
  category: RecipeCategory | null;
  tags: string[];
  maxMinutes: number | null;
};

/** I limiti di tempo proposti come filtro. */
export const TIME_FILTERS = [15, 30, 60] as const;

type SearchParamValue = string | string[] | undefined;

function first(value: SearchParamValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function all(value: SearchParamValue): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** I filtri letti dall'indirizzo; quello che non si capisce si ignora. */
export function parseFilters(params: Record<string, SearchParamValue>): RecipeFilters {
  const category = first(params.categoria);
  const minutes = Number(first(params.tempo));
  return {
    q: first(params.q).trim().slice(0, 100),
    category: isCategory(category) ? category : null,
    tags: [...new Set(all(params.tag).map((tag) => tag.trim()).filter(Boolean))],
    maxMinutes: Number.isInteger(minutes) && minutes > 0 ? minutes : null,
  };
}

/** L'indirizzo dell'elenco con questi filtri. */
export function filtersHref(filters: RecipeFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("categoria", filters.category);
  for (const tag of filters.tags) params.append("tag", tag);
  if (filters.maxMinutes) params.set("tempo", String(filters.maxMinutes));
  const query = params.toString();
  return query ? `/ricette?${query}` : "/ricette";
}

export function hasFilters(filters: RecipeFilters): boolean {
  return Boolean(filters.q || filters.category || filters.tags.length > 0 || filters.maxMinutes);
}

/** Quello che di una ricetta serve per cercarla. */
export type SearchableRecipe = {
  title: string;
  description: string | null;
  notes: string | null;
  category: RecipeCategory | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: { name: string; note: string | null }[];
  tags: { name: string }[];
};

/**
 * Il testo in cui si cerca: titolo, descrizione, note, categoria, ingredienti
 * (nome e nota) e tag. Così «zucchine» trova anche la frittata che le ha solo
 * fra gli ingredienti, «zucchina» il minestrone con «Verdure miste» annotate
 * «una carota e una zucchina», e «dolce» le ricette della categoria Dolce.
 */
export function recipeSearchText(recipe: SearchableRecipe): string {
  return normalizeForSearch(
    [
      recipe.title,
      recipe.description,
      recipe.notes,
      recipe.category && categoryLabel(recipe.category),
      ...recipe.ingredients.flatMap((ingredient) => [ingredient.name, ingredient.note]),
      ...recipe.tags.map((tag) => tag.name),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Le ricette che rispettano tutti i filtri. Nella ricerca libera ogni parola
 * deve comparire, in qualsiasi ordine; dei tag servono tutti quelli scelti.
 * Con un limite di tempo restano fuori le ricette senza tempi: non si sa se
 * ci stanno.
 */
export function filterRecipes<T extends SearchableRecipe>(recipes: T[], filters: RecipeFilters): T[] {
  const terms = normalizeForSearch(filters.q).split(/\s+/).filter(Boolean);
  const wantedTags = filters.tags.map(tagKey);

  return recipes.filter((recipe) => {
    if (filters.category && recipe.category !== filters.category) return false;

    if (wantedTags.length > 0) {
      const keys = new Set(recipe.tags.map((tag) => tagKey(tag.name)));
      if (!wantedTags.every((key) => keys.has(key))) return false;
    }

    if (filters.maxMinutes) {
      const total = totalMinutes(recipe.prepMinutes, recipe.cookMinutes);
      if (total === null || total > filters.maxMinutes) return false;
    }

    if (terms.length > 0) {
      const text = recipeSearchText(recipe);
      if (!terms.every((term) => text.includes(term))) return false;
    }

    return true;
  });
}
