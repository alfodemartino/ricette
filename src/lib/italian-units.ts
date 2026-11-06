import { parseIngredientLine, type IngredientLine } from "@/lib/ingredients";

/**
 * Dalle misure americane a quelle di una cucina italiana: tazze, once e
 * libbre diventano grammi e millilitri, i gradi Fahrenheit diventano Celsius.
 *
 * La conversione cambia i dati, non solo quello che si mostra: da lì in poi
 * porzioni, ricalcolo da un ingrediente, «Condividi» e «Cosa cucino con…»
 * lavorano su unità che conoscono. Per questo si fa quando una bozza nasce
 * (import, «Incolla elenco») o con il pulsante del form: in ogni caso prima
 * che l'utente abbia controllato e salvato.
 *
 * Cucchiai e cucchiaini restano: li ha anche la cucina italiana, e valgono
 * come quelli americani.
 */

/** Quanti grammi pesa ogni unità di peso. */
const WEIGHT_UNITS: Record<string, number> = { oz: 28.35, lb: 453.6 };

/** Quanti millilitri contiene ogni unità di volume: la tazza è quella americana. */
const CUP_ML = 240;
const VOLUME_UNITS: Record<string, number> = { tazza: CUP_ML, "fl oz": 30, pint: 473, quart: 946, gallon: 3785 };

/** Quello che non si pesa, anche se il nome contiene una parola della tabella: «rice vinegar», «oat milk». */
const LIQUIDS = /\b(milk|latte|water|acqua|vinegar|aceto|syrup|sciroppo|broth|brodo|sauce|salsa|oil|olio|juice|succo|wine|vino)\b/i;

/**
 * Quanti grammi pesa una tazza degli ingredienti che in Italia si pesano.
 * Vale la prima voce che corrisponde, quindi quelle più precise vengono prima.
 * I nomi sono nelle due lingue, perché l'import non li traduce.
 */
const CUP_WEIGHTS: [RegExp, number][] = [
  [/almond flour|almond meal|farina di mandorle/i, 96],
  [/whole wheat flour|wholemeal flour|farina integrale/i, 120],
  [/corn ?starch|corn ?flour|amido di mais|maizena/i, 128],
  [/corn ?meal|farina di mais|polenta/i, 150],
  [/\b(semolina|semola)\b/i, 170],
  [/\b(flour|farina)\b/i, 125],
  [/powdered sugar|icing sugar|confectioners.? sugar|zucchero a velo/i, 120],
  [/brown sugar|zucchero di canna/i, 210],
  [/\bsugar\b(?! snap)|\bzucchero\b/i, 200],
  [/peanut butter|burro di arachidi/i, 260],
  [/\b(butter|burro)\b/i, 227],
  [/\b(cocoa|cacao)\b/i, 85],
  [/chocolate chips|gocce di cioccolato/i, 170],
  [/\b(oats|oatmeal|avena)\b/i, 90],
  [/\b(rice|riso)\b/i, 185],
  [/bread ?crumbs|panko|pangrattato/i, 110],
  [/\b(parmesan|parmigiano)\b/i, 100],
  [/\b(honey|miele)\b/i, 340],
];

