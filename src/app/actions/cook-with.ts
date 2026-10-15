"use server";

import { Prisma } from "@prisma/client";
import { parseWanted } from "@/lib/cook-with";
import {
  addFamilySite,
  familySitesOverview,
  findSearchSite,
  listFamilySites,
  MAX_FAMILY_SITES,
  removeFamilySite,
  setSiteEnabled,
  type SitesOverview,
} from "@/lib/family-sites";
import { checkSite } from "@/lib/import/site-check";
import { findKnownSite, KNOWN_SITES, sameSite, searchSite, type RecipeSiteConfig, type WebMatch } from "@/lib/import/sites";
import { ImportError, parseImportUrl } from "@/lib/import/url";
import { logEvent } from "@/lib/log";
import { familySourceIndex, recipesFromSource } from "@/lib/recipes";
import { familyViewerOrNull } from "@/lib/session";

const EXPIRED = "La sessione è scaduta: ricarica la pagina.";

/** Un risultato del sito, con le ricette della famiglia che vengono già da lì. */
export type WebResult = WebMatch & { existing: { id: string; title: string }[] };

export type SiteSearchState =
  | { ok: true; all: WebResult[]; almost: WebResult[]; checked: number }
  | { ok: false; error: string };

/**
 * Cerca su un sito le ricette con gli ingredienti scritti. Il browser chiama
 * un sito alla volta, tutti insieme: i risultati compaiono man mano, e un sito
 * lento o che non risponde non trattiene gli altri. Non salva niente: da un
 * risultato si passa all'import, con il suo controllo dei doppioni.
 */
export async function searchSiteAction(siteId: string, text: string): Promise<SiteSearchState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { ok: false, error: EXPIRED };

  const site = await findSearchSite(viewer.familyId, String(siteId));
  if (!site) return { ok: false, error: "Questo sito non è più fra quelli accesi della famiglia." };

  try {
    const [result, sources] = await Promise.all([searchSite(site, parseWanted(String(text))), familySourceIndex(viewer.familyId)]);
    const withExisting = (match: WebMatch): WebResult => ({ ...match, existing: recipesFromSource(sources, [match.url]) });
    return { ok: true, all: result.all.map(withExisting), almost: result.almost.map(withExisting), checked: result.checked };
  } catch (error) {
    const reason = error instanceof ImportError ? error.reason : String(error).slice(0, 200);
    logEvent("warn", "ricerca_online_fallita", { sito: site.host, motivo: reason, utente: viewer.id });
    return { ok: false, error: error instanceof ImportError ? error.message : `${site.name} non ha risposto.` };
  }
}

/*
 * Le azioni sui siti restituiscono l'elenco aggiornato, che la pagina mostra
 * da sé: niente `revalidatePath`. Con la pagina da ricostruire dopo l'azione,
 * in produzione l'attesa del pulsante poteva non chiudersi più, anche a sito
 * già salvato. «Cosa cucino con…» è dinamica, e rilegge i siti a ogni visita.
 */

/** Il risultato di un'azione sui siti: l'elenco aggiornato, e cosa dire. */
export type SitesState = {
  sites?: SitesOverview;
  error?: string;
  /** Quello scritto nella casella, che resta quando il sito non va. */
  url?: string;
  /** Il sito aggiunto, con le ricette trovate per prova (nessuna per i siti già provati). */
  added?: { name: string; samples: string[] };
};

function hostOf(url: string): string {
  try {
    return parseImportUrl(url).hostname;
  } catch {
    return "";
  }
}

const FULL = `La famiglia ha già ${MAX_FAMILY_SITES} siti: togline uno prima di aggiungerne un altro.`;

/**
 * Aggiunge uno dei siti già provati, che non passa dalla verifica: la sua
 * configurazione è nel codice. Se la famiglia ce l'ha già, lo dice.
 */
