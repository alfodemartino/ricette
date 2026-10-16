import { factorForAmount, formatPeople, parseIngredientLine, peopleFor } from "@/lib/ingredients";
import { normalizeForSearch } from "@/lib/text";

/**
 * «Cosa cucino con…»: dagli ingredienti che si hanno («300 g zucchine,
 * ricotta, menta») alle ricette che li usano, del ricettario o dei siti.
 *
 * Il confronto è fra parole, non fra testi: «zucchina» deve trovare
 * «Zucchine», «pomodoro» i «Pomodorini», ma «olio» non le «Olive» e «latte»
 * non la «Lattuga». Ogni parola si riduce alla sua radice togliendo la vocale
 * finale (zucchin-a, zucchin-e), e una radice ne trova un'altra solo se è
 * uguale o se l'altra ha in più un diminutivo (pomodor-in-i).
 */

/** Un ingrediente che si ha, con la quantità se è stata scritta. */
export type WantedIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  /** Le radici delle parole che contano nel nome. */
  words: string[];
};

/** Quello che di un ingrediente della ricetta serve per il confronto. */
export type RecipeIngredientLike = {
  id?: string;
  name: string;
  quantity: number | null;
  unit: string | null;
};

export const MAX_WANTED = 8;
export const MAX_WANTED_TEXT = 300;

/**
 * Il link che la pagina d'import deve importare appena si apre, in
 * `sessionStorage`. Lo scrive solo «Importa» di un risultato dei siti: un
 * link `?url=` arrivato da fuori invece precompila soltanto, senza scaricare
 * niente finché non si tocca il pulsante.
 */
export const IMPORT_NOW_KEY = "ricette.importa-subito";

/** Le parole che non dicono quale ingrediente è. */
const STOP_WORDS = new Set([
  "a", "ad", "al", "alla", "alle", "allo", "ai", "agli", "con", "d", "da", "dal", "dalla", "de", "dei", "del",
  "della", "delle", "dello", "degli", "di", "e", "ed", "gli", "i", "il", "in", "l", "la", "le", "lo", "o", "per",
  "q", "b", "qb", "un", "una", "uno",
]);

/**
 * Gli aggettivi che si scrivono senza pensarci e che le ricette spesso non
 * ripetono: chi ha «parmigiano grattugiato» ha anche il «Parmigiano
 * Reggiano». In forma di radice. «Cotto» e «crudo» restano: il prosciutto
 * cotto non è quello crudo.
 */
const DESCRIPTORS = new Set([
  "fresc", "grattugiat", "tritat", "secc", "inter", "grand", "piccol", "medi", "matur", "affumicat",
  "extravergin", "dop", "igp", "bio", "biologic", "surgelat", "tener",
]);

/**
 * Le basi che in cucina ci sono sempre: non contano fra quello che manca né
 * fra quello che serve in più. Si riconoscono dalla prima parola del nome
 * («Pepe nero», «Olio extravergine d'oliva»).
 */
const STAPLES = new Set(["sal", "pep", "oli", "acqu"]);

/** I diminutivi che una radice può avere in più: pomodor-in-i, cipoll-ott-i, funghett-i. */
const DIMINUTIVES = ["in", "ett", "ott"];

/** La radice di una parola già normalizzata: senza vocale finale e senza la «h» di funghi e secchi. */
function stem(word: string): string {
  if (word.length <= 3) return word;
  return word.replace(/[aeiou]$/, "").replace(/([cg])h$/, "$1");
}

/** Le radici delle parole che contano in un nome di ingrediente. */
export function ingredientWords(name: string): string[] {
  return normalizeForSearch(name)
    .split(/[^a-z]+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .map(stem);
}

/** Le radici di ciò che si ha, senza gli aggettivi di troppo (se resta almeno una parola). */
function wantedWords(name: string): string[] {
  const words = ingredientWords(name);
  const essential = words.filter((word) => !DESCRIPTORS.has(word));
  return [...new Set(essential.length > 0 ? essential : words)];
}

function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  // Sotto le quattro lettere una radice è troppo corta per allungarsi: «ris» non è «risott».
  if (short.length < 4 || !long.startsWith(short)) return false;
  return DIMINUTIVES.includes(long.slice(short.length));
}

/** Se la prima parola del nome è una delle basi: sale, pepe, olio, acqua. */
export function isStaple(name: string): boolean {
  const first = ingredientWords(name)[0];
  return first !== undefined && STAPLES.has(first);
}

