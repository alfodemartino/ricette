"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { logEvent } from "@/lib/log";
import { clientIp } from "@/lib/request-ip";
import type { ActionState } from "@/lib/action-state";

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Preso da solo è un familiare che non ricordava di essersi già iscritto.
    // Ripetuto su indirizzi diversi è qualcuno che sonda quali email hanno un
    // account qui.
    logEvent("warn", "registrazione_email_esistente", { email, ip: await clientIp() });
    return { error: "Esiste già un account con questa email." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({ data: { name, email, passwordHash } });

  await signIn("credentials", { email, password, redirectTo: "/ricette" });
  return {};
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Inserisci email e password." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/ricette" });
  } catch (error) {
    if (error instanceof AuthError) {
      // Mai la password, nemmeno la sua lunghezza: serve sapere quale account
      // e da dove, non cosa è stato digitato.
      logEvent("warn", "login_fallito", { email, ip: await clientIp() });
      return { error: "Email o password non corretti." };
    }
    throw error; // Le redirect di Next passano di qui e devono propagarsi.
  }

  return {};
}

export async function loginWithGoogleAction() {
  await signIn("google", { redirectTo: "/ricette" });
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/");
}
