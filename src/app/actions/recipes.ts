"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ImportError, sourceKey } from "@/lib/import/url";
import { logEvent } from "@/lib/log";
import { deleteImage, MAX_UPLOAD_BYTES, PhotoError, storeImage, storeImageFromUrl } from "@/lib/photos";
import { DraftError, draftToData } from "@/lib/recipe-draft";
import { findFamilyRecipesFromSource, saveRecipe } from "@/lib/recipes";
import { clientIp } from "@/lib/request-ip";
import { familyViewerOrNull } from "@/lib/session";
import { siteName } from "@/lib/site";
import { recipeDraftSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

const NO_FAMILY = { error: "La sessione è scaduta o non fai più parte della famiglia: ricarica la pagina." };

type PhotoChange = { key: string | null; credit: string | null };

/**
 * La foto da salvare con la ricetta, e il sito da scriverci sopra:
 *  - un file caricato vince su tutto, e non ha fonte;
 *  - «Togli la foto» la rimuove;
 *  - altrimenti, per una ricetta importata, si scarica l'immagine trovata,
 *    che porta il nome del sito della ricetta;
 *  - altrimenti resta quella che c'era (`undefined`).
 */
async function photoFromForm(
  formData: FormData,
  importedImageUrl: string,
  importedSite: string | null,
  viewerId: string,
): Promise<PhotoChange | undefined> {
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) throw new PhotoError("La foto è troppo grande: al massimo 10 MB.");
    return { key: await storeImage(Buffer.from(await file.arrayBuffer())), credit: null };
  }
  if (formData.get("removePhoto") === "1") return { key: null, credit: null };
  if (importedImageUrl) {
    try {
      return { key: await storeImageFromUrl(importedImageUrl), credit: importedSite };
    } catch (error) {
      // Una foto che non si scarica non deve far perdere la ricetta: si salva
      // senza, e la si può aggiungere dopo.
      logEvent("warn", "foto_non_valida", {
        url: importedImageUrl,
        motivo: error instanceof ImportError ? error.reason : error instanceof PhotoError ? "formato" : "errore",
        utente: viewerId,
      });
      return undefined;
    }
  }
  return undefined;
}

export type SaveRecipeState = ActionState & {
  /** Le ricette della famiglia con la stessa fonte: il form chiede conferma. */
  duplicates?: { id: string; title: string }[];
  /** Il link, così come scritto nel form, a cui si riferisce l'avviso. */
  duplicateSource?: string;
};

export async function saveRecipeAction(
  recipeId: string | null,
  _prev: SaveRecipeState,
  formData: FormData,
): Promise<SaveRecipeState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return NO_FAMILY;

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Il modulo è arrivato incompleto: riprova." };
  }
  const draft = recipeDraftSchema.safeParse(payload);
  if (!draft.success) return { error: "Il modulo contiene dati non validi: ricarica la pagina e riprova." };

  let data;
  try {
    data = draftToData(draft.data);
  } catch (error) {
    if (error instanceof DraftError) return { error: error.message };
    throw error;
  }

  // Una ricetta nuova con la fonte di una che c'è già si salva solo dopo una
  // conferma, legata al link: se nel frattempo il link cambia, si richiede. Il
  // controllo viene prima della foto, per non scaricarla a vuoto.
  if (!recipeId && data.sourceUrl) {
    const confirmed = sourceKey(String(formData.get("confirmDuplicate") ?? "")) === sourceKey(data.sourceUrl);
    if (!confirmed) {
      const duplicates = await findFamilyRecipesFromSource(viewer.familyId, [data.sourceUrl]);
      if (duplicates.length > 0) return { duplicates, duplicateSource: draft.data.sourceUrl };
    }
  }

  let photo: PhotoChange | undefined;
  try {
    photo = await photoFromForm(formData, recipeId ? "" : draft.data.importedImageUrl, siteName(data.sourceUrl), viewer.id);
  } catch (error) {
    if (error instanceof PhotoError) {
      logEvent("warn", "foto_non_valida", { motivo: error.message, utente: viewer.id });
      return { error: error.message };
    }
    throw error;
  }

  const imageKey = photo?.key;
  let result;
  try {
    result = await saveRecipe(recipeId, {
      familyId: viewer.familyId,
      userId: viewer.id,
      data,
      imageKey,
      imageCredit: photo?.credit,
    });
  } catch (error) {
    // La foto appena scritta non appartiene a nessuna ricetta: si toglie.
    if (imageKey) await deleteImage(imageKey);
    throw error;
  }

  if (!result) {
    if (imageKey) await deleteImage(imageKey);
    logEvent("warn", "ricetta_non_trovata", { ricetta: recipeId ?? "", utente: viewer.id, azione: "modifica" });
    return { error: "Questa ricetta non esiste più." };
  }
  await deleteImage(result.replacedImage);

  revalidatePath("/ricette");
  revalidatePath(`/ricette/${result.id}`);
  redirect(`/ricette/${result.id}`);
}

export async function deleteRecipeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await familyViewerOrNull();
  if (!viewer) return NO_FAMILY;

  const recipeId = String(formData.get("recipeId") ?? "");
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, familyId: viewer.familyId },
    select: { id: true, title: true, imageKey: true },
  });
  if (!recipe) {
    logEvent("warn", "ricetta_non_trovata", { ricetta: recipeId, utente: viewer.id, azione: "elimina" });
    return { error: "Questa ricetta non esiste più." };
  }

  await prisma.recipe.delete({ where: { id: recipe.id } });
  await prisma.tag.deleteMany({ where: { familyId: viewer.familyId, recipes: { none: {} } } });
  await deleteImage(recipe.imageKey);

  // Tutti i membri possono eliminare: il log dice chi è stato, se un giorno
  // qualcuno cercasse la ricetta sparita.
  logEvent("warn", "ricetta_eliminata", {
    ricetta: recipe.id,
    titolo: recipe.title,
    famiglia: viewer.familyId,
    utente: viewer.id,
    ip: await clientIp(),
  });

  revalidatePath("/ricette");
  redirect("/ricette");
}