/**
 * Gli ingredienti scritti dall'utente, separati da virgole o a capo. Ognuno si
 * legge come una riga dell'elenco della ricetta: «300 g zucchine», «zucchine
 * 300 g», «2 uova». I doppioni si contano una volta sola.
 */
export function parseWanted(text: string): WantedIngredient[] {
  const result: WantedIngredient[] = [];
  const seen = new Set<string>();
  // La virgola fra due cifre è quella dei decimali: «0,3 kg zucchine».
  for (const part of text.slice(0, MAX_WANTED_TEXT).split(/[;\n]|(?<!\d),|,(?!\d)/)) {
    if (!part.trim()) continue;
    const line = parseIngredientLine(part);
    const words = wantedWords(line.name);
    const key = words.join(" ");
    if (words.length === 0 || seen.has(key)) continue;
    seen.add(key);
    result.push({ name: line.name, quantity: line.quantity, unit: line.unit, words });
    if (result.length === MAX_WANTED) break;
  }
  return result;
}

/**
 * Il parametro dell'indirizzo che accende «Solo con tutti gli ingredienti»
 * (`?tutti=1`): la scelta resta nell'indirizzo come gli ingredienti, così si
 * ricarica e si torna indietro senza perderla.
 */
export const ALL_REQUIRED_PARAM = "tutti";

/** Se il valore del parametro accende l'interruttore. */
export function allRequiredFrom(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === "1";
}

/** Il testo con cui si rifà la ricerca: gli ingredienti, uno dopo l'altro. */
export function wantedText(wanted: WantedIngredient[]): string {
  return wanted.map((item) => item.name.toLowerCase()).join(", ");
}

/** Se un ingrediente della ricetta è quello che si ha: tutte le parole di ciò che si ha ci sono. */
export function matchesIngredient(wanted: WantedIngredient, recipeIngredientName: string): boolean {
  const words = ingredientWords(recipeIngredientName);
  return wanted.words.every((word) => words.some((other) => sameStem(word, other)));
}

/**
 * Il nome di un ingrediente da mostrare in un elenco breve. Nei dati dei siti
 * il nome si porta dietro quantità e istruzioni che la lettura della riga non
 * ha separato: «patate 1,2 kg peso da sbucciate» diventa «patate». `null` se
 * non resta niente di sensato («circa»).
 */
