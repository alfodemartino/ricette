import * as cheerio from "cheerio";

/**
 * Testo semplice da un frammento che può contenere HTML ed entità («&egrave;»,
 * «<p>Mescolate</p>»): è come arrivano molti campi dei dati strutturati.
 */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = /[<&]/.test(value) ? cheerio.load(`<div>${value}</div>`)("div").first().text() : value;
  return text.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

/** Come `cleanText`, ma su una riga sola. */
export function cleanLine(value: unknown): string {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

const BLOCKS = "p, div, li, h1, h2, h3, h4, h5, h6, tr, section, article, blockquote, dt, dd";

/**
 * Il testo leggibile di una pagina, un blocco per riga. Si tolgono script,
 * stili, menu e piè di pagina; se la pagina ha un `<article>` o un `<main>` si
 * guarda solo quello, che di solito è la ricetta senza il contorno.
 */
export function pageText($: cheerio.CheerioAPI): string {
  const root = $("article").first().length ? $("article").first() : $("main").first().length ? $("main").first() : $("body");
  const copy = cheerio.load(root.html() ?? "");
  copy("script, style, noscript, nav, header, footer, aside, form, iframe, svg, button").remove();
  copy("br").replaceWith("\n");
  copy(BLOCKS).each((_, element) => {
    copy(element).append("\n");
  });
  return cleanText(copy.root().text()).replace(/\n{3,}/g, "\n\n");
}

/** Un indirizzo relativo trasformato in assoluto rispetto alla pagina. */
export function absoluteUrl(value: unknown, base: URL): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** I link `http(s)` scritti dentro un testo, nell'ordine in cui compaiono. */
export function linksInText(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  return [...new Set(found.map((link) => link.replace(/[.,;:!?]+$/, "")))];
}