async function addKnown(familyId: string, userId: string, known: RecipeSiteConfig, sites: RecipeSiteConfig[]): Promise<SitesState> {
  const same = sites.find((site) => sameSite(site.host, known.host));
  if (same) return { error: `${same.name} è già fra i siti della famiglia.` };
  try {
    await addFamilySite(familyId, userId, known, known.id);
  } catch (error) {
    // Due persone che aggiungono lo stesso sito nello stesso momento.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `${known.name} è già fra i siti della famiglia.`, sites: await familySitesOverview(familyId) };
    }
    throw error;
  }
  logEvent("warn", "sito_aggiunto", { sito: known.host, tipo: "gia_provato", famiglia: familyId, utente: userId });
  return { added: { name: known.name, samples: [] }, sites: await familySitesOverview(familyId) };
}

/** Aggiunge uno dei siti già provati, dall'elenco dei proposti. */
export async function addKnownSiteAction(catalogId: string): Promise<SitesState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: EXPIRED };
  const known = KNOWN_SITES.find((site) => site.id === String(catalogId));
  if (!known) return { sites: await familySitesOverview(viewer.familyId) };
  const sites = await listFamilySites(viewer.familyId);
  if (sites.length >= MAX_FAMILY_SITES) return { error: FULL };
  return addKnown(viewer.familyId, viewer.id, known, sites);
}

/**
 * Aggiunge un sito scritto nella casella. Se è uno dei già provati vale la
 * sua configurazione; altrimenti passa dalla verifica di `checkSite`. Tutti
 * i membri possono farlo, come per le ricette; ogni aggiunta e ogni rifiuto
 * finiscono nel log.
 */
export async function addSiteAction(raw: string): Promise<SitesState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: EXPIRED };

  const url = String(raw ?? "").trim().slice(0, 300);
  const sites = await listFamilySites(viewer.familyId);
  if (sites.length >= MAX_FAMILY_SITES) return { error: FULL, url };

  const known = findKnownSite(hostOf(url));
  if (known) {
    const result = await addKnown(viewer.familyId, viewer.id, known, sites);
    return result.error ? { ...result, url } : result;
  }

  const check = await checkSite(url);
  if (!check.ok) {
    logEvent("warn", "sito_rifiutato", { url, motivo: check.reason, utente: viewer.id });
    return { error: check.message, url };
  }

  const same = sites.find((site) => sameSite(site.host, check.site.host));
  if (same) return { error: `${same.name} è già fra i siti della famiglia.`, url };

  try {
    await addFamilySite(viewer.familyId, viewer.id, check.site);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `${check.site.name} è già fra i siti della famiglia.`, url };
    }
    throw error;
  }
  logEvent("warn", "sito_aggiunto", { sito: check.site.host, tipo: check.site.kind, famiglia: viewer.familyId, utente: viewer.id });
  return { added: { name: check.site.name, samples: check.samples }, sites: await familySitesOverview(viewer.familyId) };
}

/** Accende o spegne un sito: spento resta nell'elenco, ma la ricerca non lo usa. */
export async function setSiteEnabledAction(siteId: string, enabled: boolean): Promise<SitesState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: EXPIRED };
  const changed = await setSiteEnabled(viewer.familyId, String(siteId), enabled === true);
  if (changed) {
    logEvent("warn", enabled === true ? "sito_acceso" : "sito_spento", { sito: changed.host, famiglia: viewer.familyId, utente: viewer.id });
  }
  return { sites: await familySitesOverview(viewer.familyId) };
}

/** Toglie un sito: si cancella, e se è uno dei già provati torna fra i proposti. */
export async function removeSiteAction(siteId: string): Promise<SitesState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: EXPIRED };
  const removed = await removeFamilySite(viewer.familyId, String(siteId));
  if (removed) {
    logEvent("warn", "sito_rimosso", {
      sito: removed.host,
      tipo: removed.known ? "gia_provato" : "verificato",
      famiglia: viewer.familyId,
      utente: viewer.id,
    });
  }
  return { sites: await familySitesOverview(viewer.familyId) };
}
