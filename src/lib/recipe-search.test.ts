import { describe, expect, it } from "vitest";
import { filterRecipes, filtersHref, hasFilters, parseFilters, type SearchableRecipe } from "./recipe-search";

function recipe(overrides: Partial<SearchableRecipe> & { title: string }): SearchableRecipe {
  return {
    description: null,
    notes: null,
    category: null,
    prepMinutes: null,
    cookMinutes: null,
    ingredients: [],
    tags: [],
    ...overrides,
  };
}

function ingredient(name: string, note: string | null = null) {
  return { name, note };
}

const frittata = recipe({
  title: "Frittata di zucchine",
  category: "SECONDO",
  prepMinutes: 10,
  cookMinutes: 15,
  ingredients: [ingredient("Uova"), ingredient("Zucchine")],
  tags: [{ name: "veloce" }, { name: "vegetariano" }],
});
const tiramisu = recipe({
  title: "Tiramisù",
  category: "DOLCE",
  prepMinutes: 30,
  ingredients: [ingredient("Mascarpone"), ingredient("Caffè")],
  tags: [{ name: "vegetariano" }],
});
const ragu = recipe({ title: "Ragù della domenica", category: "SALSA", ingredients: [ingredient("Passata")] });
const minestrone = recipe({
  title: "Minestrone",
  category: "PRIMO",
  ingredients: [ingredient("Verdure miste", "una carota, una patata e una zucchina")],
});
const all = [frittata, tiramisu, ragu, minestrone];

const none = { q: "", category: null, tags: [], maxMinutes: null };

describe("filterRecipes", () => {
  it("senza filtri restituisce tutto", () => {
    expect(filterRecipes(all, none)).toEqual(all);
  });

  it("cerca anche fra gli ingredienti, senza badare agli accenti", () => {
    expect(filterRecipes(all, { ...none, q: "zucchine" })).toEqual([frittata]);
    expect(filterRecipes(all, { ...none, q: "caffe" })).toEqual([tiramisu]);
    expect(filterRecipes(all, { ...none, q: "tiramisu" })).toEqual([tiramisu]);
  });

  it("cerca anche nelle note degli ingredienti", () => {
    expect(filterRecipes(all, { ...none, q: "zucchin" })).toEqual([frittata, minestrone]);
    expect(filterRecipes(all, { ...none, q: "patata" })).toEqual([minestrone]);
  });

  it("vuole tutte le parole, in qualsiasi ordine", () => {
    expect(filterRecipes(all, { ...none, q: "uova frittata" })).toEqual([frittata]);
    expect(filterRecipes(all, { ...none, q: "uova mascarpone" })).toEqual([]);
  });

  it("trova la categoria per nome", () => {
    expect(filterRecipes(all, { ...none, q: "dolce" })).toEqual([tiramisu]);
  });

  it("filtra per categoria", () => {
    expect(filterRecipes(all, { ...none, category: "SECONDO" })).toEqual([frittata]);
  });

  it("vuole tutti i tag scelti", () => {
    expect(filterRecipes(all, { ...none, tags: ["vegetariano"] })).toEqual([frittata, tiramisu]);
    expect(filterRecipes(all, { ...none, tags: ["Vegetariano", "veloce"] })).toEqual([frittata]);
  });

  it("con un limite di tempo esclude le ricette troppo lunghe e quelle senza tempi", () => {
    expect(filterRecipes(all, { ...none, maxMinutes: 30 })).toEqual([frittata, tiramisu]);
    expect(filterRecipes(all, { ...none, maxMinutes: 15 })).toEqual([]);
  });
});

describe("filtri nell'indirizzo", () => {
  it("legge i parametri e ignora quelli non validi", () => {
    expect(parseFilters({ q: " zucchine ", categoria: "PRIMO", tag: ["veloce", "veloce"], tempo: "30" })).toEqual({
      q: "zucchine",
      category: "PRIMO",
      tags: ["veloce"],
      maxMinutes: 30,
    });
    expect(parseFilters({ categoria: "NIENTE", tempo: "abc" })).toEqual(none);
  });

  it("ricompone l'indirizzo", () => {
    expect(filtersHref(none)).toBe("/ricette");
    expect(filtersHref({ q: "pasta", category: "PRIMO", tags: ["veloce"], maxMinutes: 30 })).toBe(
      "/ricette?q=pasta&categoria=PRIMO&tag=veloce&tempo=30",
    );
  });

  it("dice se c'è almeno un filtro", () => {
    expect(hasFilters(none)).toBe(false);
    expect(hasFilters({ ...none, tags: ["veloce"] })).toBe(true);
  });
});
