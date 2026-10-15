import { describe, expect, it } from "vitest";
import { robotsAllows, robotsRules } from "./robots";

// Le regole di robots.txt veri, ridotte all'essenziale.
const STILE_GIALLOZAFFERANO = `
User-agent: *
Disallow: /ricerca/
Disallow: /ricerca-ricette/no-index/*/
Disallow: /ricerca-ricette/*?

User-agent: anthropic-ai
Disallow: /
`;

const STILE_WORDPRESS = `
# commento
User-agent: Googlebot
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /*?s=
Disallow: /search/

User-agent: AhrefsBot
Disallow: /
`;

describe("robotsAllows", () => {
  it("vieta e permette secondo il gruppo «*»", () => {
    expect(robotsAllows(STILE_GIALLOZAFFERANO, "/ricerca-ricette/zucchine+ricotta/")).toBe(true);
    expect(robotsAllows(STILE_GIALLOZAFFERANO, "/ricerca-ricette/zucchine/?pagina=2")).toBe(false);
    expect(robotsAllows(STILE_GIALLOZAFFERANO, "/ricerca/zucchine")).toBe(false);
  });

  it("non applica le regole degli altri programmi", () => {
    expect(robotsAllows(STILE_GIALLOZAFFERANO, "/")).toBe(true);
    expect(robotsAllows(STILE_WORDPRESS, "/ricetta/pasta/")).toBe(true);
  });

  it("riconosce `*` e la regola più lunga", () => {
    expect(robotsAllows(STILE_WORDPRESS, "/?s=pasta")).toBe(false);
    expect(robotsAllows(STILE_WORDPRESS, "/wp-json/wp/v2/search?search=pasta")).toBe(true);
    expect(robotsAllows(STILE_WORDPRESS, "/wp-admin/admin-ajax.php")).toBe(true);
    expect(robotsAllows(STILE_WORDPRESS, "/wp-admin/options.php")).toBe(false);
  });

  it("legge un gruppo con più User-agent", () => {
    expect(robotsRules(STILE_WORDPRESS)).toHaveLength(4);
  });

  it("riconosce `$` e il Disallow vuoto", () => {
    expect(robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/menu.pdf")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/menu.pdf?x=1")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow:", "/qualsiasi")).toBe(true);
  });

  it("senza robots.txt è tutto permesso", () => {
    expect(robotsAllows("", "/?s=pasta")).toBe(true);
  });

  it("un sito che vieta tutto", () => {
    expect(robotsAllows("User-agent: *\nDisallow: /", "/?s=pasta")).toBe(false);
  });
});
