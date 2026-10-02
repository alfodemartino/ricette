import { guessCategory, isCategory, type RecipeCategory } from "@/lib/categories";
import { parseIngredientLine, parseQuantity, quantityInput, sectionHeading } from "@/lib/ingredients";
import { BIMBY_TAG, bimbyTitle, suggestedTags } from "@/lib/import/tags";
import type { ImportedRecipe } from "@/lib/import/types";
import { uniqueTags } from "@/lib/tags";

/**
 * La bozza di una ricetta, cioè quello che il form mostra e rimanda al server.
 * La stessa forma nasce in tre modi — ricetta nuova, ricetta da modificare,
 * ricetta importata da un link — e torna sempre indietro allo stesso modo.
 *
 * Ingredienti e passi sono elenchi di righe; una riga può essere
 * un'intestazione di sottosezione («Per la crema»), che vale per le righe che
 * la seguono. Nel database la sezione sta invece su ogni riga.
 */

export type IngredientRow =
  | { kind: "heading"; title: string }
  | { kind: "item"; quantity: string; unit: string; name: string; note: string };

export type StepRow = { kind: "heading"; title: string } | { kind: "item"; text: string };

export type SourceKind = "MANUALE" | "SITO" | "VIDEO";

export type RecipeDraft = {
  title: string;
  description: string;
  category: RecipeCategory | "";
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  notes: string;
  sourceUrl: string;
  /** Dove porta `sourceUrl` dopo i redirect; il form lo svuota se si cambia il link. */
  resolvedUrl: string;
  sourceKind: SourceKind;
  tags: string[];
  ingredients: IngredientRow[];
  steps: StepRow[];
  /** L'immagine trovata dall'import: si scarica solo quando si salva. */
  importedImageUrl: string;
};

export const MAX_TITLE_LENGTH = 150;

export const emptyIngredient = (): IngredientRow => ({ kind: "item", quantity: "", unit: "", name: "", note: "" });
export const emptyStep = (): StepRow => ({ kind: "item", text: "" });

export function emptyDraft(): RecipeDraft {
  return {
    title: "",
    description: "",
    category: "",
    servings: "4",
    prepMinutes: "",
    cookMinutes: "",
    notes: "",
    sourceUrl: "",
    resolvedUrl: "",
    sourceKind: "MANUALE",
    tags: [],
    ingredients: [emptyIngredient()],
    steps: [emptyStep()],
    importedImageUrl: "",
  };
}

function numberInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Righe con sezione → righe del form, con un'intestazione a ogni cambio. */
function withHeadings<T extends { section: string | null }, R>(
  items: T[],
  toRow: (item: T) => R,
): (R | { kind: "heading"; title: string })[] {
  const rows: (R | { kind: "heading"; title: string })[] = [];
  let current: string | null = null;
  for (const item of items) {
    if (item.section && item.section !== current) rows.push({ kind: "heading", title: item.section });
    current = item.section;
    rows.push(toRow(item));
  }
  return rows;
}

/** Una riga letta da un testo (import o «Incolla elenco») come riga del form. */
export function ingredientRowFromText(text: string): IngredientRow {
  const parsed = parseIngredientLine(text);
  return {
    kind: "item",
    quantity: quantityInput(parsed.quantity),
    unit: parsed.unit ?? "",
    name: parsed.name,
    note: parsed.note ?? "",
  };
}

/** La bozza di una ricetta importata da un link. */
export function draftFromImport(imported: ImportedRecipe): RecipeDraft {
  // Nei dati di molti siti le sottosezioni sono righe dell'elenco
  // («Per la crema:»): qui diventano la sezione delle righe che seguono.
  const ingredients: { section: string | null; text: string }[] = [];
  let section: string | null = null;
  for (const item of imported.ingredients) {
    const heading = sectionHeading(item.text);
    if (heading) {
      section = heading;
      continue;
    }
    ingredients.push({ section: item.section ?? section, text: item.text });
  }

  const category = guessCategory(imported.category) ?? guessCategory(imported.title);
  const tags = suggestedTags(imported);
  const title = tags.includes(BIMBY_TAG)
    ? bimbyTitle(imported.title, MAX_TITLE_LENGTH)
    : imported.title.slice(0, MAX_TITLE_LENGTH);

  return {
    title,
    description: imported.description ?? "",
    category: category ?? "",
    servings: numberInput(imported.servings),
    prepMinutes: numberInput(imported.prepMinutes),
    cookMinutes: numberInput(imported.cookMinutes),
    notes: "",
    sourceUrl: imported.sourceUrl,
    resolvedUrl: imported.resolvedUrl ?? "",
    sourceKind: imported.sourceKind,
    tags,
    ingredients: ingredients.length > 0 ? withHeadings(ingredients, (item) => ingredientRowFromText(item.text)) : [emptyIngredient()],
    steps:
      imported.steps.length > 0
        ? withHeadings(imported.steps, (step) => ({ kind: "item" as const, text: step.text }))
        : [emptyStep()],
    importedImageUrl: imported.imageUrl ?? "",
  };
}

/** Quello che serve di una ricetta salvata per rimetterla nel form. */
export type StoredRecipe = {
  title: string;
  description: string | null;
  category: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  notes: string | null;
  sourceUrl: string | null;
  resolvedUrl: string | null;
  sourceKind: SourceKind;
  tags: { name: string }[];
  ingredients: { section: string | null; quantity: number | null; unit: string | null; name: string; note: string | null }[];
  steps: { section: string | null; text: string }[];
};