export function shortIngredientName(name: string): string | null {
  const short = name
    .split(/\s\d/)[0]
    .split(/[,;:(]|\s(?:oppure|o|circa|a piacere)\s/)[0]
    .replace(/\s+(?:di|del|della|dei|delle|da|e|con|circa)$/i, "")
    .trim();
  return short.length >= 3 && !/^circa$/i.test(short) ? short : null;
}

export type RecipeMatch<I extends RecipeIngredientLike = RecipeIngredientLike> = {
  /** Ciò che si ha, accanto all'ingrediente della ricetta che lo usa. */
  matched: { wanted: WantedIngredient; ingredient: I }[];
  /** Ciò che si ha e che la ricetta non usa (sale, olio e simili esclusi). */
  missing: WantedIngredient[];
  /** I nomi degli ingredienti della ricetta che non si sono scritti, basi escluse. */
  alsoNeeded: string[];
};

export function matchRecipe<I extends RecipeIngredientLike>(wanted: WantedIngredient[], ingredients: I[]): RecipeMatch<I> {
  const matched: RecipeMatch<I>["matched"] = [];
  const missing: WantedIngredient[] = [];
  const used = new Set<I>();

  for (const item of wanted) {
    const ingredient = ingredients.find((candidate) => candidate.name && matchesIngredient(item, candidate.name));
    if (ingredient) {
      matched.push({ wanted: item, ingredient });
      used.add(ingredient);
    } else if (!isStaple(item.name)) {
      missing.push(item);
    }
  }

  const alsoNeeded: string[] = [];
  const seen = new Set<string>();
  for (const ingredient of ingredients) {
    if (!ingredient.name || used.has(ingredient) || isStaple(ingredient.name)) continue;
    if (wanted.some((item) => matchesIngredient(item, ingredient.name))) continue;
    const name = shortIngredientName(ingredient.name);
    const key = name && ingredientWords(name).join(" ");
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    alsoNeeded.push(name);
  }

  return { matched, missing, alsoNeeded };
}

/** Quanti degli ingredienti scritti contano davvero: sale, olio e simili no. */
export function countableWanted(wanted: WantedIngredient[]): number {
  return wanted.filter((item) => !isStaple(item.name)).length;
}

/**
 * Le ricette divise in due gruppi: quelle che usano tutto quello che si ha e,
 * con almeno due ingredienti scritti, quelle a cui ne manca uno. In ogni
 * gruppo prima le ricette che chiedono meno ingredienti in più, poi per
 * titolo. Le altre restano fuori. Con `allRequired` (l'interruttore «Solo con
 * tutti gli ingredienti») il secondo gruppo resta vuoto.
 */
export function rankMatches<T extends { title: string; match: RecipeMatch<RecipeIngredientLike> }>(
  items: T[],
  wanted: WantedIngredient[],
  { allRequired = false }: { allRequired?: boolean } = {},
): { all: T[]; almost: T[] } {
  const countable = countableWanted(wanted);
  if (countable === 0) return { all: [], almost: [] };
  const order = (a: T, b: T) =>
    a.match.alsoNeeded.length - b.match.alsoNeeded.length || a.title.localeCompare(b.title, "it");
  const useful = items.filter((item) => item.match.matched.some((pair) => !isStaple(pair.wanted.name)));
  return {
    all: useful.filter((item) => item.match.missing.length === 0).sort(order),
    almost: countable >= 2 && !allRequired ? useful.filter((item) => item.match.missing.length === 1).sort(order) : [],
  };
}

export type LimitingAmount<I extends RecipeIngredientLike = RecipeIngredientLike> = {
  ingredient: I;
  wanted: WantedIngredient & { quantity: number };
  /** Il fattore che porta la ricetta a quella quantità. */
  factor: number;
};

/**
 * Fra gli ingredienti scritti con una quantità, quello che finisce per primo:
 * con 300 g di zucchine e 1 kg di ricotta, per una ricetta che ne chiede 600 g
 * e 250 g, si fa mezza ricetta. Le unità devono convertirsi: «2 zucchine»
 * contro «500 g» non dice niente.
 */
export function limitingAmount<I extends RecipeIngredientLike>(match: RecipeMatch<I>): LimitingAmount<I> | null {
  let best: LimitingAmount<I> | null = null;
  for (const { wanted, ingredient } of match.matched) {
    if (wanted.quantity === null) continue;
    const factor = factorForAmount(ingredient.quantity, ingredient.unit, wanted.quantity, wanted.unit);
    if (factor === null) continue;
    if (!best || factor < best.factor) best = { ingredient, wanted: { ...wanted, quantity: wanted.quantity }, factor };
  }
  return best;
}

/** Le persone che si sfamano con quello che si ha, se la ricetta dice per quante è. */
export function peopleWith(servings: number | null, limiting: LimitingAmount | null): number | null {
  return limiting ? peopleFor(servings, limiting.factor) : null;
}

/**
 * Oltre questo numero le «porzioni» di una ricetta sono quasi sempre pezzi
 * (24 frittelle, 30 biscotti): dire «basta per 24 persone» sarebbe sbagliato.
 */
const MAX_REAL_SERVINGS = 12;

/**
 * Quanto si fa con quello che si ha, in una frase: «Basta per circa 3
 * persone», o, se la ricetta non dice per quante persone è, «Basta per circa
 * metà ricetta» e «Basta per circa 2 volte la ricetta». `null` se le quantità
 * non dicono niente.
 */
export function amountHint(servings: number | null, limiting: LimitingAmount | null): string | null {
  if (!limiting) return null;
  const factor = limiting.factor;
  if (servings && servings <= MAX_REAL_SERVINGS) {
    const people = peopleFor(servings, factor)!;
    if (people < 1) return "Basta per meno di una persona";
    return `Basta per circa ${formatPeople(people)} ${people === 1 ? "persona" : "persone"}`;
  }
  if (Math.abs(factor - 1) < 0.1) return "Basta per la ricetta intera";
  if (factor > 1) return `Basta per circa ${formatPeople(Math.round(factor * 10) / 10)} volte la ricetta`;
  const fractions: [number, string][] = [
    [1 / 4, "un quarto della"],
    [1 / 3, "un terzo della"],
    [1 / 2, "metà"],
    [2 / 3, "due terzi della"],
    [3 / 4, "tre quarti della"],
  ];
  const [, label] = fractions.reduce((best, entry) => (Math.abs(entry[0] - factor) < Math.abs(best[0] - factor) ? entry : best));
  return factor < 0.2 ? "Basta per poco della ricetta" : `Basta per circa ${label} ricetta`;
}
