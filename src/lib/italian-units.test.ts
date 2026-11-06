import { describe, expect, it } from "vitest";
import { parseIngredientLine, type IngredientLine } from "./ingredients";
import { celsiusInText, toItalianUnits } from "./italian-units";

const converted = (text: string) => toItalianUnits(parseIngredientLine(text));

describe("toItalianUnits", () => {
  it("pesa le tazze degli ingredienti che si pesano, e dice quanto ha contato per tazza", () => {
    expect(converted("2 ½ cups all-purpose flour plus a little extra")).toEqual({
      quantity: 315,
      unit: "g",
      name: "All-purpose flour plus a little extra",
      note: "stima: 1 tazza = 125 g",
    });
    expect(converted("1 tazza di zucchero")).toMatchObject({ quantity: 200, unit: "g", name: "Zucchero" });
  });

  it("sceglie la voce più precisa della tabella", () => {
    expect(converted("1 cup almond flour").quantity).toBe(96);
    expect(converted("1 cup powdered sugar").quantity).toBe(120);
    expect(converted("1 cup peanut butter").quantity).toBe(260);
  });

  it("aggiunge la stima alla nota che c'è già", () => {
    expect(converted("1 cup butter (softened)").note).toBe("softened, stima: 1 tazza = 227 g");
  });

  it("porta a millilitri i liquidi e quello che non è in tabella", () => {
    expect(converted("1 cup milk")).toEqual({ quantity: 240, unit: "ml", name: "Milk", note: null });
    expect(converted("½ cup rice vinegar")).toMatchObject({ quantity: 120, unit: "ml" });
    expect(converted("¼ cup chopped walnuts")).toMatchObject({ quantity: 60, unit: "ml" });
    expect(converted("1 cup sugar snap peas")).toMatchObject({ quantity: 240, unit: "ml" });
  });

  it("converte once e libbre", () => {
    expect(converted("7 oz Cherry Tomatoes finely diced")).toEqual({
      quantity: 200,
      unit: "g",
      name: "Cherry Tomatoes finely diced",
      note: null,
    });
    expect(converted("1 lb ground beef")).toMatchObject({ quantity: 455, unit: "g" });
    expect(converted("8 fl oz cream")).toMatchObject({ quantity: 240, unit: "ml" });
    expect(converted("1 pint stock")).toMatchObject({ quantity: 475, unit: "ml" });
  });

  it("da mille in su passa a chili e litri", () => {
    expect(converted("3 lbs potatoes")).toMatchObject({ quantity: 1.35, unit: "kg" });
    expect(converted("5 cups water")).toMatchObject({ quantity: 1.2, unit: "l" });
  });

  it("recupera l'unità rimasta nel nome delle ricette già salvate", () => {
    const line: IngredientLine = { quantity: 7, unit: null, name: "Oz Cherry Tomatoes", note: null };
    expect(toItalianUnits(line)).toEqual({ quantity: 200, unit: "g", name: "Cherry Tomatoes", note: null });
  });

  it("lascia com'è quello che non serve convertire", () => {
    for (const text of ["200 g di farina", "2 uova", "1 tbsp olive oil", "1 tazzina di caffè", "Sale q.b.", "3 Noci"]) {
      const line = parseIngredientLine(text);
      expect(toItalianUnits(line)).toBe(line);
    }
  });

  it("non converte due volte", () => {
    const once = converted("2 cups flour");
    expect(toItalianUnits(once)).toBe(once);
  });
});

describe("celsiusInText", () => {
  it("converte i gradi Fahrenheit, a decine per il forno", () => {
    expect(celsiusInText("Preheat the oven to 350°F.")).toBe("Preheat the oven to 180 °C.");
    expect(celsiusInText("Bake at 425 degrees F for 20 minutes")).toBe("Bake at 220 °C for 20 minutes");
    expect(celsiusInText("Oven at 375 degrees Fahrenheit")).toBe("Oven at 190 °C");
    expect(celsiusInText("Heat to 400F")).toBe("Heat to 200 °C");
  });

  it("non arrotonda le temperature basse", () => {
    expect(celsiusInText("Chill to 40°F")).toBe("Chill to 4 °C");
  });

  it("converte gli intervalli", () => {
    expect(celsiusInText("Bake at 350-375°F")).toBe("Bake at 180-190 °C");
  });

  it("tiene i gradi Celsius che il sito ha già scritto", () => {
    expect(celsiusInText("Preheat to 400°F (200°C).")).toBe("Preheat to 200 °C.");
    expect(celsiusInText("Preheat to 400°F / 205°C.")).toBe("Preheat to 205 °C.");
    expect(celsiusInText("Forno a 200°C (400°F).")).toBe("Forno a 200 °C.");
  });

  it("lascia stare il resto", () => {
    for (const text of ["Cuocete a 180°C per 20 minuti.", "Aggiungete 100 g di farina.", "Use 2 cups, then 200 F.", "Mescolate."]) {
      expect(celsiusInText(text)).toBe(text);
    }
  });
});
