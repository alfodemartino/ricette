import { categoryLabel, type RecipeCategory } from "@/lib/categories";
import { formatMinutes, totalMinutes } from "@/lib/duration";
import { formatQuantity, scaleQuantity, unitLabel } from "@/lib/ingredients";

/**
 * La ricetta come messaggio: il testo che «Condividi» manda su WhatsApp, nei
 * Messaggi o per email. Si manda il contenuto e non un link, perché fuori
 * dalla famiglia la ricetta non si apre.
 *
 * Il testo ha due lettori. Chi lo riceve lo legge nella chat: un'emoji davanti
 * a ogni sezione per trovarla a colpo d'occhio, gli ingredienti scritti come
 * nella pagina, con le quantità per le persone scelte. E Ricette stessa, che
 * deve poterlo rileggere quando qualcuno lo incolla: le intestazioni sono
 * quelle che `parseRecipeText` riconosce, e un test lo verifica.
 */

export type ShareableRecipe = {
  title: string;
  category: RecipeCategory | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  notes: string | null;
  sourceUrl: string | null;
  ingredients: {
    section: string | null;
    quantity: number | null;
    unit: string | null;
    name: string;
    note: string | null;
  }[];
  steps: { section: string | null; text: string }[];
};

/**
 * Solo i campi che servono al messaggio, presi da una ricetta letta dal
 * database: è quello che viaggia fino al browser.
 */
export function shareableRecipe(recipe: ShareableRecipe): ShareableRecipe {
  return {
    title: recipe.title,
    category: recipe.category,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    notes: recipe.notes,
    sourceUrl: recipe.sourceUrl,
    ingredients: recipe.ingredients.map(({ section, quantity, unit, name, note }) => ({ section, quantity, unit, name, note })),
    steps: recipe.steps.map(({ section, text }) => ({ section, text })),
  };
}

/** Fra una ricetta e l'altra, quando se ne mandano diverse insieme. */
const RECIPE_SEPARATOR = "──────────";

/** Una riga sola: nella chat un a capo dentro un passo sembrerebbe un passo nuovo. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Per quante persone sono le quantità: quelle scelte, se la ricetta dice per quante è. */
function peopleFor(recipe: ShareableRecipe, people: number | null | undefined): number | null {
  if (!recipe.servings || recipe.servings <= 0) return null;
  return people && people > 0 ? people : recipe.servings;
}

/** «Primo · 4 persone · ⏱️ 40 min», con quello che la ricetta indica. */
function summary(recipe: ShareableRecipe, people: number | null): string {
  const total = formatMinutes(totalMinutes(recipe.prepMinutes, recipe.cookMinutes));
  return [
    recipe.category ? categoryLabel(recipe.category) : "",
    people ? `${people} ${people === 1 ? "persona" : "persone"}` : "",
    total ? `⏱️ ${total}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** «q.b.» resta accanto al nome, come lo si scrive; le altre note vanno fra parentesi. */
function noteText(note: string | null): string {
  const text = oneLine(note ?? "");
  const toTaste = text.match(/^q\.b\.(?:\s*,\s*(.+))?$/i);
  if (toTaste) return toTaste[1] ? `q.b. (${toTaste[1]})` : "q.b.";
  return text ? `(${text})` : "";
}

/** «• Riso Carnaroli 320 g»: nome e quantità nello stesso ordine della pagina. */
function ingredientLine(item: ShareableRecipe["ingredients"][number], quantity: number | null): string {
  const amount = [formatQuantity(quantity, item.unit), unitLabel(item.unit, quantity)].filter(Boolean).join(" ");
  return `• ${[oneLine(item.name), amount, noteText(item.note)].filter(Boolean).join(" ")}`;
}

/**
 * Le righe di una sezione con le sue sottosezioni: «Per la crema:» a ogni
 * cambio, staccata con una riga vuota da quelle prima. I due punti sono il
 * segno con cui l'import riconosce una sottosezione.
 */
function sectionedLines<T extends { section: string | null }>(items: T[], line: (item: T) => string): string[] {
  const lines: string[] = [];
  let current: string | null = null;
  for (const item of items) {
    if (item.section !== current) {
      current = item.section;
      if (lines.length > 0) lines.push("");
      if (current) lines.push(`${oneLine(current).replace(/:$/, "")}:`);
    }
    lines.push(line(item));
  }
  return lines;
}

/** Il messaggio per una ricetta, con le quantità per `people` persone. */
export function recipeShareText(recipe: ShareableRecipe, people?: number | null): string {
  const forPeople = peopleFor(recipe, people);
  const blocks: string[][] = [[`🍽️ ${oneLine(recipe.title)}`, summary(recipe, forPeople)].filter(Boolean)];

  if (recipe.ingredients.length > 0) {
    blocks.push([
      "🛒 Ingredienti",
      ...sectionedLines(recipe.ingredients, (item) =>
        ingredientLine(item, scaleQuantity(item.quantity, recipe.servings, forPeople)),
      ),
    ]);
  }

  if (recipe.steps.length > 0) {
    // I passi si contano di seguito anche fra una sottosezione e l'altra, come nella pagina.
    let number = 0;
    blocks.push(["🍳 Procedimento", ...sectionedLines(recipe.steps, (step) => `${(number += 1)}. ${oneLine(step.text)}`)]);
  }

  // Le note restano come sono state scritte, a capo compresi.
  const notes = recipe.notes?.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (notes) blocks.push(["📝 Note", notes]);

  if (recipe.sourceUrl?.trim()) blocks.push([`🔗 ${recipe.sourceUrl.trim()}`]);

  return blocks.map((block) => block.join("\n")).join("\n\n");
}

/** Più ricette in un messaggio solo, ognuna con le sue porzioni. */
export function recipesShareText(recipes: ShareableRecipe[]): string {
  return recipes.map((recipe) => recipeShareText(recipe)).join(`\n\n${RECIPE_SEPARATOR}\n\n`);
}

/** L'oggetto dell'email, e il titolo per il pannello di condivisione del telefono. */
export function shareSubject(recipes: ShareableRecipe[]): string {
  return recipes.map((recipe) => oneLine(recipe.title)).join(", ");
}

/** WhatsApp con il messaggio già scritto: la chat la sceglie chi manda. Funziona anche in http. */
export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Un'email con oggetto e testo. Gli a capo vanno come CRLF, come chiede lo standard dei link `mailto:`. */
export function mailtoHref(subject: string, text: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.replace(/\r?\n/g, "\r\n"))}`;
}
