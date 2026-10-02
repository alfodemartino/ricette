import { parseIngredientLine, sectionHeading } from "@/lib/ingredients";
import type { ImportedStep } from "@/lib/import/types";

/**
 * Ingredienti e procedimento cercati in un testo libero: la descrizione di un
 * video, la didascalia di un post, il corpo di una pagina senza dati
 * strutturati.
 *
 * È un'euristica e lo sa: cerca le intestazioni che chi scrive ricette usa
 * davvero («Ingredienti», «Procedimento», «Preparazione»…) e prende le righe
 * che seguono. Quello che trova va comunque controllato nel form, ed è il
 * motivo per cui l'import non salva mai da solo.
 */

export type TextRecipe = {
  ingredients: { section: string | null; text: string }[];
  steps: ImportedStep[];
  servings: number | null;
};

const INGREDIENTS_HEADER = /^[^\p{L}\d]*(ingredienti|ingredients|occorrente|cosa (?:ti )?serve)\b(.*)$/iu;
const STEPS_HEADER =
  /^[^\p{L}\d]*(procedimento|preparazione|come (?:si )?prepar\w*|istruzioni|metodo|method|instructions|directions|steps|passaggi|ricetta)\s*:?\s*$/iu;
/** Dove finisce la ricetta e cominciano saluti, link, musica e hashtag. */
const STOP =
  /^[^\p{L}\d]*(note|consigli|conservazione|seguimi|seguici|iscriviti|follow|musica|music|social|instagram|facebook|tiktok|sito|website|link|collaborazioni|contatti|business|attrezzatura|tags?)\b|^#|https?:\/\//iu;

const BULLET = /^\s*(?:[-–—•·▪◦*+✓✔✅➡▶🔸🔹]|\p{Extended_Pictographic})/u;

function stripStepNumber(line: string): string {
  return line
    .replace(/^[^\p{L}\d]*/u, "")
    .replace(/^(?:step|passo|fase)\s*\d+\s*[.):\-–]?\s*/i, "")
    .replace(/^\d{1,2}\s*[.):\-–]\s*/, "")
    .trim();
}

/** Le porzioni scritte accanto a «Ingredienti»: «per 4», «(4 persone)». */
function servingsFromHeader(text: string): number | null {
  const match = text.match(/\bper\s+(\d{1,2})\b/i) ?? text.match(/(\d{1,2})\s*(?:persone|porzioni|servings)/i);
  return match ? Number(match[1]) : null;
}

/**
 * Le porzioni cercate nel resto del testo: qui serve la parola, perché «per
 * 10» da solo è più spesso «cuocete per 10 minuti».
 */
function servingsFromText(text: string): number | null {
  const match = text.match(/\b(?:per\s+)?(\d{1,2})\s*(?:persone|porzioni|servings)\b/i);
  return match ? Number(match[1]) : null;
}

/** Una riga che sembra un ingrediente: puntata, o con una quantità, o «q.b.». */
function looksLikeIngredient(line: string): boolean {
  if (line.length > 90) return false;
  if (BULLET.test(line)) return true;
  const parsed = parseIngredientLine(line);
  return parsed.quantity !== null || parsed.note === "q.b.";
}

/** Una frase di procedimento: lunga, e che finisce come finisce una frase. */
function looksLikeProse(line: string): boolean {
  return line.length > 80 || (line.length > 40 && /[.!]$/.test(line));
}

export function parseRecipeText(text: string): TextRecipe {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const ingredients: TextRecipe["ingredients"] = [];
  const steps: ImportedStep[] = [];
  let servings: number | null = null;

  let mode: "none" | "ingredients" | "steps" = "none";
  let section: string | null = null;
  let sawIngredientsHeader = false;

  for (const line of lines) {
    if (!line) continue;

    const ingredientsHeader = line.match(INGREDIENTS_HEADER);
    if (ingredientsHeader && line.length < 80) {
      mode = "ingredients";
      sawIngredientsHeader = true;
      section = null;
      servings ??= servingsFromHeader(ingredientsHeader[2] ?? "");
      // «Ingredienti per la crema:» apre già una sezione.
      const rest = (ingredientsHeader[2] ?? "").replace(/[:\s]+$/, "").trim();
      if (/^per (il|lo|la|l'|i|gli|le)\b/i.test(rest)) section = rest.charAt(0).toUpperCase() + rest.slice(1);
      continue;
    }
    if (STEPS_HEADER.test(line)) {
      mode = "steps";
      section = null;
      continue;
    }
    if (STOP.test(line)) {
      if (mode !== "none") mode = "none";
      continue;
    }

    if (mode === "ingredients") {
      if (looksLikeProse(line) && !BULLET.test(line)) {
        // Finito l'elenco, il testo è passato a spiegare come si fa.
        mode = "steps";
        section = null;
      } else {
        const heading = sectionHeading(line);
        if (heading) section = heading;
        else ingredients.push({ section, text: line });
        continue;
      }
    }

    if (mode === "steps") {
      const heading = line.length < 50 && line.endsWith(":") ? sectionHeading(line) : null;
      if (heading) {
        section = heading;
        continue;
      }
      const textLine = stripStepNumber(line);
      if (textLine) steps.push({ section, text: textLine });
    }
  }

  // Nessuna intestazione: si prende la serie più lunga di righe che sembrano
  // ingredienti, purché siano almeno tre (due righe con un numero sono poche
  // per dire che è un elenco).
  if (!sawIngredientsHeader) {
    let best: string[] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (line && looksLikeIngredient(line) && !STOP.test(line)) current.push(line);
      else if (line) {
        if (current.length > best.length) best = current;
        current = [];
      }
    }
    if (current.length > best.length) best = current;
    if (best.length >= 3) {
      ingredients.push(...best.map((line) => ({ section: null, text: line })));
    }
  }

  return { ingredients, steps, servings: servings ?? servingsFromText(text) };
}
