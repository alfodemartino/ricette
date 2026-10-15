import { prisma } from "@/lib/db";
import type { CheckedSite } from "@/lib/import/site-check";
import { KNOWN_SITES, knownSitesToSuggest, type RecipeSiteConfig } from "@/lib/import/sites";

/**
 * I siti di «Cosa cucino con…». Sono tutti della famiglia (tabella
 * `RecipeSite`), e una famiglia nuova parte senza: li aggiunge fra quelli già
 * provati (`KNOWN_SITES`) o scrivendo un indirizzo. Come le ricette, ogni
 * lettura e ogni modifica filtra per `familyId`, e un sito di un'altra
 * famiglia per chi lo chiede non esiste.
 *
 * Un sito spento (`enabled` falso) resta nell'elenco ma la ricerca lo salta;
 * un sito tolto si cancella, e quelli già provati tornano fra i proposti.
 */

/** Quanti siti può avere una famiglia: ognuno sono altre pagine da scaricare a ogni ricerca. */
export const MAX_FAMILY_SITES = 15;

const SITE_SELECT = {
  id: true,
  name: true,
  host: true,
  kind: true,
  searchUrl: true,
  linkSelector: true,
  linkPrefix: true,
  catalogId: true,
  enabled: true,
  createdAt: true,
  createdBy: { select: { name: true } },
} as const;

type SiteRow = {
  id: string;
  name: string;
  host: string;
  kind: "WORDPRESS" | "HTML";
  searchUrl: string;
  linkSelector: string | null;
  linkPrefix: string | null;
  catalogId: string | null;
};

/**
 * Come si cerca su un sito della famiglia. Per i siti già provati vale la
 * configurazione del catalogo, non quella copiata nella riga: una correzione
 * nel codice vale anche per i siti aggiunti prima.
 */
function toConfig(row: SiteRow): RecipeSiteConfig {
  const known = row.catalogId ? KNOWN_SITES.find((site) => site.id === row.catalogId) : undefined;
  const { name, host, kind, searchUrl, linkSelector, linkPrefix } = known ?? row;
  return { id: row.id, name, host, kind, searchUrl, linkSelector, linkPrefix };
}

function familyRows(familyId: string) {
  return prisma.recipeSite.findMany({ where: { familyId }, orderBy: { createdAt: "asc" }, select: SITE_SELECT });
}

/** Un sito come lo mostra la pagina «Siti per la ricerca». */
export type SiteListItem = {
  id: string;
  name: string;
  host: string;
  /** Spento: resta nell'elenco, ma la ricerca non lo usa. */
  enabled: boolean;
  addedBy: string | null;
  addedAt: Date;
};

/** I siti della pagina «Siti per la ricerca»: quelli della famiglia e i già provati da proporre. */
export type SitesOverview = {
  sites: SiteListItem[];
  suggestions: { id: string; name: string; host: string }[];
};

export async function familySitesOverview(familyId: string): Promise<SitesOverview> {
  const rows = await familyRows(familyId);
  return {
    sites: rows.map((row) => ({
      id: row.id,
      name: toConfig(row).name,
      host: row.host,
      enabled: row.enabled,
      addedBy: row.createdBy?.name ?? null,
      addedAt: row.createdAt,
    })),
    suggestions: knownSitesToSuggest(rows).map(({ id, name, host }) => ({ id, name, host })),
  };
}

/** I siti della famiglia, accesi o spenti, con come ci si cerca. */
export async function listFamilySites(familyId: string): Promise<RecipeSiteConfig[]> {
  return (await familyRows(familyId)).map(toConfig);
}

/** I siti in cui la famiglia cerca: solo quelli accesi. */
export async function listSearchSites(familyId: string): Promise<RecipeSiteConfig[]> {
  return (await familyRows(familyId)).filter((row) => row.enabled).map(toConfig);
}

/** Un sito acceso della famiglia, o `null`. */
export async function findSearchSite(familyId: string, siteId: string): Promise<RecipeSiteConfig | null> {
  const row = await prisma.recipeSite.findFirst({ where: { id: siteId, familyId, enabled: true }, select: SITE_SELECT });
  return row ? toConfig(row) : null;
}

/** Aggiunge un sito: verificato da `checkSite`, oppure uno dei già provati (`catalogId`). */
export async function addFamilySite(familyId: string, userId: string, site: CheckedSite, catalogId: string | null = null) {
  return prisma.recipeSite.create({
    data: {
      familyId,
      createdById: userId,
      name: site.name,
      host: site.host,
      kind: site.kind,
      searchUrl: site.searchUrl,
      linkSelector: site.linkSelector,
      linkPrefix: site.linkPrefix,
      catalogId,
    },
    select: { id: true, name: true },
  });
}

/** Accende o spegne un sito della famiglia; `null` se non c'è. */
export async function setSiteEnabled(familyId: string, siteId: string, enabled: boolean): Promise<{ host: string } | null> {
  const site = await prisma.recipeSite.findFirst({ where: { id: siteId, familyId }, select: { id: true, host: true } });
  if (!site) return null;
  await prisma.recipeSite.updateMany({ where: { id: site.id, familyId }, data: { enabled } });
  return { host: site.host };
}

/** Toglie un sito della famiglia (lo cancella); `null` se non c'era. */
export async function removeFamilySite(familyId: string, siteId: string): Promise<{ host: string; known: boolean } | null> {
  const site = await prisma.recipeSite.findFirst({ where: { id: siteId, familyId }, select: { id: true, host: true, catalogId: true } });
  if (!site) return null;
  await prisma.recipeSite.deleteMany({ where: { id: site.id, familyId } });
  return { host: site.host, known: site.catalogId !== null };
}
