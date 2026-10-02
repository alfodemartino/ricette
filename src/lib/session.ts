import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Chi sta usando l'app e in quale famiglia. Il token di sessione porta solo
 * l'id: la famiglia si legge ogni volta dal database, così chi esce da una
 * famiglia (o ne viene tolto) smette subito di vederne le ricette.
 *
 * Stanno qui e non in un file di server action: una funzione esportata da un
 * file `"use server"` diventerebbe un'azione che il browser può chiamare.
 */

export async function loadViewer() {
  const user = await currentUser();
  if (!user) return null;
  return prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, familyId: true, familyRole: true },
  });
}

export type Viewer = NonNullable<Awaited<ReturnType<typeof loadViewer>>>;
export type FamilyViewer = Viewer & { familyId: string };

/** Per le pagine: senza accesso si va al login. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await loadViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Per le pagine delle ricette: senza famiglia si va a crearne o a sceglierne una. */
export async function requireFamilyViewer(): Promise<FamilyViewer> {
  const viewer = await requireViewer();
  if (!viewer.familyId) redirect("/famiglia");
  return viewer as FamilyViewer;
}

/** Per le server action: `null` invece di un redirect, il chiamante risponde con un errore. */
export async function familyViewerOrNull(): Promise<FamilyViewer | null> {
  const viewer = await loadViewer();
  return viewer?.familyId ? (viewer as FamilyViewer) : null;
}

/** Un parametro dell'indirizzo che non può essere un id si tratta come «non trovato». */
export function assertId(id: string): string {
  if (!/^[a-z0-9]{20,40}$/i.test(id)) notFound();
  return id;
}
