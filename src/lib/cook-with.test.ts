import { describe, expect, it } from "vitest";
import {
  amountHint,
  ingredientWords,
  isStaple,
  limitingAmount,
  matchesIngredient,
  matchRecipe,
  MAX_WANTED,
  parseWanted,
  peopleWith,
  rankMatches,
  shortIngredientName,
  wantedText,
  type RecipeIngredientLike,
} from "./cook-with";

function wanted(text: string) {
  const [item] = parseWanted(text);
  return item;
}

describe("parseWanted", () => {
  it("separa per virgole e a capo e legge le quantità", () => {
    const items = parseWanted("300 g zucchine, ricotta\nmenta; 2 uova");
    expect(items.map(({ name, quantity, unit }) => ({ name, quantity, unit }))).toEqual([
      { name: "Zucchine", quantity: 300, unit: "g" },
      { name: "Ricotta", quantity: null, unit: null },
      { name: "Menta", quantity: null, unit: null },
      { name: "Uova", quantity: 2, unit: null },
    ]);
  });

  it("legge anche la quantità in coda", () => {
    expect(wanted("zucchine 300 g")).toMatchObject({ name: "Zucchine", quantity: 300, unit: "g" });
  });

  it("conta i doppioni una volta sola, anche al singolare", () => {
    expect(parseWanted("zucchine, zucchina, Zucchine").map((item) => item.name)).toEqual(["Zucchine"]);
  });

  it("si ferma a un numero ragionevole di ingredienti", () => {
    const many = Array.from({ length: 20 }, (_, index) => `ingrediente${"abcdefghijklmnopqrst"[index]}`).join(", ");
    expect(parseWanted(many)).toHaveLength(MAX_WANTED);
  });

  it("ignora le voci vuote", () => {
    expect(parseWanted(" , ,\n")).toEqual([]);
  });

  it("toglie gli aggettivi che le ricette non ripetono", () => {
    expect(wanted("parmigiano grattugiato").words).toEqual(["parmigian"]);
    expect(wanted("prosciutto cotto").words).toEqual(["prosciutt", "cott"]);
  });

  it("rifà il testo per la ricerca", () => {
    expect(wantedText(parseWanted("300 g Zucchine, ricotta"))).toBe("zucchine, ricotta");
  });
});

describe("matchesIngredient", () => {
  it("riconosce singolare e plurale", () => {
    expect(matchesIngredient(wanted("zucchina"), "Zucchine")).toBe(true);
    expect(matchesIngredient(wanted("uovo"), "Uova medie")).toBe(true);
    expect(matchesIngredient(wanted("cipolle"), "Cipolla dorata")).toBe(true);
    expect(matchesIngredient(wanted("funghi"), "Fungo champignon")).toBe(true);
  });

  it("accetta i diminutivi ma non le parole che cominciano allo stesso modo", () => {
    expect(matchesIngredient(wanted("pomodoro"), "Pomodorini ciliegino")).toBe(true);
    expect(matchesIngredient(wanted("latte"), "Lattuga")).toBe(false);
    expect(matchesIngredient(wanted("olio"), "Olive taggiasche")).toBe(false);
    expect(matchesIngredient(wanted("riso"), "Risotto avanzato")).toBe(false);
    expect(matchesIngredient(wanted("pasta"), "Pastella")).toBe(false);
  });

  it("vuole tutte le parole di ciò che si ha", () => {
    expect(matchesIngredient(wanted("farina"), "Farina 00")).toBe(true);
    expect(matchesIngredient(wanted("farina di mandorle"), "Farina 00")).toBe(false);
    expect(matchesIngredient(wanted("prosciutto cotto"), "Prosciutto crudo")).toBe(false);
    expect(matchesIngredient(wanted("parmigiano grattugiato"), "Parmigiano Reggiano DOP")).toBe(true);
  });

  it("ignora accenti e apostrofi", () => {
    expect(ingredientWords("Olio extravergine d'oliva")).toEqual(["oli", "extravergin", "oliv"]);
    expect(matchesIngredient(wanted("caffe"), "Caffè espresso")).toBe(true);
  });
});

describe("isStaple", () => {
  it("riconosce sale, pepe, olio e acqua dalla prima parola", () => {
    expect(["Sale fino", "Pepe nero", "Olio extravergine d'oliva", "Acqua"].every(isStaple)).toBe(true);
    expect(["Salame", "Peperoni", "Salsa di pomodoro"].some(isStaple)).toBe(false);
  });
});

const PASTA = [
  { id: "a", name: "Pasta corta", quantity: 320, unit: "g" },
  { id: "b", name: "Zucchine", quantity: 600, unit: "g" },
  { id: "c", name: "Ricotta vaccina", quantity: 250, unit: "g" },
  { id: "d", name: "Sale fino", quantity: null, unit: null },
  { id: "e", name: "Olio extravergine d'oliva", quantity: 20, unit: "g" },
];

describe("matchRecipe", () => {
  it("abbina ciò che si ha e dice cosa manca e cosa serve in più", () => {
    const match = matchRecipe(parseWanted("zucchina, ricotta, menta, olio"), PASTA);
    expect(match.matched.map((pair) => pair.ingredient.id)).toEqual(["b", "c", "e"]);
    expect(match.missing.map((item) => item.name)).toEqual(["Menta"]);
    expect(match.alsoNeeded).toEqual(["Pasta corta"]);
  });

  it("non conta sale e olio fra quello che manca", () => {
    const match = matchRecipe(parseWanted("ricotta, sale, pepe"), [{ name: "Ricotta", quantity: null, unit: null }]);
    expect(match.missing).toEqual([]);
  });
});

