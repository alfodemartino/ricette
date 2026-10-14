import { describe, expect, it } from "vitest";
import {
  convertibleUnits,
  convertQuantity,
  factorForAmount,
  factorForPeople,
  factorForQuantity,
  formatPeople,
  formatQuantity,
  isOriginalScale,
  normalizeUnit,
  parseAmount,
  parseIngredientLine,
  parseIngredientList,
  parseQuantity,
  peopleFor,
  quantityInput,
  scaleQuantity,
  stepPeople,
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
  it("ricalcola in proporzione alle persone", () => {
    expect(scaleQuantity(300, factorForPeople(4, 2))).toBe(150);
    expect(scaleQuantity(2, factorForPeople(4, 6))).toBe(3);
  });

  it("lascia stare le quantità senza numero di porzioni", () => {
    expect(factorForPeople(null, 2)).toBe(1);
    expect(scaleQuantity(300, factorForPeople(null, 2))).toBe(300);
    expect(scaleQuantity(null, 2)).toBeNull();
  });

  it("ricalcola tutto dalla quantità di un ingrediente", () => {
    // Ho 300 g di farina invece di 500: tutto il resto ×0,6.
    const factor = factorForQuantity(500, 300);
    expect(factor).toBeCloseTo(0.6);
    expect(formatQuantity(scaleQuantity(500, factor!), "g")).toBe("300");
    expect(formatQuantity(scaleQuantity(3, factor!), null)).toBe("1,8");
    expect(formatQuantity(scaleQuantity(250, factor!), "ml")).toBe("150");
    expect(peopleFor(4, factor!)).toBe(2.4);
  });

  it("ricalcola da una quantità scritta in un'altra unità", () => {
    // Patate segnate «1 kg», ne ho 600 g: ×0,6, non ×600.
    expect(factorForAmount(1, "kg", 600, "g")).toBeCloseTo(0.6);
    expect(factorForAmount(500, "g", 1, "kg")).toBeCloseTo(2);
    expect(factorForAmount(1, "l", 250, "ml")).toBeCloseTo(0.25);
    expect(factorForAmount(5, "dl", 1, "l")).toBeCloseTo(2);
    expect(factorForAmount(3, null, 2, null)).toBeCloseTo(2 / 3);
    expect(factorForAmount(2, "cucchiaio", 1, "cucchiaio")).toBeCloseTo(0.5);
  });

  it("non converte fra unità di gruppi diversi o senza misura fissa", () => {
    expect(factorForAmount(1, "kg", 600, "ml")).toBeNull();
    expect(factorForAmount(2, "cucchiaio", 10, "g")).toBeNull();
    expect(factorForAmount(3, null, 200, "g")).toBeNull();
    expect(convertQuantity(600, "g", "kg")).toBeCloseTo(0.6);
    expect(convertQuantity(null, "g", "kg")).toBeNull();
  });

  it("propone le unità in cui si può scrivere la quantità", () => {
    expect(convertibleUnits("kg")).toEqual(["g", "kg"]);
    expect(convertibleUnits("g")).toEqual(["g", "kg"]);
    expect(convertibleUnits("ml")).toEqual(["ml", "l"]);
    expect(convertibleUnits("dl")).toEqual(["ml", "dl", "l"]);
    expect(convertibleUnits("cucchiaio")).toEqual(["cucchiaio"]);
    expect(convertibleUnits(null)).toEqual([null]);
  });

  it.each([
    ["600", { quantity: 600, unit: null }],
    ["600 g", { quantity: 600, unit: "g" }],
    ["600g", { quantity: 600, unit: "g" }],
    ["0,6 kg", { quantity: 0.6, unit: "kg" }],
    ["1½", { quantity: 1.5, unit: null }],
    ["2 cucchiai", { quantity: 2, unit: "cucchiaio" }],
    ["1 gr.", { quantity: 1, unit: "g" }],
  ])("legge «%s» nella casella della quantità", (raw, expected) => {
    expect(parseAmount(raw)).toEqual(expected);
  });

  it("non legge una quantità con un'unità sconosciuta", () => {
    expect(parseAmount("600 pezzettoni")).toBeNull();
    expect(parseAmount("tanto")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("non ricava un fattore da quantità mancanti o nulle", () => {
    expect(factorForQuantity(null, 300)).toBeNull();
    expect(factorForQuantity(500, null)).toBeNull();
    expect(factorForQuantity(0, 300)).toBeNull();
    expect(factorForQuantity(500, 0)).toBeNull();
    expect(factorForQuantity(500, -1)).toBeNull();
  });

  it("riconosce la ricetta com'è scritta", () => {
    expect(isOriginalScale(1)).toBe(true);
    expect(isOriginalScale(factorForQuantity(3, 3)!)).toBe(true);
    expect(isOriginalScale(0.6 * (1 / 0.6))).toBe(true);
    expect(isOriginalScale(1.5)).toBe(false);
  });

  it("dice le persone solo se la ricetta le indica", () => {
    expect(peopleFor(4, 1.5)).toBe(6);
    expect(peopleFor(null, 1.5)).toBeNull();
    expect(formatPeople(6)).toBe("6");
    expect(formatPeople(2.4)).toBe("2,4");
  });

  it("dalle persone con la virgola, meno e più vanno all'intero vicino", () => {
    expect(stepPeople(2.4, -1)).toBe(2);
    expect(stepPeople(2.4, 1)).toBe(3);
    expect(stepPeople(4, -1)).toBe(3);
    expect(stepPeople(4, 1)).toBe(5);
    expect(stepPeople(1, -1)).toBe(1);
    expect(stepPeople(0.6, 1)).toBe(1);
    expect(stepPeople(99, 1)).toBe(99);
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
