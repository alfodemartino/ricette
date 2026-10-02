import type { CheerioAPI } from "cheerio";
import { absoluteUrl, cleanLine, cleanText } from "@/lib/import/html";

/**
 * L'anteprima che ogni pagina dichiara per i social (Open Graph, Twitter):
 * titolo, descrizione e immagine. È quello che resta anche dalle piattaforme
 * che non mostrano altro senza un login, come Instagram e TikTok.
 */
export type PagePreview = { title: string; description: string; imageUrl: string | null };

function meta($: CheerioAPI, ...names: string[]): string {
  for (const name of names) {
    const value = $(`meta[property="${name}"], meta[name="${name}"]`).attr("content");
    if (value?.trim()) return value;
  }
  return "";
}

export function extractPreview($: CheerioAPI, pageUrl: URL): PagePreview {
  return {
    title: cleanLine(meta($, "og:title", "twitter:title") || $("title").first().text()),
    description: cleanText(meta($, "og:description", "twitter:description", "description")),
    imageUrl: absoluteUrl(meta($, "og:image", "og:image:url", "twitter:image"), pageUrl),
  };
}
