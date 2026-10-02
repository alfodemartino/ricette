import type { CheerioAPI } from "cheerio";
import { parseIsoDuration } from "@/lib/duration";
import { absoluteUrl, cleanLine, cleanText } from "@/lib/import/html";
import type { ImportedRecipe, ImportedStep } from "@/lib/import/types";

/**
 * Le ricette descritte con i dati strutturati di schema.org
 * (`<script type="application/ld+json">` con `"@type": "Recipe"`). Li pubblica
 * quasi ogni sito di ricette, perché è quello che Google legge per le schede
 * delle ricette: quando ci sono, l'import è completo e preciso.
 */

type Json = unknown;
type JsonObject = Record<string, Json>;

function isObject(value: Json): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasType(node: JsonObject, type: string): boolean {
  const value = node["@type"];
  const types = Array.isArray(value) ? value : [value];
  return types.some((entry) => typeof entry === "string" && entry.replace(/^.*[/:]/, "").toLowerCase() === type.toLowerCase());
}

/** Cerca il nodo `Recipe` ovunque stia: in un array, in `@graph`, in `mainEntity`. */
export function findRecipeNode(data: Json, depth = 0): JsonObject | null {
  if (depth > 8) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(data)) return null;
  if (hasType(data, "Recipe")) return data;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    if (key in data) {
      const found = findRecipeNode(data[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Alcuni siti scrivono il JSON con a capo e tabulazioni dentro le stringhe,
 * che il parser rifiuta: al secondo tentativo diventano spazi.
 */
function parseJsonLoosely(text: string): Json {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/[\u0000-\u001f]+/g, " "));
    } catch {
      return null;
    }
  }
}

function firstNumber(value: Json): number | null {
  const values = Array.isArray(value) ? value : [value];
  for (const entry of values) {
    if (typeof entry === "number" && entry > 0) return Math.round(entry);
    if (typeof entry === "string") {
      const match = entry.match(/\d+/);
      if (match && Number(match[0]) > 0 && Number(match[0]) < 100) return Number(match[0]);
    }
  }
  return null;
}

function readImage(value: Json, base: URL): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = readImage(entry, base);
      if (found) return found;
    }
    return null;
  }
  if (isObject(value)) return absoluteUrl(value.url ?? value.contentUrl, base);
  return absoluteUrl(value, base);
}

function stripNumber(text: string): string {
  return text.replace(/^\s*(?:step|passo)?\s*\d{1,2}\s*[.):\-–]\s+/i, "").trim();
}

/** Un testo d'istruzioni in un solo blocco: si divide per righe, o per «1.», «2.». */
function splitInstructionText(text: string): string[] {
  const lines = cleanText(text).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines.map(stripNumber).filter(Boolean);
  const single = lines[0] ?? "";
  const numbered = single.split(/\s+(?=\d{1,2}[.)]\s)/);
  return (numbered.length > 1 ? numbered : [single]).map(stripNumber).filter(Boolean);
}

/** Il procedimento, in tutte le forme ammesse da schema.org. */
export function readInstructions(value: Json, section: string | null = null, depth = 0): ImportedStep[] {
  if (depth > 6 || value === null || value === undefined) return [];
  if (typeof value === "string") return splitInstructionText(value).map((text) => ({ section, text }));
  if (Array.isArray(value)) return value.flatMap((entry) => readInstructions(entry, section, depth + 1));
  if (!isObject(value)) return [];

  if (hasType(value, "HowToSection")) {
    const name = cleanLine(value.name) || section;
    return readInstructions(value.itemListElement ?? value.steps, name, depth + 1);
  }
  if (value.itemListElement) return readInstructions(value.itemListElement, section, depth + 1);

  const text = cleanText(value.text ?? value.description ?? value.name ?? value.item);
  return text ? splitInstructionText(text).map((line) => ({ section, text: line })) : [];
}

function readIngredients(value: Json): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n+/) : [];
  return values.map((entry) => cleanLine(entry)).filter(Boolean);
}

function readCategory(value: Json): string | null {
  const values = Array.isArray(value) ? value : [value];
  const text = values.filter((entry) => typeof entry === "string").join(", ");
  return text || null;
}

/** Le parole chiave: una stringa separata da virgole oppure un elenco. */
export function readKeywords(value: Json): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((entry): entry is string => typeof entry === "string")
    .flatMap((entry) => entry.split(/[,;]/))
    .map((entry) => cleanLine(entry))
    .filter(Boolean)
    .slice(0, 50);
}

/** La ricetta nei dati strutturati della pagina, oppure `null` se non c'è. */
export function extractJsonLdRecipe($: CheerioAPI, pageUrl: URL, sourceUrl: string): ImportedRecipe | null {
  let node: JsonObject | null = null;
  $('script[type="application/ld+json"]').each((_, element) => {
    if (node) return;
    node = findRecipeNode(parseJsonLoosely($(element).text()));
  });
  if (!node) return null;
  const recipe: JsonObject = node;

  const title = cleanLine(recipe.name ?? recipe.headline);
  const ingredients = readIngredients(recipe.recipeIngredient ?? recipe.ingredients);
  const steps = readInstructions(recipe.recipeInstructions);
  if (!title && ingredients.length === 0) return null;

  let prepMinutes = parseIsoDuration(recipe.prepTime);
  const cookMinutes = parseIsoDuration(recipe.cookTime);
  // Solo il tempo totale: lo si tiene come preparazione, così la somma che
  // l'app mostra resta giusta.
  if (prepMinutes === null && cookMinutes === null) prepMinutes = parseIsoDuration(recipe.totalTime);

  return {
    title,
    description: cleanText(recipe.description) || null,
    servings: firstNumber(recipe.recipeYield ?? recipe.yield),
    prepMinutes,
    cookMinutes,
    category: readCategory(recipe.recipeCategory),
    keywords: readKeywords(recipe.keywords),
    ingredients: ingredients.map((text) => ({ section: null, text })),
    steps,
    imageUrl: readImage(recipe.image ?? recipe.thumbnailUrl, pageUrl),
    sourceUrl,
    resolvedUrl: null,
    sourceKind: "SITO",
    rawText: null,
    method: "dati-strutturati",
  };
}