export function draftFromRecipe(recipe: StoredRecipe): RecipeDraft {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    category: isCategory(recipe.category) ? recipe.category : "",
    servings: numberInput(recipe.servings),
    prepMinutes: numberInput(recipe.prepMinutes),
    cookMinutes: numberInput(recipe.cookMinutes),
    notes: recipe.notes ?? "",
    sourceUrl: recipe.sourceUrl ?? "",
    resolvedUrl: recipe.resolvedUrl ?? "",
    sourceKind: recipe.sourceKind,
    tags: recipe.tags.map((tag) => tag.name),
    ingredients:
      recipe.ingredients.length > 0
        ? withHeadings(recipe.ingredients, (item) => ({
            kind: "item" as const,
            quantity: quantityInput(item.quantity),
            unit: item.unit ?? "",
            name: item.name,
            note: item.note ?? "",
          }))
        : [emptyIngredient()],
    steps: recipe.steps.length > 0 ? withHeadings(recipe.steps, (step) => ({ kind: "item" as const, text: step.text })) : [emptyStep()],
    importedImageUrl: "",
  };
}

// ---------------------------------------------------------------------------
// Dalla bozza al database
// ---------------------------------------------------------------------------

export type IngredientData = {
  position: number;
  section: string | null;
  quantity: number | null;
  unit: string | null;
  name: string;
  note: string | null;
};

export type StepData = { position: number; section: string | null; text: string };

export type RecipeData = {
  title: string;
  description: string | null;
  category: RecipeCategory | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  notes: string | null;
  sourceUrl: string | null;
  resolvedUrl: string | null;
  sourceKind: SourceKind;
  tags: string[];
  ingredients: IngredientData[];
  steps: StepData[];
};

function optionalText(value: string, max: number): string | null {
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function optionalInt(value: string, label: string, max: number): number | null {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number < 0 || number > max) {
    throw new DraftError(`${label}: scrivi un numero intero fra 0 e ${max}.`);
  }
  return number === 0 ? null : number;
}

export class DraftError extends Error {}

/**
 * Controlla la bozza e la trasforma nei dati da salvare. Le righe vuote si
 * saltano senza protestare: sono quelle che il form lascia pronte in fondo.
 * Lancia `DraftError` con un messaggio da mostrare se qualcosa non va.
 */
export function draftToData(draft: RecipeDraft): RecipeData {
  const title = draft.title.trim();
  if (!title) throw new DraftError("Dai un titolo alla ricetta.");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new DraftError(`Il titolo è troppo lungo (al massimo ${MAX_TITLE_LENGTH} caratteri).`);
  }

  const ingredients: IngredientData[] = [];
  let section: string | null = null;
  for (const row of draft.ingredients) {
    if (row.kind === "heading") {
      section = optionalText(row.title, 80);
      continue;
    }
    const name = row.name.trim();
    if (!name && !row.quantity.trim() && !row.unit.trim()) continue;
    if (!name) throw new DraftError("Ogni ingrediente con una quantità deve avere anche il nome.");
    const quantityText = row.quantity.trim();
    const quantity = quantityText ? parseQuantity(quantityText) : null;
    if (quantityText && quantity === null) {
      throw new DraftError(`La quantità «${quantityText}» di «${name}» non è un numero (esempi: 200, 1,5, 1/2).`);
    }
    ingredients.push({
      position: ingredients.length,
      section,
      quantity,
      unit: optionalText(row.unit, 30),
      name: name.slice(0, 120),
      note: optionalText(row.note, 120),
    });
  }

  const steps: StepData[] = [];
  section = null;
  for (const row of draft.steps) {
    if (row.kind === "heading") {
      section = optionalText(row.title, 80);
      continue;
    }
    const text = row.text.trim();
    if (!text) continue;
    steps.push({ position: steps.length, section, text: text.slice(0, 4000) });
  }

  if (ingredients.length > 200 || steps.length > 100) throw new DraftError("La ricetta ha troppe righe.");

  const sourceUrl = optionalText(draft.sourceUrl, 2000);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new DraftError("Il link della fonte deve cominciare con http:// o https://.");
  // Non si vede e non lo scrive l'utente: se non è un link valido, si lascia cadere.
  const resolvedUrl = sourceUrl ? optionalText(draft.resolvedUrl, 2000) : null;

  return {
    title,
    description: optionalText(draft.description, 2000),
    category: isCategory(draft.category) ? draft.category : null,
    servings: optionalInt(draft.servings, "Porzioni", 100),
    prepMinutes: optionalInt(draft.prepMinutes, "Tempo di preparazione", 10_000),
    cookMinutes: optionalInt(draft.cookMinutes, "Tempo di cottura", 10_000),
    notes: optionalText(draft.notes, 4000),
    sourceUrl,
    resolvedUrl: resolvedUrl && /^https?:\/\//i.test(resolvedUrl) ? resolvedUrl : null,
    sourceKind: sourceUrl ? draft.sourceKind : "MANUALE",
    tags: uniqueTags(draft.tags).slice(0, 20),
    ingredients,
    steps,
  };
}

/**
 * Un procedimento incollato in un blocco unico, diviso in passi: uno per riga,
 * togliendo la numerazione («1.», «2)», «Passo 3:»). Le righe brevi che
 * finiscono con i due punti diventano sottosezioni.
 */
export function stepRowsFromText(text: string): StepRow[] {
  const rows: StepRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.length <= 50 && line.endsWith(":")) {
      rows.push({ kind: "heading", title: line.slice(0, -1).trim() });
      continue;
    }
    const clean = line
      .replace(/^(?:step|passo|fase)\s*\d+\s*[.):\-–]?\s*/i, "")
      .replace(/^\d{1,2}\s*[.)\-–]\s*/, "")
      .replace(/^[-•*]\s*/, "")
      .trim();
    if (clean) rows.push({ kind: "item", text: clean });
  }
  return rows;
}
