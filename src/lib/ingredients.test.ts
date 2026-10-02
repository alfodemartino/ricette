import { describe, expect, it } from "vitest";
import {
  formatQuantity,
  normalizeUnit,
  parseIngredientLine,
  parseIngredientList,
  parseQuantity,
  quantityInput,
  scaleQuantity,
  unitLabel,
} from "./ingredients";

describe("parseQuantity", () => {
  it.each([
    ["200", 200],
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["1/2", 0.5],
    ["1 1/2", 1.5],
    ["½", 0.5],
    ["1½", 1.5],
    ["2-3", 2],
    ["2 o 3", 2],
    ["1.000", 1000],
  ])("legge «%s»", (raw, expected) => {
    expect(parseQuantity(raw)).toBeCloseTo(expected);
  });

  it("restituisce null per ciò che non è una quantità", () => {
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("tanto")).toBeNull();
    expect(parseQuantity("1/0")).toBeNull();
    expect(parseQuantity(null)).toBeNull();
  });
});

describe("parseIngredientLine", () => {
  it.each([
    ["200 g di farina 00", { quantity: 200, unit: "g", name: "Farina 00", note: null }],
    ["200g farina", { quantity: 200, unit: "g", name: "Farina", note: null }],
    ["Farina 00 200 g", { quantity: 200, unit: "g", name: "Farina 00", note: null }],
    ["Spaghetti 320 g", { quantity: 320, unit: "g", name: "Spaghetti", note: null }],
    ["2 uova", { quantity: 2, unit: null, name: "Uova", note: null }],
    ["Uova 3", { quantity: 3, unit: null, name: "Uova", note: null }],
    ["½ cucchiaino di sale", { quantity: 0.5, unit: "cucchiaino", name: "Sale", note: null }],
    ["2 cucchiai di zucchero", { quantity: 2, unit: "cucchiaio", name: "Zucchero", note: null }],
    ["2 spicchi d'aglio", { quantity: 2, unit: "spicchio", name: "Aglio", note: null }],
    ["1 l di latte intero", { quantity: 1, unit: "l", name: "Latte intero", note: null }],
    ["1,5 kg di patate", { quantity: 1.5, unit: "kg", name: "Patate", note: null }],
    ["Sale fino q.b.", { quantity: null, unit: null, name: "Sale fino", note: "q.b." }],
    ["pepe nero a piacere", { quantity: null, unit: null, name: "Pepe nero", note: "q.b." }],
    ["- 3 uova (a temperatura ambiente)", { quantity: 3, unit: null, name: "Uova", note: "a temperatura ambiente" }],
    ["• 100 ml di panna fresca", { quantity: 100, unit: "ml", name: "Panna fresca", note: null }],
    ["3 noci", { quantity: 3, unit: null, name: "Noci", note: null }],
    ["1 noce di burro", { quantity: 1, unit: "noce", name: "Burro", note: null }],
    ["200 gamberi", { quantity: 200, unit: null, name: "Gamberi", note: null }],
    ["Sedano 1 costa", { quantity: 1, unit: "costa", name: "Sedano", note: null }],
    ["1 rotolo di pasta sfoglia", { quantity: 1, unit: "rotolo", name: "Pasta sfoglia", note: null }],
    ["3 fogli di gelatina", { quantity: 3, unit: "foglio", name: "Gelatina", note: null }],
  ])("legge «%s»", (raw, expected) => {
    expect(parseIngredientLine(raw)).toEqual(expected);
  });

  it("non perde il testo quando non riconosce niente", () => {
    expect(parseIngredientLine("buccia grattugiata di un limone")).toEqual({
      quantity: null,
      unit: null,
      name: "Buccia grattugiata di un limone",
      note: null,
    });
  });
});

describe("parseIngredientList", () => {
  it("divide in sezioni e salta l'intestazione dell'elenco", () => {
    const list = parseIngredientList(
      ["Ingredienti per 4 persone:", "", "Per la base:", "200 g di biscotti", "80 g di burro", "Per la crema", "250 g di mascarpone"].join("\n"),
    );

    expect(list.map((item) => [item.section, item.name])).toEqual([
      ["Per la base", "Biscotti"],
      ["Per la base", "Burro"],
      ["Per la crema", "Mascarpone"],
    ]);
  });
});

describe("unità", () => {
  it("normalizza le varianti", () => {
    expect(normalizeUnit("gr")).toBe("g");
    expect(normalizeUnit("Cucchiai")).toBe("cucchiaio");
    expect(normalizeUnit("litri")).toBe("l");
    expect(normalizeUnit("boh")).toBeNull();
  });

  it("usa il plurale oltre l'unità", () => {
    expect(unitLabel("cucchiaio", 1)).toBe("cucchiaio");
    expect(unitLabel("cucchiaio", 2)).toBe("cucchiai");
    expect(unitLabel("cucchiaio", 1.5)).toBe("cucchiai");
    expect(unitLabel("g", 300)).toBe("g");
    expect(unitLabel("vaschetta", 2)).toBe("vaschette");
    expect(unitLabel("mazzolino", 2)).toBe("mazzolino");
  });
});

describe("porzioni", () => {
  it("ricalcola in proporzione", () => {
    expect(scaleQuantity(300, 4, 2)).toBe(150);
    expect(scaleQuantity(2, 4, 6)).toBe(3);
  });

  it("lascia stare le quantità senza numero di porzioni", () => {
    expect(scaleQuantity(300, null, 2)).toBe(300);
    expect(scaleQuantity(null, 4, 2)).toBeNull();
  });
});

describe("formatQuantity", () => {
  it.each([
    [333.333, "g", "335"],
    [52.4, "g", "52"],
    [7.25, "g", "7,3"],
    [1.25, "kg", "1,25"],
    [1.5, null, "1½"],
    [0.5, "cucchiaino", "½"],
    [0.333, null, "⅓"],
    [2, null, "2"],
    [2.98, null, "3"],
    [0.1, null, "0,1"],
    [12.4, null, "12"],
  ])("%s %s → %s", (quantity, unit, expected) => {
    expect(formatQuantity(quantity, unit)).toBe(expected);
  });

  it("non mostra niente senza quantità", () => {
    expect(formatQuantity(null)).toBe("");
  });

  it("riporta nel form la quantità con la virgola", () => {
    expect(quantityInput(1.5)).toBe("1,5");
    expect(quantityInput(200)).toBe("200");
    expect(quantityInput(null)).toBe("");
  });
});