describe("shortIngredientName", () => {
  it("toglie quantità e istruzioni rimaste nel nome", () => {
    expect(shortIngredientName("patate 1,2 kg peso da sbucciate")).toBe("patate");
    expect(shortIngredientName("mozzarella 200 g a cubetti")).toBe("mozzarella");
    expect(shortIngredientName("concentrato di pomodoro 1 cucchiaio oppure passata")).toBe("concentrato di pomodoro");
    expect(shortIngredientName("timo o maggiorana freschi")).toBe("timo");
    expect(shortIngredientName("Pasta corta")).toBe("Pasta corta");
    expect(shortIngredientName("circa")).toBeNull();
    expect(shortIngredientName("la scorza di 1/2 limone")).toBe("la scorza");
  });
});

describe("rankMatches", () => {
  const recipes = [
    { title: "Pasta zucchine e ricotta", ingredients: PASTA },
    {
      title: "Frittata di zucchine",
      ingredients: [
        { name: "Uova", quantity: 4, unit: null },
        { name: "Zucchine", quantity: 2, unit: null },
      ],
    },
    {
      title: "Torta salata",
      ingredients: [
        { name: "Pasta sfoglia", quantity: 1, unit: "rotolo" },
        { name: "Zucchine", quantity: 300, unit: "g" },
        { name: "Ricotta", quantity: 250, unit: "g" },
        { name: "Uova", quantity: 2, unit: null },
        { name: "Parmigiano", quantity: 50, unit: "g" },
      ],
    },
    { title: "Tiramisù", ingredients: [{ name: "Mascarpone", quantity: 500, unit: "g" }] },
  ];

  function rank(text: string) {
    const items = parseWanted(text);
    const ranked = rankMatches(
      recipes.map((recipe) => ({ title: recipe.title, match: matchRecipe<RecipeIngredientLike>(items, recipe.ingredients) })),
      items,
    );
    return { all: ranked.all.map((item) => item.title), almost: ranked.almost.map((item) => item.title) };
  }

  it("mette prima le ricette con tutto, poi quelle a cui manca uno", () => {
    expect(rank("zucchine, ricotta")).toEqual({
      all: ["Pasta zucchine e ricotta", "Torta salata"],
      almost: ["Frittata di zucchine"],
    });
  });

  it("con un ingrediente solo non c'è il gruppo «ne manca uno»", () => {
    expect(rank("mascarpone")).toEqual({ all: ["Tiramisù"], almost: [] });
  });

  it("solo sale e olio non bastano a cercare", () => {
    expect(rank("sale, olio")).toEqual({ all: [], almost: [] });
  });

  it("una ricetta che ha solo le basi in comune non conta", () => {
    // La pasta ha in comune solo l'olio: resta fuori.
    expect(rank("olio, mascarpone, uova").almost).toEqual(["Tiramisù", "Frittata di zucchine", "Torta salata"]);
  });
});

describe("limitingAmount", () => {
  it("sceglie l'ingrediente che finisce per primo, anche in un'altra unità", () => {
    const match = matchRecipe(parseWanted("300 g zucchine, 1 kg ricotta"), PASTA);
    const limiting = limitingAmount(match);
    expect(limiting?.ingredient.id).toBe("b");
    expect(limiting?.factor).toBeCloseTo(0.5);
    expect(peopleWith(4, limiting)).toBe(2);
  });

  it("converte chili e grammi", () => {
    const match = matchRecipe(parseWanted("0,3 kg zucchine"), PASTA);
    expect(limitingAmount(match)?.factor).toBeCloseTo(0.5);
  });

  it("non indovina quando le unità non si convertono", () => {
    const match = matchRecipe(parseWanted("2 zucchine, ricotta"), PASTA);
    expect(limitingAmount(match)).toBeNull();
    expect(peopleWith(4, null)).toBeNull();
  });

  it("lo dice in una frase, in persone solo quando sono persone", () => {
    const half = limitingAmount(matchRecipe(parseWanted("300 g zucchine"), PASTA));
    const double = limitingAmount(matchRecipe(parseWanted("1,2 kg zucchine"), PASTA));
    const tiny = limitingAmount(matchRecipe(parseWanted("50 g zucchine"), PASTA));
    expect(amountHint(4, half)).toBe("Basta per circa 2 persone");
    expect(amountHint(2, half)).toBe("Basta per circa 1 persona");
    expect(amountHint(1, half)).toBe("Basta per meno di una persona");
    // 24 frittelle non sono 24 persone.
    expect(amountHint(24, half)).toBe("Basta per circa metà ricetta");
    expect(amountHint(null, double)).toBe("Basta per circa 2 volte la ricetta");
    expect(amountHint(null, tiny)).toBe("Basta per poco della ricetta");
    expect(amountHint(4, null)).toBeNull();
  });

  it("senza porzioni non dice per quante persone", () => {
    const match = matchRecipe(parseWanted("300 g zucchine"), PASTA);
    expect(peopleWith(null, limitingAmount(match))).toBeNull();
  });
});
