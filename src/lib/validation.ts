import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/categories";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Indirizzo email non valido."),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri."),
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, "Il nome è obbligatorio.").max(60),
});

export const familyNameSchema = z.string().trim().min(1, "Dai un nome alla famiglia.").max(60, "Il nome è troppo lungo.");

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,10}$/, "Codice di invito non valido.");

/**
 * La bozza che il form manda al server come JSON. Si controlla la forma qui,
 * prima di `draftToData`: il JSON arriva dal browser e potrebbe essere
 * qualsiasi cosa.
 */
const text = (max: number) => z.string().max(max).catch("");

const ingredientRowSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("heading"), title: text(200) }),
  z.object({ kind: z.literal("item"), quantity: text(30), unit: text(60), name: text(300), note: text(300) }),
]);

const stepRowSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("heading"), title: text(200) }),
  z.object({ kind: z.literal("item"), text: text(8000) }),
]);

export const recipeDraftSchema = z.object({
  title: text(300),
  description: text(4000),
  category: z.union([z.literal(""), z.enum(CATEGORY_IDS)]).catch(""),
  servings: text(10),
  prepMinutes: text(10),
  cookMinutes: text(10),
  notes: text(8000),
  sourceUrl: text(2000),
  sourceKind: z.enum(["MANUALE", "SITO", "VIDEO"]).catch("MANUALE"),
  tags: z.array(z.string().max(60)).max(40).catch([]),
  ingredients: z.array(ingredientRowSchema).max(300),
  steps: z.array(stepRowSchema).max(150),
  importedImageUrl: text(2000),
});
