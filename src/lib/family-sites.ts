import { prisma } from "@/lib/db";
import type { CheckedSite } from "@/lib/import/site-check";
import { BUILT_IN_SITES, splitBuiltInSites, type RecipeSiteConfig } from "@/lib/import/sites";

/**
 * I siti di «Cosa cucino con…»: quelli dell'app più quelli che la famiglia ha
 * aggiunto. Come le ricette, i siti sono della famiglia: ogni lettura e ogni
 * modifica filtra per `familyId`, e un sito di un'altra famiglia per chi lo
 * chiede non esiste.
 *
 * Togliere un sito aggiunto lo cancella; togliere un sito dell'app lo mette fra
 * quelli tolti (`Family.hiddenSites`), da cui si rimette con un tocco.
 */

/** Quanti siti può aggiungere una famiglia: ognuno sono altre pagine da scaricare a ogni ricerca. */
export const MAX_FAMILY_SITES = 10;

const SITE_SELECT = {
  id: true,
  name: true,
  host: true,
  kind: true,
  searchUrl: true,
  linkSelector: true,
  linkPrefix: true,
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
};

function toConfig(row: SiteRow): RecipeSiteConfig {
  const { id, name, host, kind, searchUrl, linkSelector, linkPrefix } = row;
  return { id, name, host, kind, searchUrl, linkSelector, linkPrefix, builtIn: false };
}

async function hiddenSites(familyId: string): Promise<string[]> {
  const family = await prisma.family.findUnique({ where: { id: familyId }, select: { hiddenSites: true } });
  return family?.hiddenSites ?? [];
}

/** Un sito come lo mostra la pagina «Siti per la ricerca». */
export type SiteListItem = {
  id: string;
  name: string;
  host: string;
  builtIn: boolean;
  /** Per i siti aggiunti dalla famiglia: chi e quando. */
  addedBy: string | null;
  addedAt: Date | null;
};

/** I siti della pagina «Siti per la ricerca»: in uso e tolti. */
export type SitesOverview = { active: SiteListItem[]; removed: SiteListItem[]; familyCount: number };

export async function familySitesOverview(familyId: string): Promise<SitesOverview> {
  const [rows, hidden] = await Promise.all([
    prisma.recipeSite.findMany({ where: { familyId }, orderBy: { createdAt: "asc" }, select: SITE_SELECT }),
    hiddenSites(familyId),
  ]);
  const builtIn = splitBuiltInSites(hidden);
  const app = (site: RecipeSiteConfig): SiteListItem => ({ id: site.id, name: site.name, host: site.host, builtIn: true, addedBy: null, addedAt: null });
  return {
    active: [
      ...builtIn.active.map(app),
      ...rows.map((row) => ({
        id: row.id,
        name: row.name,
        host: row.host,
        builtIn: false,
        addedBy: row.createdBy?.name ?? null,
        addedAt: row.createdAt,
      })),
    ],
    removed: builtIn.removed.map(app),
    familyCount: rows.length,
  };
}

/** I siti aggiunti dalla famiglia. */
export async function listFamilySites(familyId: string): Promise<RecipeSiteConfig[]> {
  const rows = await prisma.recipeSite.findMany({ where: { familyId }, orderBy: { createdAt: "asc" }, select: SITE_SELECT });
  return rows.map(toConfig);
}

/** I siti in cui la famiglia cerca: prima quelli dell'app che non ha tolto, poi i suoi. */
export async function listSearchSites(familyId: string): Promise<RecipeSiteConfig[]> {
  const [rows, hidden] = await Promise.all([listFamilySites(familyId), hiddenSites(familyId)]);
  return [...splitBuiltInSites(hidden).active, ...rows];
}

/** Un sito in cui la famiglia può cercare, o `null` (anche se l'ha tolto). */
export async function findSearchSite(familyId: string, siteId: string): Promise<RecipeSiteConfig | null> {
  const builtIn = BUILT_IN_SITES.find((site) => site.id === siteId);
  if (builtIn) return (await hiddenSites(familyId)).includes(siteId) ? null : builtIn;
  const row = await prisma.recipeSite.findFirst({ where: { id: siteId, familyId }, select: SITE_SELECT });
  return row ? toConfig(row) : null;
}

export async function addFamilySite(familyId: string, userId: string, site: CheckedSite) {
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
    },
    select: { id: true, name: true },
  });
}

/**
 * Toglie un sito: quello aggiunto dalla famiglia si cancella, quello dell'app
 * finisce fra i tolti. `null` se il sito non c'era (o era già tolto).
 */
export async function removeSearchSite(familyId: string, siteId: string): Promise<{ host: string; builtIn: boolean } | null> {
  const builtIn = BUILT_IN_SITES.find((site) => site.id === siteId);
  if (builtIn) {
    const hidden = await hiddenSites(familyId);
    if (hidden.includes(siteId)) return null;
    await prisma.family.update({ where: { id: familyId }, data: { hiddenSites: [...hidden, siteId] } });
    return { host: builtIn.host, builtIn: true };
  }
  const site = await prisma.recipeSite.findFirst({ where: { id: siteId, familyId }, select: { id: true, host: true } });
  if (!site) return null;
  await prisma.recipeSite.deleteMany({ where: { id: site.id, familyId } });
  return { host: site.host, builtIn: false };
}

/** Rimette un sito dell'app che la famiglia aveva tolto; `null` se non era tolto. */
export async function restoreBuiltInSite(familyId: string, siteId: string): Promise<{ host: string } | null> {
  const builtIn = BUILT_IN_SITES.find((site) => site.id === siteId);
  const hidden = await hiddenSites(familyId);
  if (!builtIn || !hidden.includes(siteId)) return null;
  await prisma.family.update({ where: { id: familyId }, data: { hiddenSites: hidden.filter((id) => id !== siteId) } });
  return { host: builtIn.host };
}
