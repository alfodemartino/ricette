import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, categoryLabel, guessCategory } from "./categories";

describe("categorie", () => {
  it("coincidono con l'enum RecipeCategory dello schema", () => {
    const schema = readFileSync(path.resolve(import.meta.dirname, "../../prisma/schema.prisma"), "utf8");
    const block = schema.match(/enum RecipeCategory \{([^}]*)\}/)?.[1] ?? "";
    const fromSchema = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[A-Z_]+$/.test(line));

    expect(fromSchema).toEqual(CATEGORY_IDS);
  });

  it("hanno un'etichetta in italiano", () => {
    expect(categoryLabel("PIATTO_UNICO")).toBe("Piatto unico");
  });
});

describe("guessCategory", () => {
  it.each([
    ["Primi piatti", "PRIMO"],
    ["Secondi piatti a base di carne", "SECONDO"],
    ["Dolci", "DOLCE"],
    ["Torte salate", "ANTIPASTO"],
    ["Torta al cioccolato", "DOLCE"],
    ["Antipasti", "ANTIPASTO"],
    ["Lievitati", "LIEVITATO"],
    ["Piatti unici", "PIATTO_UNICO"],
    ["Dessert", "DOLCE"],
    ["Contorni", "CONTORNO"],
    ["Salse e sughi", "SALSA"],
  ])("riconosce «%s»", (text, expected) => {
    expect(guessCategory(text)).toBe(expected);
  });

  it("non inventa una categoria quando non la riconosce", () => {
    expect(guessCategory("Ricette della nonna")).toBeNull();
    expect(guessCategory("")).toBeNull();
    expect(guessCategory(null)).toBeNull();
  });
});
