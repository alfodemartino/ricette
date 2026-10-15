"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseWanted } from "@/lib/cook-with";
import { addFamilySite, findSearchSite, listFamilySites, MAX_FAMILY_SITES, removeFamilySite } from "@/lib/family-sites";
import { checkSite } from "@/lib/import/site-check";
import { sameSite, searchSite, type WebMatch } from "@/lib/import/sites";
import { ImportError } from "@/lib/import/url";
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

/** `url` è quello scritto, che resta nella casella quando il sito non va. */
export type AddSiteState = { error?: string; url?: string; added?: { name: string; samples: string[] } };

/**
 * Aggiunge un sito per la famiglia, dopo la verifica di `checkSite`. Tutti i
 * membri possono farlo, come per le ricette; ogni aggiunta e ogni rifiuto
 * finiscono nel log.
 */
export async function addSiteAction(_prev: AddSiteState, formData: FormData): Promise<AddSiteState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return { error: EXPIRED };

  const url = String(formData.get("url") ?? "").trim().slice(0, 300);
  const sites = await listFamilySites(viewer.familyId);
  if (sites.length >= MAX_FAMILY_SITES) {
    return { error: `La famiglia ha già ${MAX_FAMILY_SITES} siti: togline uno prima di aggiungerne un altro.`, url };
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
    // Due persone che aggiungono lo stesso sito nello stesso momento.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `${check.site.name} è già fra i siti della famiglia.`, url };
    }
    throw error;
  }
  logEvent("warn", "sito_aggiunto", { sito: check.site.host, tipo: check.site.kind, famiglia: viewer.familyId, utente: viewer.id });
  revalidatePath("/ricette/cosa-cucino");
  return { added: { name: check.site.name, samples: check.samples } };
}

export async function removeSiteAction(formData: FormData): Promise<void> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return;
  const removed = await removeFamilySite(viewer.familyId, String(formData.get("id") ?? ""));
  if (!removed) return;
  logEvent("warn", "sito_rimosso", { sito: removed.host, famiglia: viewer.familyId, utente: viewer.id });
  revalidatePath("/ricette/cosa-cucino");
}
