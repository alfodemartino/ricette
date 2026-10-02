/**
 * I dati di un video YouTube presi dalla sua pagina: titolo e descrizione
 * stanno nell'oggetto `ytInitialPlayerResponse`, scritto dentro uno script.
 * Non serve una chiave per le API di Google.
 */

export type YouTubeDetails = { title: string; description: string };

/**
 * L'oggetto JSON che comincia subito dopo `marker`. Si cerca la graffa di
 * chiusura contando quelle aperte e saltando le stringhe: un'espressione
 * regolare si fermerebbe alla prima «};» dentro una descrizione.
 */
export function extractJsonAfter(html: string, marker: string): unknown {
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const open = html.indexOf("{", start + marker.length);
  if (open === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = open; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(open, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function extractYouTubeDetails(html: string): YouTubeDetails | null {
  const data = extractJsonAfter(html, "ytInitialPlayerResponse") as {
    videoDetails?: { title?: unknown; shortDescription?: unknown };
  } | null;
  const details = data?.videoDetails;
  if (!details || typeof details.title !== "string") return null;
  return {
    title: details.title,
    description: typeof details.shortDescription === "string" ? details.shortDescription : "",
  };
}

/** La miniatura che YouTube garantisce per ogni video. */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Il cookie che salta la pagina del consenso: dall'Europa, senza, YouTube
 * risponde con un rimando a consent.youtube.com invece che con il video.
 */
export const YOUTUBE_CONSENT_COOKIE = "SOCS=CAI; CONSENT=YES+1";
