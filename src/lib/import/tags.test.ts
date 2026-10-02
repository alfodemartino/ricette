import { describe, expect, it } from "vitest";
import { suggestedTags } from "./tags";
import type { ImportedRecipe } from "./types";

function recipe(overrides: Partial<ImportedRecipe>): ImportedRecipe {
  return {
    title: "Risotto",
    description: null,
    servings: 4,
    prepMinutes: null,
    cookMinutes: null,
    category: null,
    keywords: [],
    ingredients: [{ section: null, text: "320 g di riso" }],
    steps: [{ section: null, text: "Cuocete il riso nel brodo." }],
    imageUrl: null,
    sourceUrl: "https://ricette.esempio.it/risotto",
    sourceKind: "SITO",
    rawText: null,
    method: "dati-strutturati",
    ...overrides,
  };
}

describe("suggestedTags", () => {
  it("non propone niente per una ricetta qualsiasi", () => {
    expect(suggestedTags(recipe({}))).toEqual([]);
  });

  it("riconosce il Bimby nominato nel titolo, nel link o nel testo", () => {
    expect(suggestedTags(recipe({ title: "Risotto con zucchine Bimby" }))).toEqual(["bimby"]);
    expect(suggestedTags(recipe({ sourceUrl: "https://www.ricetteperbimby.it/ricette/risotto" }))).toEqual(["bimby"]);
    expect(suggestedTags(recipe({ rawText: "Ricetta per #Thermomix TM6" }))).toEqual(["bimby"]);
    expect(suggestedTags(recipe({ steps: [{ section: null, text: "Cuocete 20 min. a temperatura Varoma." }] }))).toEqual(["bimby"]);
  });

  it("riconosce il Bimby nelle parole chiave e nella categoria dei dati strutturati", () => {
    expect(suggestedTags(recipe({ keywords: ["risotto zucchine", "ricette bimby"] }))).toEqual(["bimby"]);
    expect(suggestedTags(recipe({ category: "Primi Bimby" }))).toEqual(["bimby"]);
  });

  it("riconosce la notazione del Bimby: velocità abbreviata più una parola del boccale", () => {
    const steps = [{ section: null, text: "Mettete nel boccale la cipolla e tritate 5 sec. vel. 5." }];
    expect(suggestedTags(recipe({ steps }))).toEqual(["bimby"]);
  });

  it("non scambia per Bimby la planetaria o un boccale di birra", () => {
    const planetaria = [{ section: null, text: "Lavorate in planetaria a velocità 2, poi vel. 4." }];
    const birra = [{ section: null, text: "Versate la birra in un boccale e mescolate in senso antiorario." }];
    expect(suggestedTags(recipe({ steps: planetaria }))).toEqual([]);
    expect(suggestedTags(recipe({ steps: birra }))).toEqual([]);
  });
});