/** I grammi di una tazza di questo ingrediente; `null` se non si sa o se è un liquido. */
function cupWeight(name: string): number | null {
  if (LIQUIDS.test(name)) return null;
  return CUP_WEIGHTS.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

/**
 * Una quantità in grammi o millilitri, arrotondata come su una bilancia. Da
 * mille in su si passa a chili e litri: nessuno scrive 1360 g di patate.
 */
function metricAmount(value: number, unit: "g" | "ml"): { quantity: number; unit: string } {
  if (value >= 1000) return { quantity: (Math.round(value / 50) * 50) / 1000, unit: unit === "g" ? "kg" : "l" };
  if (value >= 100) return { quantity: Math.round(value / 5) * 5, unit };
  if (value >= 10) return { quantity: Math.round(value), unit };
  return { quantity: Math.round(value * 10) / 10, unit };
}

/**
 * «Oz Cherry tomatoes»: prima che le once fossero un'unità nota, la parola
 * restava nel nome. Così erano salvate le ricette già importate.
 */
function withUnitFromName(line: IngredientLine): IngredientLine {
  if (line.unit || line.quantity === null) return line;
  const { unit, name } = parseIngredientLine(`1 ${line.name}`);
  return unit && (unit in WEIGHT_UNITS || unit in VOLUME_UNITS) ? { ...line, unit, name } : line;
}

/**
 * Una riga di ingrediente in unità italiane; la stessa riga, se non c'è niente
 * da convertire. Una tazza è un volume: diventa grammi quando l'ingrediente è
 * nella tabella, e la nota dice quanto si è contato per tazza, perché è una
 * stima e così si può correggere. La nota è un testo e non segue le porzioni:
 * per questo non riporta la quantità della ricetta. Altrimenti la tazza
 * diventa millilitri, che vanno bene anche per ciò che non si versa: un
 * misurino c'è in ogni cucina, la tazza americana no.
 */
export function toItalianUnits(line: IngredientLine): IngredientLine {
  const source = withUnitFromName(line);
  const { quantity, unit } = source;
  if (quantity === null || quantity <= 0 || !unit) return line;

  const grams = unit in WEIGHT_UNITS ? WEIGHT_UNITS[unit] : null;
  if (grams !== null) return { ...source, ...metricAmount(quantity * grams, "g") };

  if (!(unit in VOLUME_UNITS)) return line;
  const cupGrams = unit === "tazza" ? cupWeight(source.name) : null;
  if (cupGrams === null) return { ...source, ...metricAmount(quantity * VOLUME_UNITS[unit], "ml") };

  return {
    ...source,
    ...metricAmount(quantity * cupGrams, "g"),
    note: [source.note, `stima: 1 tazza = ${cupGrams} g`].filter(Boolean).join(", "),
  };
}

const DEGREE = "(?:°|º|˚|degrees?\\s*|gradi\\s*)";
const FAHRENHEIT = `(?:(\\d{2,3})\\s*[-–]\\s*)?(\\d{2,3})(?:\\s*${DEGREE}\\s*F(?:ahrenheit)?\\b|(?<=\\d{3})F\\b)`;
const CELSIUS = `(\\d{2,3})\\s*${DEGREE}?\\s*C(?:elsius)?\\b`;

/** «400°F (200°C)» e «400°F / 200°C»: il sito ha già fatto il conto, e vale il suo. */
const FAHRENHEIT_THEN_CELSIUS = new RegExp(`${FAHRENHEIT}\\s*(?:\\(\\s*${CELSIUS}\\s*\\)|\\/\\s*${CELSIUS})`, "gi");
/** «200°C (400°F)» e «200°C / 400°F». */
const CELSIUS_THEN_FAHRENHEIT = new RegExp(`${CELSIUS}\\s*(?:\\(\\s*${FAHRENHEIT}\\s*\\)|\\/\\s*${FAHRENHEIT})`, "gi");
const ONLY_FAHRENHEIT = new RegExp(FAHRENHEIT, "gi");

/** I forni si regolano a decine: 350 °F sono i 180 °C di ogni ricettario, non 177. */
function celsius(fahrenheit: string): number {
  const value = ((Number(fahrenheit) - 32) * 5) / 9;
  return Number(fahrenheit) >= 200 ? Math.round(value / 10) * 10 : Math.round(value);
}

/** Il testo di un passo con le temperature in gradi Celsius. */
export function celsiusInText(text: string): string {
  return text
    .replace(FAHRENHEIT_THEN_CELSIUS, (_, _from, _to, inParens, afterSlash) => `${inParens ?? afterSlash} °C`)
    .replace(CELSIUS_THEN_FAHRENHEIT, (_, value) => `${value} °C`)
    .replace(ONLY_FAHRENHEIT, (_, from, to) => `${from ? `${celsius(from)}-` : ""}${celsius(to)} °C`);
}
