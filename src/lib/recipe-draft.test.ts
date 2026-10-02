import { describe, expect, it } from "vitest";
import type { ImportedRecipe } from "@/lib/import/types";
import { DraftError, draftFromImport, draftFromRecipe, draftToData, emptyDraft, type RecipeDraft } from "./recipe-draft";

function draft(overrides: Partial<RecipeDraft>): RecipeDraft {
  return { ...emptyDraft(), title: "Ricetta", ...overrides };
}

describe("draftToData", () => {
  it("assegna le sezioni alle righe che seguono l'intestazione", () => {
    const data = draftToData(
      draft({
        ingredients: [
          { kind: "item", quantity: "2", unit: "", name: "Uova", note: "" },
          { kind: "heading", title: "Per la crema" },
          { kind: "item", quantity: "1/2", unit: "l", name: "Latte", note: "intero" },
          { kind: "item", quantity: "", unit: "", name: "", note: "" },
        ],
        steps: [
          { kind: "heading", title: "La crema" },
          { kind: "item", text: "  Scaldate il latte.  " },
          { kind: "item", text: "" },
        ],
      }),
    );

    expect(data.ingredients).toEqual([
      { position: 0, section: null, quantity: 2, unit: null, name: "Uova", note: null },
      { position: 1, section: "Per la crema", quantity: 0.5, unit: "l", name: "Latte", note: "intero" },
    ]);
    expect(data.steps).toEqual([{ position: 0, section: "La crema", text: "Scaldate il latte." }]);
  });

  it("converte i numeri e tratta lo zero come «non indicato»", () => {
    const data = draftToData(draft({ servings: "4", prepMinutes: "0", cookMinutes: "" }));
    expect(data.servings).toBe(4);
    expect(data.prepMinutes).toBeNull();
    expect(data.cookMinutes).toBeNull();
  });

  it.each([
    [{ title: "  " }, "titolo"],
    [{ servings: "quattro" }, "Porzioni"],
    [{ ingredients: [{ kind: "item" as const, quantity: "tanto", unit: "", name: "Sale", note: "" }] }, "«tanto»"],
    [{ ingredients: [{ kind: "item" as const, quantity: "200", unit: "g", name: "", note: "" }] }, "nome"],
    [{ sourceUrl: "javascript:alert(1)" }, "http"],
  ])("rifiuta una bozza sbagliata (%o)", (overrides, message) => {
    expect(() => draftToData(draft(overrides))).toThrow(DraftError);
    expect(() => draftToData(draft(overrides))).toThrow(message);
  });

  it("toglie i tag doppi e senza link la fonte è manuale", () => {
    const data = draftToData(draft({ tags: ["Veloce", "veloce", "estivo"], sourceKind: "SITO", sourceUrl: "" }));
    expect(data.tags).toEqual(["veloce", "estivo"]);
    expect(data.sourceKind).toBe("MANUALE");
  });
});

describe("draftFromImport", () => {
  const imported: ImportedRecipe = {
    title: "Tiramisù",
    description: null,
    servings: 8,
    prepMinutes: 40,
    cookMinutes: null,
    category: "Dessert",
    keywords: [],
    ingredients: [
      { section: null, text: "Per la crema:" },
      { section: null, text: "500 g di mascarpone" },
      { section: null, text: "Per la base:" },
      { section: null, text: "Savoiardi 300 g" },
    ],
    steps: [{ section: "Montaggio", text: "Alternate savoiardi e crema." }],
    imageUrl: "https://cdn.esempio.it/t.jpg",
    sourceUrl: "https://ricette.esempio.it/tiramisu",
    resolvedUrl: null,
    sourceKind: "SITO",
    rawText: null,
    method: "dati-strutturati",
  };

  it("trasforma le righe-intestazione in sezioni e legge le quantità", () => {
    const result = draftFromImport(imported);

    expect(result.category).toBe("DOLCE");
    expect(result.servings).toBe("8");
    expect(result.importedImageUrl).toBe("https://cdn.esempio.it/t.jpg");
    expect(result.ingredients).toEqual([
      { kind: "heading", title: "Per la crema" },
      { kind: "item", quantity: "500", unit: "g", name: "Mascarpone", note: "" },
      { kind: "heading", title: "Per la base" },
      { kind: "item", quantity: "300", unit: "g", name: "Savoiardi", note: "" },
    ]);
    expect(result.steps).toEqual([
      { kind: "heading", title: "Montaggio" },
      { kind: "item", text: "Alternate savoiardi e crema." },
    ]);
  });

  it("propone il nome del sito come tag e lascia il titolo com'è", () => {
    const result = draftFromImport(imported);
    expect(result.tags).toEqual(["ricette.esempio.it"]);
    expect(result.title).toBe("Tiramisù");
  });

  it("per una ricetta Bimby propone il tag e sposta il Bimby in fondo al titolo", () => {
    const result = draftFromImport({ ...imported, title: "Tiramisù Bimby" });
    expect(result.tags).toEqual(["bimby", "ricette.esempio.it"]);
    expect(result.title).toBe("Tiramisù - Bimby");
  });

  it("una bozza importata e risalvata non perde niente", () => {
    const data = draftToData(draftFromImport(imported));
    const again = draftToData(
      draftFromRecipe({ ...data, tags: data.tags.map((name) => ({ name })) }),
    );
    expect(again).toEqual(data);
  });
});

describe("stepRowsFromText", () => {
  it("divide in passi e toglie la numerazione", async () => {
    const { stepRowsFromText } = await import("./recipe-draft");
    expect(
      stepRowsFromText("1. Scaldate il forno.\n\n2) Impastate.\nPer la glassa:\nPasso 3: Sciogliete lo zucchero."),
    ).toEqual([
      { kind: "item", text: "Scaldate il forno." },
      { kind: "item", text: "Impastate." },
      { kind: "heading", title: "Per la glassa" },
      { kind: "item", text: "Sciogliete lo zucchero." },
    ]);
  });
});
