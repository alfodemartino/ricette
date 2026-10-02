"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ImportError } from "@/lib/import/url";
import { logEvent } from "@/lib/log";
import { deleteImage, MAX_UPLOAD_BYTES, PhotoError, storeImage, storeImageFromUrl } from "@/lib/photos";
import { DraftError, draftToData } from "@/lib/recipe-draft";
import { saveRecipe } from "@/lib/recipes";
import { clientIp } from "@/lib/request-ip";
import { familyViewerOrNull } from "@/lib/session";
import { recipeDraftSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

const NO_FAMILY = { error: "La sessione è scaduta o non fai più parte della famiglia: ricarica la pagina." };

/**
 * La foto da salvare con la ricetta:
 *  - un file caricato vince su tutto;
 *  - «Togli la foto» la rimuove;
 *  - altrimenti, per una ricetta importata, si scarica l'immagine trovata;
 *  - altrimenti resta quella che c'era (`undefined`).
 */
async function photoFromForm(formData: FormData, importedImageUrl: string, viewerId: string): Promise<string | null | undefined> {
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) throw new PhotoError("La foto è troppo grande: al massimo 10 MB.");
    return storeImage(Buffer.from(await file.arrayBuffer()));
  }
  if (formData.get("removePhoto") === "1") return null;
  if (importedImageUrl) {
    try {
      return await storeImageFromUrl(importedImageUrl);
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

export async function saveRecipeAction(
  recipeId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
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

  let imageKey: string | null | undefined;
  try {
    imageKey = await photoFromForm(formData, recipeId ? "" : draft.data.importedImageUrl, viewer.id);
  } catch (error) {
    if (error instanceof PhotoError) {
      logEvent("warn", "foto_non_valida", { motivo: error.message, utente: viewer.id });
      return { error: error.message };
    }
    throw error;
  }

  let result;
  try {
    result = await saveRecipe(recipeId, { familyId: viewer.familyId, userId: viewer.id, data, imageKey });
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
