import { describe, expect, it } from "vitest";
import { bimbyTitle, suggestedTags } from "./tags";
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
    resolvedUrl: null,
    sourceKind: "SITO",
    rawText: null,
    method: "dati-strutturati",
    ...overrides,
  };
}

const isBimby = (overrides: Partial<ImportedRecipe>) => suggestedTags(recipe(overrides)).includes("bimby");

describe("suggestedTags", () => {
  it("per una ricetta qualsiasi propone solo il nome del sito", () => {
    expect(suggestedTags(recipe({}))).toEqual(["ricette.esempio.it"]);
  });

  it("propone bimby e il nome del sito, senza www e senza percorso", () => {
    expect(suggestedTags(recipe({ sourceUrl: "https://www.ricetteperbimby.it/ricette/risotto-con-zucchine-bimby" }))).toEqual([
      "bimby",
      "ricetteperbimby.it",
    ]);
  });

  it("non propone un nome del sito troppo lungo per un tag", () => {
    expect(suggestedTags(recipe({ sourceUrl: "https://ricette.un-sito-dal-nome-lunghissimo.it/risotto" }))).toEqual([]);
  });

  it("riconosce il Bimby nominato nel titolo, nel link o nel testo", () => {
    expect(isBimby({ title: "Risotto con zucchine Bimby" })).toBe(true);
    expect(isBimby({ sourceUrl: "https://www.ricetteperbimby.it/ricette/risotto" })).toBe(true);
    expect(isBimby({ rawText: "Ricetta per #Thermomix TM6" })).toBe(true);
    expect(isBimby({ steps: [{ section: null, text: "Cuocete 20 min. a temperatura Varoma." }] })).toBe(true);
  });

  it("riconosce il Bimby nelle parole chiave e nella categoria dei dati strutturati", () => {
    expect(isBimby({ keywords: ["risotto zucchine", "ricette bimby"] })).toBe(true);
    expect(isBimby({ category: "Primi Bimby" })).toBe(true);
  });

  it("riconosce la notazione del Bimby: velocità abbreviata più una parola del boccale", () => {
    expect(isBimby({ steps: [{ section: null, text: "Mettete nel boccale la cipolla e tritate 5 sec. vel. 5." }] })).toBe(true);
  });

  it("non scambia per Bimby la planetaria o un boccale di birra", () => {
    expect(isBimby({})).toBe(false);
    expect(isBimby({ steps: [{ section: null, text: "Lavorate in planetaria a velocità 2, poi vel. 4." }] })).toBe(false);
    expect(isBimby({ steps: [{ section: null, text: "Versate la birra in un boccale e mescolate in senso antiorario." }] })).toBe(false);
  });
});

describe("bimbyTitle", () => {
  const title = (text: string) => bimbyTitle(text, 150);

  it("aggiunge «- Bimby» in fondo", () => {
    expect(title("Risotto con zucchine")).toBe("Risotto con zucchine - Bimby");
    expect(title("Salmone al Varoma")).toBe("Salmone al Varoma - Bimby");
  });

  it("sposta in fondo la menzione che c'è già", () => {
    expect(title("Risotto con zucchine Bimby")).toBe("Risotto con zucchine - Bimby");
    expect(title("RISOTTO CON ZUCCHINE BIMBY")).toBe("RISOTTO CON ZUCCHINE - Bimby");
    expect(title("Pane al Bimby con farina integrale")).toBe("Pane con farina integrale - Bimby");
    expect(title("Torta al cioccolato con il Bimby TM5")).toBe("Torta al cioccolato - Bimby");
    expect(title("Bimby: risotto alla zucca")).toBe("Risotto alla zucca - Bimby");
    expect(title("Ciambellone (Bimby TM6)")).toBe("Ciambellone - Bimby");
    expect(title("Pasta e patate - ricetta Bimby")).toBe("Pasta e patate - Bimby");
    expect(title("Pane al Thermomix")).toBe("Pane - Bimby");
  });

  it("non ripete il suffisso se c'è già", () => {
    expect(title("Risotto - Bimby")).toBe("Risotto - Bimby");
    expect(title(title("Risotto con zucchine Bimby"))).toBe("Risotto con zucchine - Bimby");
  });

  it("lascia com'è un titolo che è solo la menzione", () => {
    expect(title("Bimby")).toBe("Bimby");
  });

  it("resta nella lunghezza massima senza perdere il suffisso", () => {
    const long = bimbyTitle("Torta ".repeat(40), 150);
    expect(long.length).toBeLessThanOrEqual(150);
    expect(long.endsWith(" - Bimby")).toBe(true);
  });
});
