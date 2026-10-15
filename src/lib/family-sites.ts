import { prisma } from "@/lib/db";
import type { CheckedSite } from "@/lib/import/site-check";
import { BUILT_IN_SITES, type RecipeSiteConfig } from "@/lib/import/sites";

/**
 * I siti di «Cosa cucino con…»: quelli dell'app più quelli che la famiglia ha
 * aggiunto. Come le ricette, i siti aggiunti sono della famiglia: ogni lettura
 * e ogni modifica filtra per `familyId`, e un sito di un'altra famiglia per
 * chi lo chiede non esiste.
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

/** I siti aggiunti dalla famiglia, con chi li ha aggiunti e quando. */
export async function listFamilySites(familyId: string) {
  const rows = await prisma.recipeSite.findMany({ where: { familyId }, orderBy: { createdAt: "asc" }, select: SITE_SELECT });
  return rows.map((row) => ({ ...toConfig(row), createdAt: row.createdAt, createdBy: row.createdBy?.name ?? null }));
}

/** Tutti i siti in cui la famiglia può cercare: prima quelli dell'app, poi i suoi. */
export async function listSearchSites(familyId: string): Promise<RecipeSiteConfig[]> {
  const rows = await prisma.recipeSite.findMany({ where: { familyId }, orderBy: { createdAt: "asc" }, select: SITE_SELECT });
  return [...BUILT_IN_SITES, ...rows.map(toConfig)];
}

/** Un sito in cui la famiglia può cercare, o `null`. */
export async function findSearchSite(familyId: string, siteId: string): Promise<RecipeSiteConfig | null> {
  const builtIn = BUILT_IN_SITES.find((site) => site.id === siteId);
  if (builtIn) return builtIn;
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

/** Toglie un sito della famiglia; `null` se non c'era. */
export async function removeFamilySite(familyId: string, siteId: string) {
  const site = await prisma.recipeSite.findFirst({ where: { id: siteId, familyId }, select: { id: true, name: true, host: true } });
  if (!site) return null;
  await prisma.recipeSite.deleteMany({ where: { id: site.id, familyId } });
  return site;
}
