import { readFileSync } from "node:fs";
import path from "node:path";
import type { Fetcher } from "../fetch-page";
import { ImportError } from "../url";

/** Una pagina di prova di questa cartella. */
export function fixture(name: string): Buffer {
  return readFileSync(path.join(import.meta.dirname, name));
}

/**
 * Un finto scaricatore per i test: ogni indirizzo risponde con una pagina di
 * prova (il nome di un file di questa cartella) o con un testo scritto lì;
 * gli altri con un 404. `calls` ricorda cosa si è chiesto, nell'ordine.
 */
export function fakeFetcher(pages: Record<string, string | { body: string; type?: string }>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url.href);
    const page = pages[url.href];
    if (page === undefined) throw new ImportError("La pagina non esiste (più): controlla il link.", "http_404");
    if (typeof page === "object") return { url, contentType: page.type ?? "text/html; charset=utf-8", body: Buffer.from(page.body) };
    const type = page.endsWith(".json") ? "application/json; charset=utf-8" : "text/html; charset=utf-8";
    return { url, contentType: type, body: fixture(page) };
  };
  return Object.assign(fetcher, { calls });
}
