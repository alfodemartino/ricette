import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Fetcher } from "./fetch-page";
import { importRecipe } from "./index";
import { isComplete, type ImportedRecipe, type RecipeEnhancer } from "./types";
import { ImportError } from "./url";

function fixture(name: string): Buffer {
  return readFileSync(path.join(import.meta.dirname, "__fixtures__", name));
}

/** Un finto scaricatore: ogni indirizzo risponde con la sua pagina di prova. */
function fakeFetcher(pages: Record<string, string>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url.href);
    const name = pages[url.href];
    if (!name) throw new ImportError("Non trovata", "http_404");
    return { url, contentType: "text/html; charset=utf-8", body: fixture(name) };
  };
  return Object.assign(fetcher, { calls });
}

describe("importRecipe — dati strutturati", () => {
  it("legge una ricetta schema.org semplice", async () => {
    const url = "https://ricette.esempio.it/pasta-e-patate";
    const recipe = await importRecipe(url, { fetcher: fakeFetcher({ [url]: "jsonld-semplice.html" }) });

    expect(recipe).toMatchObject({
      title: "Pasta e patate",
      description: "Un primo della tradizione napoletana, cremoso e saporito.",
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 40,
      category: "Primi piatti",
      imageUrl: "https://cdn.esempio.it/pasta-patate.jpg",
      sourceUrl: url,
      sourceKind: "SITO",
      method: "dati-strutturati",
    });
    expect(recipe.ingredients.map((item) => item.text)).toEqual([
      "Pasta mista 320 g",
      "Patate 600 g",
      "Provola affumicata 150 g",
      "Sedano 1 costa",
      "Sale fino q.b.",
    ]);
    expect(recipe.steps.map((step) => step.text)).toEqual([
      "Sbucciate le patate e tagliatele a cubetti.",
      "Fate soffriggere il sedano, unite le patate e coprite d'acqua.",
      "Aggiungete la pasta e, a fine cottura, la provola.",
    ]);
  });

  it("trova la ricetta dentro @graph, con sezioni e JSON scritto male", async () => {
    const url = "https://ricette.esempio.it/tiramisu";
    const recipe = await importRecipe(url, { fetcher: fakeFetcher({ [url]: "jsonld-graph.html" }) });

    expect(recipe.title).toBe("Tiramisù classico");
    expect(recipe.description).toBe("Il dolce al cucchiaio più amato.");
    expect(recipe.servings).toBe(8);
    expect(recipe.prepMinutes).toBe(40);
    expect(recipe.imageUrl).toBe("https://cdn.esempio.it/tiramisu-16x9.jpg");
    expect(recipe.steps).toEqual([
      { section: "La crema", text: "Montate i tuorli con metà dello zucchero." },
      { section: "La crema", text: "Unite il mascarpone poco alla volta." },
      { section: "Il montaggio", text: "Bagnate i savoiardi nel caffè e alternateli alla crema." },
    ]);
  });

  it("divide ingredienti e procedimento scritti in un testo unico", async () => {
    const url = "https://ricette.esempio.it/frittata";
    const recipe = await importRecipe(url, { fetcher: fakeFetcher({ [url]: "jsonld-testo-unico.html" }) });

    expect(recipe.servings).toBe(2);
    expect(recipe.ingredients).toHaveLength(3);
    expect(recipe.steps.map((step) => step.text)).toEqual([
      "Sbattete le uova con il parmigiano.",
      "Unite le zucchine a rondelle.",
      "Cuocete in padella cinque minuti per lato.",
    ]);
  });
});

