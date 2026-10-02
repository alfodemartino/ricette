import { describe, expect, it } from "vitest";
import { parseRecipeText } from "./import/text-recipe";
import { parseIngredientLine } from "./ingredients";
import {
  mailtoHref,
  recipeShareText,
  recipesShareText,
  shareableRecipe,
  shareSubject,
  whatsappHref,
  type ShareableRecipe,
} from "./share";

function recipe(overrides: Partial<ShareableRecipe> & { title: string }): ShareableRecipe {
  return {
    category: null,
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    notes: null,
    sourceUrl: null,
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

function item(name: string, quantity: number | null = null, unit: string | null = null, note: string | null = null, section: string | null = null) {
  return { section, quantity, unit, name, note };
}

function step(text: string, section: string | null = null) {
  return { section, text };
}

const risotto = recipe({
  title: "Risotto alle zucchine",
  category: "PRIMO",
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 30,
  sourceUrl: "https://www.esempio.it/risotto-alle-zucchine",
  ingredients: [
    item("Riso Carnaroli", 320, "g"),
    item("Zucchine", 3),
    item("Cipolla", 0.5),
    item("Vino bianco secco", 0.5, "bicchiere"),
    item("Brodo vegetale", 1, "l"),
    item("Parmigiano", null, null, "q.b., grattugiato"),
    item("Sale", null, null, "q.b."),
  ],
  steps: [
    step("Trita la cipolla e falla appassire nel burro."),
    step("Tosta il riso e sfuma con il vino."),
    step("Porta a cottura con il brodo,\npoi manteca con il parmigiano."),
  ],
});

const tiramisu = recipe({
  title: "Tiramisù",
  category: "DOLCE",
  servings: 8,
  prepMinutes: 40,
  notes: "Meglio se riposa una notte in frigorifero.\n\n\n\nSi conserva due giorni.",
  ingredients: [
    item("Mascarpone", 500, "g", null, "Per la crema"),
    item("Uova", 4, null, "a temperatura ambiente", "Per la crema"),
    item("Zucchero", 100, "g", null, "Per la crema"),
    item("Savoiardi", 300, "g", null, "Per la base"),
    item("Caffè", 300, "ml", null, "Per la base"),
    item("Cacao amaro", null, null, "q.b.", "Per la base"),
  ],
  steps: [
    step("Monta i tuorli con lo zucchero.", "La crema"),
    step("Aggiungi il mascarpone poco alla volta.", "La crema"),
    step("Bagna i savoiardi nel caffè freddo.", "Il montaggio"),
    step("Spolvera di cacao e lascia in frigorifero.", "Il montaggio"),
  ],
});

describe("recipeShareText", () => {
  it("scrive titolo, riepilogo, ingredienti, passi e fonte", () => {
    expect(recipeShareText(risotto)).toBe(
      [
        "🍽️ Risotto alle zucchine",
        "Primo · 4 persone · ⏱️ 40 min",
        "",
        "🛒 Ingredienti",
        "• Riso Carnaroli 320 g",
        "• Zucchine 3",
        "• Cipolla ½",
        "• Vino bianco secco ½ bicchiere",
        "• Brodo vegetale 1 l",
        "• Parmigiano q.b. (grattugiato)",
        "• Sale q.b.",
        "",
        "🍳 Procedimento",
        "1. Trita la cipolla e falla appassire nel burro.",
        "2. Tosta il riso e sfuma con il vino.",
        "3. Porta a cottura con il brodo, poi manteca con il parmigiano.",
        "",
        "🔗 https://www.esempio.it/risotto-alle-zucchine",
      ].join("\n"),
    );
  });

  it("ricalcola le quantità per le persone scelte, come la pagina", () => {
    const text = recipeShareText(risotto, 6);
    expect(text).toContain("Primo · 6 persone · ⏱️ 40 min");
    expect(text).toContain("• Riso Carnaroli 480 g");
    expect(text).toContain("• Zucchine 4½");
    expect(text).toContain("• Cipolla ¾");
    expect(text).toContain("• Brodo vegetale 1,5 l");
    expect(text).toContain("• Sale q.b.");

    const forOne = recipeShareText(risotto, 1);
    expect(forOne).toContain("Primo · 1 persona ·");
    expect(forOne).toContain("• Riso Carnaroli 80 g");
  });

  it("lascia le quantità come sono se la ricetta non dice per quante persone è", () => {
    const text = recipeShareText({ ...risotto, servings: null }, 6);
    expect(text).toContain("Primo · ⏱️ 40 min");
    expect(text).toContain("• Riso Carnaroli 320 g");
  });

  it("separa le sottosezioni e numera i passi di seguito, con le note così come sono", () => {
    expect(recipeShareText(tiramisu)).toBe(
      [
        "🍽️ Tiramisù",
        "Dolce · 8 persone · ⏱️ 40 min",
        "",
        "🛒 Ingredienti",
        "Per la crema:",
        "• Mascarpone 500 g",
        "• Uova 4 (a temperatura ambiente)",
        "• Zucchero 100 g",
        "",
        "Per la base:",
        "• Savoiardi 300 g",
        "• Caffè 300 ml",
        "• Cacao amaro q.b.",
        "",
        "🍳 Procedimento",
        "La crema:",
        "1. Monta i tuorli con lo zucchero.",
        "2. Aggiungi il mascarpone poco alla volta.",
        "",
        "Il montaggio:",
        "3. Bagna i savoiardi nel caffè freddo.",
        "4. Spolvera di cacao e lascia in frigorifero.",
        "",
        "📝 Note",
        "Meglio se riposa una notte in frigorifero.",
        "",
        "Si conserva due giorni.",
      ].join("\n"),
    );
  });

  it("di una ricetta senza altro manda solo il titolo", () => {
    expect(recipeShareText(recipe({ title: "  Pane   di casa " }))).toBe("🍽️ Pane di casa");
  });

  it("si rilegge con l'import da testo", () => {
    for (const original of [risotto, tiramisu]) {
      const parsed = parseRecipeText(recipeShareText(original));
      expect(parsed.servings).toBe(original.servings);
      expect(parsed.ingredients.map(({ section, text }) => ({ section, ...parseIngredientLine(text) }))).toEqual(
        original.ingredients,
      );
      expect(parsed.steps).toEqual(original.steps.map(({ section, text }) => ({ section, text: text.replace(/\s+/g, " ") })));
    }
  });

  it("si rilegge anche con le quantità ricalcolate", () => {
    const parsed = parseRecipeText(recipeShareText(risotto, 6));
    expect(parsed.servings).toBe(6);
    expect(parsed.ingredients.map(({ text }) => parseIngredientLine(text).quantity)).toEqual([480, 4.5, 0.75, 0.75, 1.5, null, null]);
  });
});

describe("recipesShareText", () => {
  it("mette le ricette una dopo l'altra, ognuna con le sue porzioni", () => {
    const text = recipesShareText([risotto, tiramisu]);
    expect(text).toBe(`${recipeShareText(risotto)}\n\n──────────\n\n${recipeShareText(tiramisu)}`);
    expect(text).toContain("Primo · 4 persone");
    expect(text).toContain("Dolce · 8 persone");
  });
});

describe("shareableRecipe", () => {
  it("tiene solo i campi del messaggio", () => {
    const fromDatabase = {
      ...risotto,
      id: "ricetta1",
      familyId: "famiglia1",
      ingredients: risotto.ingredients.map((ingredient, position) => ({ ...ingredient, id: `i${position}`, position })),
      steps: risotto.steps.map((entry, position) => ({ ...entry, id: `s${position}`, position })),
    };
    expect(shareableRecipe(fromDatabase)).toEqual(risotto);
  });
});

describe("collegamenti", () => {
  it("compone l'oggetto con i titoli", () => {
    expect(shareSubject([risotto])).toBe("Risotto alle zucchine");
    expect(shareSubject([risotto, tiramisu])).toBe("Risotto alle zucchine, Tiramisù");
  });

  it("codifica il messaggio per WhatsApp", () => {
    expect(whatsappHref("Tiramisù\n• Uova 4 & caffè")).toBe("https://wa.me/?text=Tiramis%C3%B9%0A%E2%80%A2%20Uova%204%20%26%20caff%C3%A8");
  });

  it("manda gli a capo dell'email come CRLF", () => {
    expect(mailtoHref("Tiramisù", "Riga uno\nRiga due")).toBe("mailto:?subject=Tiramis%C3%B9&body=Riga%20uno%0D%0ARiga%20due");
  });
});
