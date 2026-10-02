import { isIP } from "node:net";

/**
 * Indirizzi da importare: controllo del link scritto e degli IP a cui porta.
 *
 * L'app gira nella rete di casa, accanto al router, a finanze e ai database:
 * un link a `http://192.168.1.1` o a `http://localhost:5432` non deve
 * diventare un modo per interrogarli dal server. Per questo il controllo
 * guarda l'indirizzo IP effettivo, dopo la risoluzione del nome, e non solo
 * come è scritto il link.
 */

export class ImportError extends Error {
  constructor(
    message: string,
    /** Il motivo, breve e stabile, che finisce nei log. */
    readonly reason: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

/** Il link scritto dall'utente, ripulito e controllato. */
export function parseImportUrl(raw: string): URL {
  const text = raw.trim();
  if (!text) throw new ImportError("Incolla il link della ricetta.", "link_vuoto");

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new ImportError("Il link non è valido.", "link_non_valido");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ImportError("Si possono importare solo link http o https.", "protocollo");
  }
  if (url.username || url.password) {
    throw new ImportError("Il link non può contenere credenziali.", "credenziali_nel_link");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new ImportError("Il link usa una porta non consentita.", "porta");
  }
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new ImportError("Questo indirizzo non è raggiungibile dall'app.", "indirizzo_privato");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".lan") || host.endsWith(".internal") || host.endsWith(".home.arpa") || !host.includes(".")) {
    throw new ImportError("Questo indirizzo non è raggiungibile dall'app.", "indirizzo_privato");
  }
  url.hash = "";
  return url;
}

function ipv4ToNumber(address: string): number {
  return address.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

const PRIVATE_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function inV4Range(address: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((ipv4ToNumber(address) & mask) >>> 0) === ((ipv4ToNumber(base) & mask) >>> 0);
}

/**
 * Vero per ogni indirizzo che non sia internet pubblico: rete locale,
 * loopback, link-local, CGNAT, multicast, documentazione, e gli IPv6
 * equivalenti (compresi gli IPv4 «travestiti» da IPv6).
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return PRIVATE_V4.some(([base, bits]) => inV4Range(address, base, bits));
  if (version !== 6) return true;

  const lower = address.toLowerCase();
  const mapped = lower.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/) ?? lower.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  const hexMapped = lower.match(/^(?:0*:)*:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const high = parseInt(hexMapped[1], 16);
    const low = parseInt(hexMapped[2], 16);
    return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }

  if (lower === "::" || lower === "::1") return true;
  const firstGroup = parseInt(lower.split(":")[0] || "0", 16);
  if ((firstGroup & 0xfe00) === 0xfc00) return true; // fc00::/7, indirizzi unici locali
  if ((firstGroup & 0xffc0) === 0xfe80) return true; // fe80::/10, link-local
  if ((firstGroup & 0xff00) === 0xff00) return true; // multicast
  if (lower.startsWith("64:ff9b:")) return true; // NAT64, può puntare alla LAN
  if (lower.startsWith("2001:db8:") || lower.startsWith("2001:0db8:")) return true; // documentazione
  return false;
}

// ---------------------------------------------------------------------------
// Riconoscimento delle piattaforme
// ---------------------------------------------------------------------------

/** L'identificativo di un video YouTube, da qualunque forma di link. */
export function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      id = match?.[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "instagram.com", "tiktok.com", "facebook.com", "fb.watch", "vimeo.com"];

/** Vero per le piattaforme video e social: la ricetta si salva come «video». */
export function isVideoHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return VIDEO_HOSTS.some((video) => host === video || host.endsWith(`.${video}`));
}

// ---------------------------------------------------------------------------
// Stessa fonte
// ---------------------------------------------------------------------------

/** Parametri che dicono da dove si è arrivati, non quale pagina si apre. */
const TRACKING_PARAMS = /^(utm_.*|fbclid|gclid|dclid|msclkid|igsh|igshid|mc_cid|mc_eid|_ga|si|ref|ref_src|feature)$/i;

/**
 * Una chiave che vale uguale per due link alla stessa ricetta: senza
 * protocollo, `www.`, barra finale, ancora e parametri di tracciamento, e per
 * YouTube solo l'identificativo del video, da qualunque forma di link. Serve
 * ad avvisare quando si importa di nuovo una ricetta che c'è già. `null` se il
 * testo non è un link.
 */
export function sourceKey(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const videoId = youtubeVideoId(url);
  if (videoId) return `youtube:${videoId}`;

  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  const path = url.pathname.replace(/\/+$/, "");
  const params = [...url.searchParams]
    .filter(([name]) => !TRACKING_PARAMS.test(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  return `${host}${path}${params ? `?${params}` : ""}`;
}
