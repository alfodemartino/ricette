import { beforeEach, describe, expect, it } from "vitest";
import { parseWanted } from "@/lib/cook-with";
import { fakeFetcher, fixture } from "./__fixtures__/fake-fetcher";
import { BUILT_IN_SITES, clearSiteCache, resultLinks, sameSite, searchSite, searchUrlFor, type RecipeSiteConfig } from "./sites";
import { ImportError } from "./url";

function site(id: string): RecipeSiteConfig {
  return BUILT_IN_SITES.find((entry) => entry.id === id)!;
}

const BLOG: RecipeSiteConfig = {
  id: "blog",
  name: "Il blog di prova",
  host: "www.blogdiprova.it",
  kind: "WORDPRESS",
  searchUrl: "https://www.blogdiprova.it/wp-json/wp/v2/search?search={q}&per_page=10&type=post",
  linkSelector: null,
  linkPrefix: "/ricetta/",
  builtIn: false,
};

beforeEach(() => clearSiteCache());

describe("searchUrlFor", () => {
  it("mette le parole dove le vuole il sito", () => {
    expect(searchUrlFor(site("giallozafferano"), ["zucchine", "ricotta"]).href).toBe(
      "https://www.giallozafferano.it/ricerca-ricette/zucchine+ricotta/",
    );
    expect(searchUrlFor(site("ricetteperbimby"), ["zucchine", "ricotta"]).href).toBe(
      "https://www.ricetteperbimby.it/ricerca/zucchine-ricotta",
    );
    expect(searchUrlFor(BLOG, ["zucchine", "caffè"]).href).toBe(
      "https://www.blogdiprova.it/wp-json/wp/v2/search?search=zucchine%20caff%C3%A8&per_page=10&type=post",
    );
  });
});

describe("sameSite", () => {
  it("accetta i sottodomini dello stesso sito", () => {
    expect(sameSite("ricette.giallozafferano.it", "www.giallozafferano.it")).toBe(true);
    expect(sameSite("www.misya.info", "misya.info")).toBe(true);
    expect(sameSite("www.altrosito.it", "www.giallozafferano.it")).toBe(false);
    expect(sameSite("giallozafferano.it.esempio.com", "giallozafferano.it")).toBe(false);
  });
});

describe("resultLinks", () => {
  it("prende solo i titoli dei risultati, sullo stesso sito e senza parametri", () => {
    const url = new URL("https://www.giallozafferano.it/ricerca-ricette/zucchine+ricotta/");
    expect(resultLinks(site("giallozafferano"), fixture("ricerca-giallozafferano.html").toString(), url)).toEqual([
      "https://ricette.giallozafferano.it/Pasta-zucchine-e-ricotta.html",
      "https://ricette.giallozafferano.it/Frittata-di-zucchine.html",
      "https://ricette.giallozafferano.it/Pasta-e-patate.html",
      "https://ricette.giallozafferano.it/Pagina-rotta.html",
    ]);
  });

  it("lascia fuori la colonna delle più viste e i tag", () => {
    const url = new URL("https://www.ricetteperbimby.it/ricerca/zucchine-ricotta");
    expect(resultLinks(site("ricetteperbimby"), fixture("ricerca-bimby.html").toString(), url)).toEqual([
      "https://www.ricetteperbimby.it/ricette/tortino-zucchine-e-ricotta-bimby",
      "https://www.ricetteperbimby.it/ricette/polpette-zucchine-ricotta-e-tonno",
    ]);
  });

  it("dall'API di WordPress tiene i link col percorso delle ricette", () => {
    const url = searchUrlFor(BLOG, ["zucchine"]);
    expect(resultLinks(BLOG, fixture("ricerca-wordpress.json").toString(), url)).toEqual([
      "https://www.blogdiprova.it/ricetta/pasta-zucchine-e-ricotta/",
      "https://www.blogdiprova.it/ricetta/frittata-di-zucchine/",
    ]);
  });

  it("una risposta che non è JSON non ha link", () => {
    expect(resultLinks(BLOG, "<html>errore</html>", searchUrlFor(BLOG, ["x"]))).toEqual([]);
  });
});

