import { describe, expect, it } from "vitest";
import { parseRecipeText } from "./text-recipe";

describe("parseRecipeText", () => {
  it("legge una descrizione di video con intestazioni", () => {
    const text = [
      "La pasta più veloce che ci sia! 🍝",
      "",
      "INGREDIENTI per 2 persone:",
      "- 200 g di spaghetti",
      "- 2 spicchi d'aglio",
      "- olio extravergine q.b.",
      "- 1 peperoncino",
      "",
      "PROCEDIMENTO:",
      "1. Cuocete gli spaghetti in abbondante acqua salata.",
      "2. Nel frattempo scaldate l'olio con aglio e peperoncino.",
      "3. Scolate la pasta al dente e saltatela in padella.",
      "",
      "Seguimi su Instagram: https://instagram.com/esempio",
      "#pasta #ricettaveloce",
    ].join("\n");

    const recipe = parseRecipeText(text);

    expect(recipe.servings).toBe(2);
    expect(recipe.ingredients.map((item) => item.text)).toEqual([
      "- 200 g di spaghetti",
      "- 2 spicchi d'aglio",
      "- olio extravergine q.b.",
      "- 1 peperoncino",
    ]);
    expect(recipe.steps.map((step) => step.text)).toEqual([
      "Cuocete gli spaghetti in abbondante acqua salata.",
      "Nel frattempo scaldate l'olio con aglio e peperoncino.",
      "Scolate la pasta al dente e saltatela in padella.",
    ]);
  });

  it("riconosce le sottosezioni degli ingredienti", () => {
    const text = ["Ingredienti", "Per la base:", "200 g di biscotti", "Per la crema:", "250 g di mascarpone"].join("\n");

    expect(parseRecipeText(text).ingredients).toEqual([
      { section: "Per la base", text: "200 g di biscotti" },
      { section: "Per la crema", text: "250 g di mascarpone" },
    ]);
  });

  it("passa al procedimento quando dopo l'elenco comincia il testo", () => {
    const text = [
      "Ingredienti:",
      "3 uova",
      "2 zucchine",
      "Sale q.b.",
      "Sbattete le uova con un pizzico di sale e unite le zucchine tagliate a rondelle sottili.",
      "Cuocete in padella cinque minuti per lato.",
    ].join("\n");

    const recipe = parseRecipeText(text);

    expect(recipe.ingredients).toHaveLength(3);
    expect(recipe.steps).toHaveLength(2);
  });

  it("senza intestazioni trova l'elenco più lungo di ingredienti", () => {
    const text = ["Ecco la mia torta preferita", "", "• 250 g di farina", "• 3 uova", "• 150 g di zucchero", "• 1 bustina di lievito", "", "Buon appetito!"].join("\n");

    expect(parseRecipeText(text).ingredients.map((item) => item.text)).toHaveLength(4);
  });

  it("non scambia due numeri sparsi per un elenco", () => {
    const text = "Video girato il 3 maggio\nDurata 10 minuti\nGrazie a tutti!";

    expect(parseRecipeText(text).ingredients).toEqual([]);
  });

  it("non legge «cuocete per 10 minuti» come porzioni", () => {
    expect(parseRecipeText("Cuocete per 10 minuti.").servings).toBeNull();
    expect(parseRecipeText("Dosi per 6 persone.").servings).toBe(6);
  });
});
