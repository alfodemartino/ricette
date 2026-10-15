import { prisma } from "@/lib/db";
import type { CheckedSite } from "@/lib/import/site-check";
import { BUILT_IN_SITES, splitBuiltInSites, type RecipeSiteConfig } from "@/lib/import/sites";

/**
 * I siti di «Cosa cucino con…»: quelli dell'app più quelli che la famiglia ha
 * aggiunto. Come le ricette, i siti sono della famiglia: ogni lettura e ogni
 * modifica filtra per `familyId`, e un sito di un'altra famiglia per chi lo
 * chiede non esiste.
 *
 * Un sito si può spegnere, e allora resta nell'elenco ma la ricerca non lo usa
 * (`Family.disabledSites`), oppure togliere: quello aggiunto si cancella,
 * quello dell'app finisce fra i tolti (`Family.hiddenSites`), da cui si rimette.
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

/** I siti dell'app tolti e i siti spenti della famiglia, per id. */
async function sitePreferences(familyId: string): Promise<{ hidden: string[]; disabled: string[] }> {
  const family = await prisma.family.findUnique({ where: { id: familyId }, select: { hiddenSites: true, disabledSites: true } });
  return { hidden: family?.hiddenSites ?? [], disabled: family?.disabledSites ?? [] };
}

/** Un sito come lo mostra la pagina «Siti per la ricerca». */
export type SiteListItem = {
  id: string;
  name: string;
  host: string;
  builtIn: boolean;
  /** Spento: resta nell'elenco, ma la ricerca non lo usa. */
  enabled: boolean;
  /** Per i siti aggiunti dalla famiglia: chi e quando. */
  addedBy: string | null;
  addedAt: Date | null;
};

/** I siti della pagina «Siti per la ricerca»: in elenco (accesi o spenti) e tolti. */
export type SitesOverview = { active: SiteListItem[]; removed: SiteListItem[]; familyCount: number };

export async function familySitesOverview(familyId: string): Promise<SitesOverview> {
  const [rows, { hidden, disabled }] = await Promise.all([
    prisma.recipeSite.findMany({ where: { familyId }, orderBy: { createdAt: "asc" }, select: SITE_SELECT }),
    sitePreferences(familyId),
  ]);
  const off = new Set(disabled);
  const builtIn = splitBuiltInSites(hidden);
  const app = (site: RecipeSiteConfig): SiteListItem => ({
    id: site.id,
    name: site.name,
    host: site.host,
    builtIn: true,
    enabled: !off.has(site.id),
    addedBy: null,
    addedAt: null,
  });
  return {
    active: [
      ...builtIn.active.map(app),
      ...rows.map((row) => ({
        id: row.id,
        name: row.name,
        host: row.host,
        builtIn: false,
        enabled: !off.has(row.id),
        addedBy: row.createdBy?.name ?? null,
        addedAt: row.createdAt,
      })),
    ],
    removed: builtIn.removed.map(app),
    familyCount: rows.length,
  };
}

/** I siti aggiunti dalla famiglia, accesi o spenti. */
export async function listFamilySites(familyId: string): Promise<RecipeSiteConfig[]> {
  const rows = await prisma.recipeSite.findMany({ where: { familyId }, orderBy: { createdAt: "asc" }, select: SITE_SELECT });
  return rows.map(toConfig);
}

/** I siti in cui la famiglia cerca: prima quelli dell'app non tolti, poi i suoi; mai quelli spenti. */
export async function listSearchSites(familyId: string): Promise<RecipeSiteConfig[]> {
  const [rows, { hidden, disabled }] = await Promise.all([listFamilySites(familyId), sitePreferences(familyId)]);
  return [...splitBuiltInSites(hidden).active, ...rows].filter((site) => !disabled.includes(site.id));
}

/** Un sito in cui la famiglia può cercare, o `null` (anche se l'ha tolto o spento). */
export async function findSearchSite(familyId: string, siteId: string): Promise<RecipeSiteConfig | null> {
  const { hidden, disabled } = await sitePreferences(familyId);
  if (disabled.includes(siteId)) return null;
  const builtIn = BUILT_IN_SITES.find((site) => site.id === siteId);
  if (builtIn) return hidden.includes(siteId) ? null : builtIn;
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
 * Accende o spegne un sito in elenco. `null` se il sito non c'è (o è tolto):
 * si accende e si spegne solo quello che si vede.
 */
export async function setSiteEnabled(familyId: string, siteId: string, enabled: boolean): Promise<{ host: string } | null> {
  const { hidden, disabled } = await sitePreferences(familyId);
  const builtIn = BUILT_IN_SITES.find((site) => site.id === siteId);
  const site = builtIn
    ? hidden.includes(siteId)
      ? null
      : builtIn
    : await prisma.recipeSite.findFirst({ where: { id: siteId, familyId }, select: { host: true } });
  if (!site) return null;
  const next = enabled ? disabled.filter((id) => id !== siteId) : [...new Set([...disabled, siteId])];
  await prisma.family.update({ where: { id: familyId }, data: { disabledSites: next } });
  return { host: site.host };
}

/**
 * Toglie un sito: quello aggiunto dalla famiglia si cancella, quello dell'app
 * finisce fra i tolti. In entrambi i casi smette di essere spento: un sito
 * dell'app rimesso torna acceso. `null` se il sito non c'era (o era già tolto).
 */
export async function removeSearchSite(familyId: string, siteId: string): Promise<{ host: string; builtIn: boolean } | null> {
  const { hidden, disabled } = await sitePreferences(familyId);
  const disabledSites = disabled.filter((id) => id !== siteId);
  const builtIn = BUILT_IN_SITES.find((site) => site.id === siteId);
  if (builtIn) {
    if (hidden.includes(siteId)) return null;
    await prisma.family.update({ where: { id: familyId }, data: { hiddenSites: [...hidden, siteId], disabledSites } });
    return { host: builtIn.host, builtIn: true };
  }
  const site = await prisma.recipeSite.findFirst({ where: { id: siteId, familyId }, select: { id: true, host: true } });
  if (!site) return null;
  await prisma.$transaction([
    prisma.recipeSite.deleteMany({ where: { id: site.id, familyId } }),
    prisma.family.update({ where: { id: familyId }, data: { disabledSites } }),
  ]);
  return { host: site.host, builtIn: false };
}

/** Rimette un sito dell'app che la famiglia aveva tolto; `null` se non era tolto. */
export async function restoreBuiltInSite(familyId: string, siteId: string): Promise<{ host: string } | null> {
  const builtIn = BUILT_IN_SITES.find((site) => site.id === siteId);
  const { hidden } = await sitePreferences(familyId);
  if (!builtIn || !hidden.includes(siteId)) return null;
  await prisma.family.update({ where: { id: familyId }, data: { hiddenSites: hidden.filter((id) => id !== siteId) } });
  return { host: builtIn.host };
}
