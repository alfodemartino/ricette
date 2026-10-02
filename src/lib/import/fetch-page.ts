import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import zlib from "node:zlib";
import { ImportError, isPrivateAddress, parseImportUrl } from "@/lib/import/url";

/**
 * Scaricamento delle pagine e delle immagini da importare.
 *
 * Si usano `http`/`https` di Node e non `fetch` perché qui serve una cosa che
 * `fetch` non permette: decidere a quale IP collegarsi. Il controllo sta nella
 * funzione `lookup` della connessione, quindi vale per l'indirizzo con cui la
 * connessione si apre davvero — anche dopo un redirect, anche se il DNS di un
 * dominio pubblico risponde con un IP della rete di casa.
 */

export type FetchedResponse = {
  /** L'indirizzo finale, dopo gli eventuali redirect. */
  url: URL;
  contentType: string;
  body: Buffer;
};

export type FetchOptions = {
  accept: string;
  maxBytes: number;
  headers?: Record<string, string>;
};

export type Fetcher = (url: URL, options: FetchOptions) => Promise<FetchedResponse>;

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

/**
 * Molti siti rispondono in modo diverso (o non rispondono) a un client che non
 * si presenta come un browser. L'intestazione è quella di un Chrome qualunque.
 */
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as LookupAddress[];
    const allowed = list.filter((entry) => !isPrivateAddress(entry.address));
    if (allowed.length === 0 || allowed.length !== list.length) {
      const blocked = new ImportError("Questo indirizzo non è raggiungibile dall'app.", "indirizzo_privato");
      return callback(blocked, "", 0);
    }
    if (options.all) {
      (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, allowed);
    } else {
      callback(null, allowed[0].address, allowed[0].family);
    }
  });
};

function decompress(stream: http.IncomingMessage): NodeJS.ReadableStream {
  const encoding = String(stream.headers["content-encoding"] ?? "").toLowerCase();
  if (encoding === "gzip" || encoding === "x-gzip") return stream.pipe(zlib.createGunzip());
  if (encoding === "deflate") return stream.pipe(zlib.createInflate());
  if (encoding === "br") return stream.pipe(zlib.createBrotliDecompress());
  return stream;
}

function requestOnce(url: URL, options: FetchOptions): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: options.accept,
          "Accept-Language": "it-IT,it;q=0.9,en;q=0.6",
          "Accept-Encoding": "gzip, deflate, br",
          ...options.headers,
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentType = String(response.headers["content-type"] ?? "");
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          resolve({ status, location: response.headers.location, contentType, body: Buffer.alloc(0) });
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          // 401, 403 e 429 sono quasi sempre un sito che respinge i programmi
          // (protezioni anti-bot, login obbligatorio): conviene dirlo chiaro.
          const message =
            status === 401 || status === 403 || status === 429
              ? "Il sito non permette di leggere la pagina in automatico. Inserisci la ricetta a mano: con «Incolla elenco» e «Incolla testo» fai in fretta."
              : status === 404 || status === 410
                ? "La pagina non esiste (più): controlla il link."
                : `La pagina ha risposto con un errore (${status}).`;
          reject(new ImportError(message, `http_${status}`));
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        const body = decompress(response);
        body.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            request.destroy(new ImportError("Il contenuto è troppo grande da importare.", "troppo_grande"));
            return;
          }
          chunks.push(chunk);
        });
        body.on("end", () => resolve({ status, contentType, body: Buffer.concat(chunks) }));
        body.on("error", reject);
      },
    );

    request.setTimeout(TIMEOUT_MS, () => {
      request.destroy(new ImportError("La pagina non ha risposto in tempo.", "timeout"));
    });
    request.on("error", (error) => {
      if (error instanceof ImportError) reject(error);
      else reject(new ImportError("Non sono riuscito a raggiungere la pagina.", `rete_${(error as NodeJS.ErrnoException).code ?? "errore"}`));
    });
    request.end();
  });
}

/** Scarica un indirizzo seguendo i redirect, ognuno ricontrollato da capo. */
export const safeFetch: Fetcher = async (start, options) => {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await requestOnce(url, options);
    if (!response.location) {
      return { url, contentType: response.contentType, body: response.body };
    }
    url = parseImportUrl(new URL(response.location, url).href);
  }
  throw new ImportError("La pagina rimanda ad altre pagine troppe volte.", "troppi_redirect");
};

/**
 * Il testo di una pagina HTML. Il set di caratteri si prende dall'intestazione
 * HTTP o, se manca, dal `<meta charset>`; in mancanza di entrambi, UTF-8.
 */
export function decodeBody(response: Pick<FetchedResponse, "contentType" | "body">): string {
  const fromHeader = response.contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = response.body.subarray(0, 2048).toString("latin1");
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  const charset = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset).decode(response.body);
  } catch {
    return new TextDecoder("utf-8").decode(response.body);
  }
}
