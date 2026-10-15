import { beforeEach, describe, expect, it } from "vitest";
import { checkSite, commonPrefix, siteTitle } from "./site-check";
import { clearSiteCache } from "./sites";
import { fakeFetcher } from "./__fixtures__/fake-fetcher";
import type { Fetcher } from "./fetch-page";
import { ImportError } from "./url";

const HOME = {
  body: '<html><head><meta property="og:site_name" content="Il blog di prova"><title>Home - Il blog di prova</title></head></html>',
};

const WORDPRESS_SEARCH = "https://www.blogdiprova.it/wp-json/wp/v2/search?search=zucchine&per_page=10&type=post";
const RECIPES = {
  "https://www.blogdiprova.it/ricetta/pasta-zucchine-e-ricotta/": "ricetta-zucchine-ricotta.html",
  "https://www.blogdiprova.it/ricetta/frittata-di-zucchine/": "ricetta-frittata.html",
};

beforeEach(() => clearSiteCache());

describe("checkSite", () => {
  it("accetta un sito WordPress con le ricette schema.org", async () => {
    const fetcher = fakeFetcher({
      "https://www.blogdiprova.it/": HOME,
      "https://www.blogdiprova.it/robots.txt": { body: "User-agent: *\nDisallow: /*?s=\n", type: "text/plain" },
      [WORDPRESS_SEARCH]: "ricerca-wordpress.json",
      ...RECIPES,
    });

    expect(await checkSite("https://www.blogdiprova.it/ricetta/qualcosa/", { fetcher })).toEqual({
      ok: true,
      site: {
        name: "Il blog di prova",
        host: "www.blogdiprova.it",
        kind: "WORDPRESS",
        searchUrl: "https://www.blogdiprova.it/wp-json/wp/v2/search?search={q}&per_page=10&type=post",
        linkSelector: null,
        linkPrefix: "/ricetta/",
      },
      samples: ["Pasta zucchine e ricotta", "Frittata di zucchine"],
    });
  });

  it("senza API prova la ricerca classica, se il robots.txt la permette", async () => {
    const results = `<main><article><a href="/ricetta/pasta-zucchine-e-ricotta/">Pasta</a></article>
      <article><a href="https://www.blogdiprova.it/ricetta/frittata-di-zucchine/">Frittata</a></article></main>`;
    const fetcher = fakeFetcher({
      "https://www.blogdiprova.it/": HOME,
      "https://www.blogdiprova.it/?s=zucchine": { body: results },
      ...RECIPES,
    });

    const check = await checkSite("www.blogdiprova.it", { fetcher });
    expect(check).toMatchObject({ ok: true, site: { kind: "HTML", searchUrl: "https://www.blogdiprova.it/?s={q}", linkSelector: "article a" } });
  });

  it("rifiuta un sito che vieta la sua ricerca", async () => {
    const fetcher = fakeFetcher({
      "https://www.blogdiprova.it/": HOME,
      "https://www.blogdiprova.it/robots.txt": { body: "User-agent: *\nDisallow: /\n", type: "text/plain" },
    });
    expect(await checkSite("https://www.blogdiprova.it", { fetcher })).toMatchObject({ ok: false, reason: "robots_vieta" });
  });

  it("rifiuta un sito le cui ricette non hanno i dati schema.org", async () => {
    const fetcher = fakeFetcher({
      "https://www.blogdiprova.it/": HOME,
      [WORDPRESS_SEARCH]: "ricerca-wordpress.json",
      "https://www.blogdiprova.it/ricetta/pasta-zucchine-e-ricotta/": "blog-senza-dati.html",
    });
    expect(await checkSite("https://www.blogdiprova.it", { fetcher })).toMatchObject({ ok: false, reason: "niente_schema" });
  });

  it("rifiuta un sito senza una ricerca che si legga", async () => {
    const fetcher = fakeFetcher({ "https://www.blogdiprova.it/": HOME });
    expect(await checkSite("https://www.blogdiprova.it", { fetcher })).toMatchObject({ ok: false, reason: "nessuna_ricerca" });
  });

  it("dice quando il sito non risponde", async () => {
    expect(await checkSite("https://www.blogdiprova.it", { fetcher: fakeFetcher({}) })).toMatchObject({
      ok: false,
      reason: "irraggiungibile",
    });
  });

  it("dice quando il sito respinge i programmi", async () => {
    const fetcher: Fetcher = async () => {
      throw new ImportError("Il sito non permette di leggere la pagina in automatico.", "http_403");
    };
    expect(await checkSite("https://www.blogdiprova.it", { fetcher })).toMatchObject({ ok: false, reason: "sito_blocca" });
  });

  it("non va sulla rete di casa", async () => {
    expect(await checkSite("http://192.168.1.50", { fetcher: fakeFetcher({}) })).toMatchObject({ ok: false, reason: "indirizzo_privato" });
  });
});

describe("commonPrefix", () => {
  it("trova il percorso comune delle ricette", () => {
    expect(commonPrefix(["https://a.it/ricetta/uno/", "https://a.it/ricetta/due.htm"])).toBe("/ricetta/");
    expect(commonPrefix(["https://a.it/ricetta/uno/", "https://a.it/dolci/due/"])).toBeNull();
    expect(commonPrefix(["https://a.it/uno/", "https://a.it/due/"])).toBeNull();
  });
});

describe("siteTitle", () => {
  it("usa og:site_name o il titolo prima del trattino", () => {
    expect(siteTitle(HOME.body)).toBe("Il blog di prova");
    expect(siteTitle("<title>Ricette facili | Il blog</title>")).toBe("Ricette facili");
    expect(siteTitle("<p>niente</p>")).toBeNull();
  });
});