const GZ_PAGES = {
  "https://www.giallozafferano.it/ricerca-ricette/zucchine+ricotta/": "ricerca-giallozafferano.html",
  "https://ricette.giallozafferano.it/Pasta-zucchine-e-ricotta.html": "ricetta-zucchine-ricotta.html",
  "https://ricette.giallozafferano.it/Frittata-di-zucchine.html": "ricetta-frittata.html",
  "https://ricette.giallozafferano.it/Pasta-e-patate.html": "jsonld-semplice.html",
};

describe("searchSite", () => {
  it("tiene le ricette con tutto e quelle a cui manca uno, e salta le pagine rotte", async () => {
    const fetcher = fakeFetcher(GZ_PAGES);
    const result = await searchSite(site("giallozafferano"), parseWanted("300 g zucchine, ricotta"), { fetcher });

    expect(result.checked).toBe(3);
    expect(result.all).toEqual([
      {
        url: "https://ricette.giallozafferano.it/Pasta-zucchine-e-ricotta.html",
        title: "Pasta zucchine e ricotta",
        imageUrl: "https://cdn.esempio.it/pasta-zucchine.jpg",
        minutes: 25,
        missing: [],
        alsoNeeded: ["Pasta corta"],
        amount: "Basta per circa 2 persone",
      },
    ]);
    expect(result.almost.map((match) => [match.title, match.missing])).toEqual([["Frittata di zucchine", ["Ricotta"]]]);
  });

  it("non cerca sale e olio, e con molte parole riprova con le prime due", async () => {
    const fetcher = fakeFetcher({
      ...GZ_PAGES,
      "https://www.giallozafferano.it/ricerca-ricette/zucchine+ricotta+menta/": { body: "<main>Nessun risultato</main>" },
    });
    const result = await searchSite(site("giallozafferano"), parseWanted("zucchine, olio, ricotta, menta"), { fetcher });

    expect(fetcher.calls.slice(0, 2)).toEqual([
      "https://www.giallozafferano.it/ricerca-ricette/zucchine+ricotta+menta/",
      "https://www.giallozafferano.it/ricerca-ricette/zucchine+ricotta/",
    ]);
    expect(result.almost.map((match) => match.title)).toEqual(["Pasta zucchine e ricotta"]);
  });

  it("si ferma al numero di ricette chiesto", async () => {
    const fetcher = fakeFetcher(GZ_PAGES);
    await searchSite(site("giallozafferano"), parseWanted("zucchine, ricotta"), { fetcher, limit: 2 });
    expect(fetcher.calls).toHaveLength(3);
  });

  it("la seconda volta non riscarica niente", async () => {
    const fetcher = fakeFetcher(GZ_PAGES);
    await searchSite(site("giallozafferano"), parseWanted("zucchine, ricotta"), { fetcher });
    const first = fetcher.calls.length;
    const again = await searchSite(site("giallozafferano"), parseWanted("200 g zucchine, ricotta"), { fetcher });
    expect(fetcher.calls).toHaveLength(first);
    expect(again.all[0].amount).toBe("Basta per circa 1,3 persone");
  });

  it("se la ricerca non risponde lo dice con il nome del sito", async () => {
    const error = await searchSite(site("misya"), parseWanted("zucchine"), { fetcher: fakeFetcher({}) }).catch((caught) => caught);
    expect(error).toBeInstanceOf(ImportError);
    expect(error).toMatchObject({ message: "Misya non ha risposto.", reason: "ricerca_http_404" });
  });

  it("con solo sale e olio non scarica niente", async () => {
    const fetcher = fakeFetcher({});
    expect(await searchSite(site("misya"), parseWanted("sale, olio"), { fetcher })).toEqual({ all: [], almost: [], checked: 0 });
    expect(fetcher.calls).toEqual([]);
  });

  it("legge l'API di WordPress di un sito aggiunto", async () => {
    const fetcher = fakeFetcher({
      "https://www.blogdiprova.it/wp-json/wp/v2/search?search=zucchine&per_page=10&type=post": "ricerca-wordpress.json",
      "https://www.blogdiprova.it/ricetta/pasta-zucchine-e-ricotta/": "ricetta-zucchine-ricotta.html",
      "https://www.blogdiprova.it/ricetta/frittata-di-zucchine/": "ricetta-frittata.html",
    });
    const result = await searchSite(BLOG, parseWanted("zucchine"), { fetcher });
    expect(result.all.map((match) => match.title)).toEqual(["Frittata di zucchine", "Pasta zucchine e ricotta"]);
  });
});
