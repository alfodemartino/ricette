"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { generateInviteCode } from "@/lib/family";
import { logEvent } from "@/lib/log";
import { deleteImage } from "@/lib/photos";
import { clientIp } from "@/lib/request-ip";
import { loadViewer, type Viewer } from "@/lib/session";
import { familyNameSchema, inviteCodeSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

const NOT_LOGGED = { error: "La sessione è scaduta: accedi di nuovo." };

/** Crea un codice che nessun'altra famiglia ha: le collisioni sono rare, ma possibili. */
async function freshInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const taken = await prisma.family.findUnique({ where: { inviteCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Impossibile generare un codice di invito libero.");
}

/** L'utente corrente, che deve essere l'amministratore della sua famiglia. */
async function requireOwner(azione: string): Promise<(Viewer & { familyId: string }) | null> {
  const viewer = await loadViewer();
  if (!viewer?.familyId) return null;
  if (viewer.familyRole !== "OWNER") {
    logEvent("warn", "permesso_negato", { famiglia: viewer.familyId, utente: viewer.id, azione, ip: await clientIp() });
    return null;
  }
  return viewer as Viewer & { familyId: string };
}

export async function createFamilyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await loadViewer();
  if (!viewer) return NOT_LOGGED;
  if (viewer.familyId) return { error: "Fai già parte di una famiglia: esci prima di crearne un'altra." };

  const parsed = familyNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nome non valido." };

  const family = await prisma.family.create({
    data: { name: parsed.data, inviteCode: await freshInviteCode() },
  });
  await prisma.user.update({
    where: { id: viewer.id },
    data: { familyId: family.id, familyRole: "OWNER", joinedAt: new Date() },
  });

  redirect("/ricette");
}

export async function joinFamilyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await loadViewer();
  if (!viewer) return NOT_LOGGED;
  if (viewer.familyId) return { error: "Fai già parte di una famiglia: esci prima di entrare in un'altra." };

  const parsed = inviteCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Codice non valido." };

  const family = await prisma.family.findUnique({ where: { inviteCode: parsed.data } });
  if (!family) {
    // Uno sbaglio di battitura, se capita una volta; qualcuno che prova codici
    // a caso, se si ripete.
    logEvent("warn", "invito_inesistente", { codice: parsed.data, utente: viewer.id, ip: await clientIp() });
    return { error: "Nessuna famiglia con questo codice. Controlla di averlo scritto bene." };
  }

  await prisma.user.update({
    where: { id: viewer.id },
    data: { familyId: family.id, familyRole: "MEMBER", joinedAt: new Date() },
  });
  redirect("/ricette");
}

export async function leaveFamilyAction(): Promise<ActionState> {
  const viewer = await loadViewer();
  if (!viewer?.familyId) return NOT_LOGGED;

  if (viewer.familyRole === "OWNER") {
    const others = await prisma.user.count({ where: { familyId: viewer.familyId, id: { not: viewer.id } } });
    return {
      error:
        others > 0
          ? "Sei l'amministratore: prima di uscire passa il ruolo a un altro membro."
          : "Sei l'unico membro: per lasciare la famiglia eliminala, con tutte le sue ricette.",
    };
  }

  await prisma.user.update({ where: { id: viewer.id }, data: { familyId: null, familyRole: "MEMBER", joinedAt: null } });
  redirect("/famiglia");
}

export async function renameFamilyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner("rinomina_famiglia");
  if (!owner) return { error: "Solo l'amministratore può rinominare la famiglia." };

  const parsed = familyNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nome non valido." };

  await prisma.family.update({ where: { id: owner.familyId }, data: { name: parsed.data } });
  revalidatePath("/famiglia");
  return { success: "Nome aggiornato." };
}

export async function regenerateInviteAction(): Promise<ActionState> {
  const owner = await requireOwner("nuovo_codice");
  if (!owner) return { error: "Solo l'amministratore può cambiare il codice di invito." };

  await prisma.family.update({ where: { id: owner.familyId }, data: { inviteCode: await freshInviteCode() } });
  revalidatePath("/famiglia");
  return { success: "Nuovo codice creato: quello vecchio non vale più." };
}

/** Il membro indicato nel form, purché sia della stessa famiglia e non sia chi agisce. */
async function otherMember(familyId: string, selfId: string, formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId || memberId === selfId) return null;
  return prisma.user.findFirst({ where: { id: memberId, familyId }, select: { id: true, name: true } });
}

export async function removeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner("rimuovi_membro");
  if (!owner) return { error: "Solo l'amministratore può togliere un membro." };

  const member = await otherMember(owner.familyId, owner.id, formData);
  if (!member) return { error: "Membro non trovato." };

  // Le ricette che ha scritto restano alla famiglia.
  await prisma.user.update({ where: { id: member.id }, data: { familyId: null, familyRole: "MEMBER", joinedAt: null } });
  revalidatePath("/famiglia");
  return { success: `${member.name ?? "Il membro"} non fa più parte della famiglia.` };
}

export async function makeOwnerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner("passa_amministrazione");
  if (!owner) return { error: "Solo l'amministratore può passare il ruolo." };

  const member = await otherMember(owner.familyId, owner.id, formData);
  if (!member) return { error: "Membro non trovato." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: member.id }, data: { familyRole: "OWNER" } }),
    prisma.user.update({ where: { id: owner.id }, data: { familyRole: "MEMBER" } }),
  ]);
  revalidatePath("/famiglia");
  return { success: `Ora l'amministratore è ${member.name ?? "l'altro membro"}.` };
}

export async function deleteFamilyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner("elimina_famiglia");
  if (!owner) return { error: "Solo l'amministratore può eliminare la famiglia." };

  const family = await prisma.family.findUnique({ where: { id: owner.familyId } });
  if (!family) return { error: "Famiglia non trovata." };
  if (String(formData.get("confirm") ?? "").trim() !== family.name) {
    return { error: "Per confermare riscrivi esattamente il nome della famiglia." };
  }

  const [images, recipes, members] = await Promise.all([
    prisma.recipe.findMany({ where: { familyId: family.id, imageKey: { not: null } }, select: { imageKey: true } }),
    prisma.recipe.count({ where: { familyId: family.id } }),
    prisma.user.findMany({ where: { familyId: family.id }, select: { id: true } }),
  ]);

  try {
    // Ricette, ingredienti, passi e tag se ne vanno in cascata; gli utenti
    // restano, senza famiglia, e tornano semplici utenti in attesa di una.
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { id: { in: members.map((member) => member.id) } },
        data: { familyId: null, familyRole: "MEMBER", joinedAt: null },
      }),
      prisma.family.delete({ where: { id: family.id } }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") redirect("/famiglia");
    throw error;
  }
  await Promise.all(images.map((image) => deleteImage(image.imageKey)));

  logEvent("warn", "famiglia_eliminata", {
    famiglia: family.id,
    nome: family.name,
    ricette: recipes,
    utente: owner.id,
    ip: await clientIp(),
  });
  redirect("/famiglia");
}