describe("importRecipe — video e social", () => {
  it("legge la ricetta dalla descrizione di un video YouTube", async () => {
    const fetcher = fakeFetcher({ "https://www.youtube.com/watch?v=abcDEF12345": "youtube.html" });
    const recipe = await importRecipe("https://youtu.be/abcDEF12345", { fetcher });

    expect(recipe.title).toBe("SPAGHETTI AGLIO E OLIO perfetti in 10 minuti");
    expect(recipe.sourceKind).toBe("VIDEO");
    expect(recipe.sourceUrl).toBe("https://youtu.be/abcDEF12345");
    expect(recipe.imageUrl).toBe("https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg");
    expect(recipe.servings).toBe(2);
    expect(recipe.ingredients).toHaveLength(4);
    expect(recipe.steps).toHaveLength(3);
    expect(recipe.method).toBe("testo");
    expect(recipe.rawText).toContain("Iscriviti al canale");
  });

  it("segue il link alla ricetta scritto nella descrizione", async () => {
    const fetcher = fakeFetcher({
      "https://www.youtube.com/watch?v=abcDEF12345": "youtube-con-link.html",
      "https://ricette.esempio.it/pasta-e-patate": "jsonld-semplice.html",
    });
    const recipe = await importRecipe("https://www.youtube.com/watch?v=abcDEF12345", { fetcher });

    expect(isComplete(recipe)).toBe(true);
    expect(recipe.title).toBe("Pasta e patate");
    expect(recipe.sourceKind).toBe("VIDEO");
    expect(recipe.sourceUrl).toBe("https://www.youtube.com/watch?v=abcDEF12345");
    expect(recipe.method).toBe("dati-strutturati");
  });

  it("da Instagram usa la didascalia dell'anteprima", async () => {
    const url = "https://www.instagram.com/reel/ABC123/";
    const recipe = await importRecipe(url, { fetcher: fakeFetcher({ [url]: "instagram.html" }) });

    expect(recipe.sourceKind).toBe("VIDEO");
    expect(recipe.imageUrl).toBe("https://scontent.esempio.net/post.jpg");
    expect(recipe.ingredients.map((item) => item.text)).toEqual(["300 g di macinato", "1 uovo", "50 g di pangrattato"]);
    expect(recipe.steps).toHaveLength(2);
  });
});

describe("importRecipe — pagine senza dati strutturati", () => {
  it("cerca ingredienti e procedimento nel testo dell'articolo", async () => {
    const url = "https://blog.esempio.it/torta-di-mele";
    const recipe = await importRecipe(url, { fetcher: fakeFetcher({ [url]: "blog-senza-dati.html" }) });

    expect(recipe.title).toBe("La torta di mele della nonna | Blog di prova");
    expect(recipe.method).toBe("testo");
    expect(recipe.ingredients.map((item) => item.text)).toEqual([
      "250 g di farina 00",
      "150 g di zucchero",
      "3 uova",
      "2 mele",
      "1 bustina di lievito",
    ]);
    expect(recipe.steps).toHaveLength(3);
  });
});

describe("importRecipe — estensioni", () => {
  it("chiama gli estrattori aggiuntivi attivi solo se la ricetta è incompleta", async () => {
    const url = "https://www.instagram.com/p/XYZ/";
    const seen: ImportedRecipe[] = [];
    const enhancer: RecipeEnhancer = {
      name: "finto",
      enabled: () => true,
      async enhance(recipe) {
        seen.push(recipe);
        return { ...recipe, steps: [{ section: null, text: "Passo aggiunto" }] };
      },
    };
    const disabled: RecipeEnhancer = { name: "spento", enabled: () => false, enhance: async () => { throw new Error("non deve partire"); } };

    const fetcher = fakeFetcher({ [url]: "instagram.html" });
    const complete = await importRecipe(url, { fetcher, enhancers: [disabled, enhancer] });
    // La didascalia è già completa: nessuno viene chiamato.
    expect(seen).toHaveLength(0);
    expect(complete.steps).toHaveLength(2);

    // Il link nella descrizione non risponde: la ricetta resta parziale e
    // passa all'estrattore attivo, con il testo grezzo da cui ripartire.
    const partial = await importRecipe("https://youtu.be/abcDEF12345", {
      fetcher: fakeFetcher({ "https://www.youtube.com/watch?v=abcDEF12345": "youtube-con-link.html" }),
      enhancers: [disabled, enhancer],
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].rawText).toContain("La ricetta completa");
    expect(partial.steps).toEqual([{ section: null, text: "Passo aggiunto" }]);
  });
});

describe("importRecipe — errori", () => {
  it("rifiuta gli indirizzi della rete locale prima di scaricare", async () => {
    const fetcher = fakeFetcher({});
    await expect(importRecipe("http://192.168.1.1/admin", { fetcher })).rejects.toMatchObject({ reason: "indirizzo_privato" });
    expect(fetcher.calls).toEqual([]);
  });

  it("propaga l'errore della pagina che non risponde", async () => {
    await expect(importRecipe("https://ricette.esempio.it/non-esiste", { fetcher: fakeFetcher({}) })).rejects.toBeInstanceOf(ImportError);
  });
});
