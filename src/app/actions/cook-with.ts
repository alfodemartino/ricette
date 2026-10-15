"use server";

import { Prisma } from "@prisma/client";
import { parseWanted } from "@/lib/cook-with";
import {
  addFamilySite,
  familySitesOverview,
  findSearchSite,
  listFamilySites,
  MAX_FAMILY_SITES,
  removeSearchSite,
  restoreBuiltInSite,
  type SitesOverview,
} from "@/lib/family-sites";
import { checkSite } from "@/lib/import/site-check";
import { sameSite, searchSite, type WebMatch } from "@/lib/import/sites";
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
  if (!site) return { ok: false, error: "Questo sito non c'è più fra quelli della famiglia." };

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
  added?: { name: string; samples: string[] };
};

function hostOf(url: string): string {
  try {
    return parseImportUrl(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Aggiunge un sito per la famiglia, dopo la verifica di `checkSite`. Tutti i
 * membri possono farlo, come per le ricette; ogni aggiunta e ogni rifiuto
 * finiscono nel log.
 */
export async function addSiteAction(raw: string): Promise<SitesState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: EXPIRED };

  const url = String(raw ?? "").trim().slice(0, 300);
  const sites = await listFamilySites(viewer.familyId);
  if (sites.length >= MAX_FAMILY_SITES) {
    return { error: `La famiglia ha già ${MAX_FAMILY_SITES} siti: togline uno prima di aggiungerne un altro.`, url };
  }

  const check = await checkSite(url);
  if (!check.ok) {
    logEvent("warn", "sito_rifiutato", { url, motivo: check.reason, utente: viewer.id });
    // Un sito dell'app che la famiglia aveva tolto non si aggiunge: si rimette.
    if (check.reason === "gia_presente") {
      const overview = await familySitesOverview(viewer.familyId);
      const removed = overview.removed.find((site) => sameSite(site.host, hostOf(url)));
      if (removed) return { error: `${removed.name} è fra i siti dell'app che avete tolto: rimettilo qui sotto.`, url, sites: overview };
    }
    return { error: check.message, url };
  }

  const same = sites.find((site) => sameSite(site.host, check.site.host));
  if (same) return { error: `${same.name} è già fra i siti della famiglia.`, url };

  try {
    await addFamilySite(viewer.familyId, viewer.id, check.site);
  } catch (error) {
    // Due persone che aggiungono lo stesso sito nello stesso momento.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `${check.site.name} è già fra i siti della famiglia.`, url };
    }
    throw error;
  }
  logEvent("warn", "sito_aggiunto", { sito: check.site.host, tipo: check.site.kind, famiglia: viewer.familyId, utente: viewer.id });
  return { added: { name: check.site.name, samples: check.samples }, sites: await familySitesOverview(viewer.familyId) };
}

/** Toglie un sito: quello aggiunto si cancella, quello dell'app va fra i tolti. */
export async function removeSiteAction(siteId: string): Promise<SitesState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: EXPIRED };
  const removed = await removeSearchSite(viewer.familyId, String(siteId));
  if (removed) {
    logEvent("warn", "sito_rimosso", {
      sito: removed.host,
      tipo: removed.builtIn ? "app" : "famiglia",
      famiglia: viewer.familyId,
      utente: viewer.id,
    });
  }
  return { sites: await familySitesOverview(viewer.familyId) };
}

/** Rimette un sito dell'app che la famiglia aveva tolto. */
export async function restoreSiteAction(siteId: string): Promise<SitesState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: EXPIRED };
  const restored = await restoreBuiltInSite(viewer.familyId, String(siteId));
  if (restored) logEvent("warn", "sito_rimesso", { sito: restored.host, famiglia: viewer.familyId, utente: viewer.id });
  return { sites: await familySitesOverview(viewer.familyId) };
}
