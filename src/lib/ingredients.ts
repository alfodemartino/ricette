/**
 * Ingredienti: lettura delle righe scritte a mano o importate («200 g di
 * farina», «Farina 00 200 g», «½ cucchiaino di sale»), unità di misura e
 * ricalcolo delle quantità quando cambiano le porzioni.
 *
 * Tutto qui è puro: lo usano sia il form nel browser («Incolla elenco») sia il
 * server (import da link, salvataggio).
 */

export type IngredientLine = {
  quantity: number | null;
  unit: string | null;
  name: string;
  note: string | null;
};

// ---------------------------------------------------------------------------
// Unità di misura
// ---------------------------------------------------------------------------

/**
 * Le unità riconosciute, con la forma in cui si salvano e quella plurale da
 * mostrare. Le chiavi sono le varianti che si incontrano scritte, tutte in
 * minuscolo e senza il punto finale.
 */
type UnitInfo = { canonical: string; plural: string; metric: boolean };

const UNITS: Record<string, UnitInfo> = {};

function defineUnit(canonical: string, plural: string, metric: boolean, variants: string[]) {
  const info = { canonical, plural, metric };
  for (const variant of [canonical, plural, ...variants]) UNITS[variant] = info;
}

defineUnit("g", "g", true, ["gr", "grammo", "grammi", "grs"]);
defineUnit("kg", "kg", true, ["chilo", "chili", "chilogrammo", "chilogrammi", "kilo"]);
defineUnit("mg", "mg", true, ["milligrammi"]);
defineUnit("ml", "ml", true, ["millilitro", "millilitri"]);
defineUnit("cl", "cl", true, ["centilitro", "centilitri"]);
defineUnit("dl", "dl", true, ["decilitro", "decilitri"]);
defineUnit("l", "l", true, ["lt", "litro", "litri"]);
defineUnit("cucchiaio", "cucchiai", false, ["cucchiaio raso", "cucchiai rasi", "cucchiaio colmo", "cucchiai colmi", "tbsp", "cucch"]);
defineUnit("cucchiaino", "cucchiaini", false, ["tsp", "cucchiaino raso", "cucchiaini rasi"]);
defineUnit("tazza", "tazze", false, ["cup", "cups"]);
defineUnit("tazzina", "tazzine", false, []);
defineUnit("bicchiere", "bicchieri", false, []);
defineUnit("spicchio", "spicchi", false, []);
defineUnit("pizzico", "pizzichi", false, []);
defineUnit("foglia", "foglie", false, ["fogliolina", "foglioline"]);
defineUnit("rametto", "rametti", false, ["rametti"]);
defineUnit("ciuffo", "ciuffi", false, []);
defineUnit("mazzetto", "mazzetti", false, ["mazzo", "mazzi"]);
defineUnit("fetta", "fette", false, ["fettina", "fettine"]);
defineUnit("bustina", "bustine", false, []);
defineUnit("cubetto", "cubetti", false, ["dado", "dadi"]);
defineUnit("manciata", "manciate", false, []);
defineUnit("noce", "noci", false, []);
defineUnit("barattolo", "barattoli", false, []);
defineUnit("vasetto", "vasetti", false, []);
defineUnit("lattina", "lattine", false, []);
defineUnit("confezione", "confezioni", false, ["conf"]);
defineUnit("pacco", "pacchi", false, ["pacchetto", "pacchetti"]);
defineUnit("scatola", "scatole", false, []);
defineUnit("goccia", "gocce", false, []);
defineUnit("filo", "fili", false, []);
defineUnit("costa", "coste", false, []);
defineUnit("gambo", "gambi", false, []);
defineUnit("cespo", "cespi", false, []);
defineUnit("mestolo", "mestoli", false, []);
defineUnit("bicchierino", "bicchierini", false, []);
defineUnit("vaschetta", "vaschette", false, []);
defineUnit("busta", "buste", false, []);
defineUnit("panetto", "panetti", false, []);
defineUnit("foglio", "fogli", false, []);
defineUnit("rotolo", "rotoli", false, []);

/** Le unità da proporre nel form, nell'ordine in cui servono più spesso. */
export const COMMON_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "cucchiaio",
  "cucchiaino",
  "pizzico",
  "spicchio",
  "bicchiere",
  "tazza",
  "foglia",
  "rametto",
  "fetta",
  "bustina",
  "noce",
  "manciata",
];

/** La forma da salvare di un'unità scritta, o `null` se non è un'unità nota. */
export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\.$/, "");
  return UNITS[key]?.canonical ?? null;
}

/**
 * L'unità come si mostra accanto a una quantità: «2 cucchiai», «1 cucchiaio»,
 * «200 g». Un'unità che l'app non conosce resta come è stata scritta.
 */
export function unitLabel(unit: string | null, quantity: number | null): string {
  if (!unit) return "";
  const info = UNITS[unit.toLowerCase()];
  if (!info) return unit;
  if (quantity !== null && quantity > 1) return info.plural;
  return info.canonical;
}

function isMetric(unit: string | null): boolean {
  return unit ? (UNITS[unit.toLowerCase()]?.metric ?? false) : false;
}

// ---------------------------------------------------------------------------
// Quantità
// ---------------------------------------------------------------------------

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅛": 1 / 8,
};

const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("");

/**
 * Una quantità scritta, all'inizio di una riga: «200», «1,5», «1.5», «1/2»,
 * «1 1/2», «½», «1½», e gli intervalli «2-3» (vale il primo numero). Il punto
 * seguito da tre cifre è il separatore delle migliaia: «1.000 g».
 */
const QUANTITY_SOURCE =
  `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+\\s*[${FRACTION_CHARS}]|[${FRACTION_CHARS}]|\\d{1,3}(?:\\.\\d{3})+(?![\\d,])|\\d+(?:[.,]\\d+)?)` +
  `(?:\\s*(?:-|–|÷|o|a)\\s*(?:\\d+(?:[.,]\\d+)?|[${FRACTION_CHARS}]))?`;

/** Converte il testo di una quantità in numero; `null` se non lo è. */
export function parseQuantity(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let text = raw.trim();
  if (!text) return null;

  // Di un intervallo («2-3», «2 o 3») vale il primo numero.
  text = text.split(/\s*(?:-|–|÷|\bo\b|\ba\b)\s*/)[0] ?? text;

  let match = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (match) return safeDivide(Number(match[1]) * Number(match[3]) + Number(match[2]), Number(match[3]));

  match = text.match(/^(\d+)\/(\d+)$/);
  if (match) return safeDivide(Number(match[1]), Number(match[2]));

  match = text.match(new RegExp(`^(\\d*)\\s*([${FRACTION_CHARS}])$`));
  if (match) return (match[1] ? Number(match[1]) : 0) + UNICODE_FRACTIONS[match[2]];

  if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ""));

  if (/^\d+(?:[.,]\d+)?$/.test(text)) return Number(text.replace(",", "."));

  return null;
}

function safeDivide(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

// ---------------------------------------------------------------------------
// Lettura di una riga
// ---------------------------------------------------------------------------

/** Indicazioni che non sono una quantità: diventano la nota dell'ingrediente. */
const TO_TASTE = /\b(q\.?\s?b\.?|quanto basta|a piacere|to taste)(?=\s|$|[,;)])/i;

const UNIT_ALTERNATION = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .map((unit) => unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"))
  .join("|");

const LEADING = new RegExp(
  `^(${QUANTITY_SOURCE})\\s*(?:(${UNIT_ALTERNATION})\\.?(?![\\p{L}]))?\\s*(?:(?:di|d'|d’|of)\\s*)?(.*)$`,
  "iu",
);

const TRAILING = new RegExp(
  `^(.*?)[\\s:,]+(${QUANTITY_SOURCE})\\s*(?:(${UNIT_ALTERNATION})\\.?(?![\\p{L}]))?$`,
  "iu",
);

/** Puntini, trattini, asterischi ed emoji in testa alle righe degli elenchi. */
function stripBullet(line: string): string {
  return line
    .replace(/^[\s•·∙◦▪▫■□●○*+\-–—>✓✔︎☑️🔸🔹▶️➡️]+/u, "")
    .replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "")
    .trim();
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Legge una riga di ingredienti scritta in uno dei modi comuni:
 *
 *  - quantità in testa: «200 g di farina», «2 uova», «½ cucchiaino di sale»;
 *  - quantità in coda, come nei dati di molti siti: «Farina 00 200 g»;
 *  - senza quantità: «Sale q.b.», «Pepe nero a piacere».
 *
 * Il testo fra parentesi diventa la nota: «2 uova (a temperatura ambiente)».
 */
export function parseIngredientLine(raw: string): IngredientLine {
  let text = stripBullet(raw.replace(/\s+/g, " "));
  const notes: string[] = [];

  // Le parentesi: «(circa 3)», «(a temperatura ambiente)».
  text = text
    .replace(/\(([^)]*)\)/g, (_, inner: string) => {
      if (inner.trim()) notes.push(inner.trim());
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  const toTaste = text.match(TO_TASTE);
  if (toTaste) {
    notes.unshift("q.b.");
    text = text.replace(TO_TASTE, " ").replace(/\s+/g, " ").replace(/[\s,;:]+$/, "").trim();
  }

  let quantity: number | null = null;
  let unit: string | null = null;
  let name = text;

  const leading = text.match(LEADING);
  if (leading && leading[3]?.trim()) {
    quantity = parseQuantity(leading[1]);
    unit = normalizeUnit(leading[2]);
    name = leading[3];
  } else if (leading && leading[2]) {
    // «3 noci», «2 spicchi»: la parola che sembrava un'unità è l'ingrediente.
    quantity = parseQuantity(leading[1]);
    name = leading[2];
  } else {
    const trailing = text.match(TRAILING);
    if (trailing && trailing[1]?.trim() && /\p{L}/u.test(trailing[1])) {
      quantity = parseQuantity(trailing[2]);
      unit = normalizeUnit(trailing[3]);
      name = trailing[1];
    }
  }

  name = name.replace(/^(?:di|d'|d’)\s*/i, "").replace(/[\s,;:]+$/, "").trim();

  return {
    quantity,
    unit,
    name: name ? capitalizeFirst(name) : capitalizeFirst(text),
    note: notes.length > 0 ? notes.join(", ") : null,
  };
}

/**
 * Una riga che apre una sottosezione dell'elenco: «Per la crema:»,
 * «PER LA BASE». Restituisce il nome della sezione, oppure `null`.
 */
export function sectionHeading(raw: string): string | null {
  const text = stripBullet(raw).trim();
  if (!text || text.length > 60) return null;
  if (/^\d/.test(text)) return null;
  if (text.endsWith(":")) return capitalizeFirst(text.slice(0, -1).trim().toLowerCase());
  if (/^per (il|lo|la|l'|i|gli|le|un|una)\b/i.test(text) && !/\d/.test(text)) {
    return capitalizeFirst(text.toLowerCase());
  }
  return null;
}

/** Un elenco incollato, una riga per ingrediente, con le eventuali sezioni. */
export type ParsedIngredientList = (IngredientLine & { section: string | null })[];

export function parseIngredientList(text: string): ParsedIngredientList {
  const result: ParsedIngredientList = [];
  let section: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    // L'intestazione dell'elenco stesso, quando la si incolla insieme alle righe.
    if (/^\W*ingredienti\b[^:]*:?\s*$/i.test(line.trim()) && !/\bper (il|lo|la|l'|i|gli|le)\b/i.test(line)) continue;
    const heading = sectionHeading(line);
    if (heading) {
      section = heading;
      continue;
    }
    const parsed = parseIngredientLine(line);
    if (parsed.name) result.push({ ...parsed, section });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Porzioni e formattazione
// ---------------------------------------------------------------------------

/** La quantità per un numero diverso di porzioni. */
export function scaleQuantity(quantity: number | null, from: number | null, to: number | null): number | null {
  if (quantity === null) return null;
  if (!from || !to || from <= 0 || to <= 0) return quantity;
  return (quantity * to) / from;
}

const NICE_FRACTIONS: [number, string][] = [
  [0, ""],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [1, ""],
];

function decimalComma(value: number, digits: number): string {
  return Number(value.toFixed(digits)).toLocaleString("it-IT", {
    maximumFractionDigits: digits,
    useGrouping: false,
  });
}

/**
 * Una quantità come la scriverebbe una persona.
 *
 *  - Grammi e millilitri si arrotondano come su una bilancia: a 5 sopra i
 *    100, all'unità sopra i 10. Nessuno pesa 333,33 g di farina.
 *  - Chili e litri tengono al massimo due decimali, con la virgola.
 *  - Tutto il resto (uova, cucchiai, spicchi) usa le frazioni di casa — ½, ⅓,
 *    ¾ — quando ci si avvicina, altrimenti un decimale.
 */
export function formatQuantity(quantity: number | null, unit: string | null = null): string {
  if (quantity === null || !Number.isFinite(quantity)) return "";
  if (quantity <= 0) return "0";

  const canonical = unit?.toLowerCase() ?? null;
  if (isMetric(canonical)) {
    if (canonical === "g" || canonical === "ml" || canonical === "mg") {
      if (quantity >= 100) return String(Math.round(quantity / 5) * 5);
      if (quantity >= 10) return String(Math.round(quantity));
      return decimalComma(quantity, 1);
    }
    return decimalComma(quantity, 2);
  }

  const whole = Math.floor(quantity);
  const rest = quantity - whole;
  for (const [value, glyph] of NICE_FRACTIONS) {
    if (Math.abs(rest - value) < 0.04) {
      const integer = value === 1 ? whole + 1 : whole;
      if (!glyph) return String(integer);
      return integer === 0 ? glyph : `${integer}${glyph}`;
    }
  }
  return quantity >= 10 ? String(Math.round(quantity)) : decimalComma(quantity, 1);
}

/** Il testo da mettere nella casella della quantità del form. */
export function quantityInput(quantity: number | null): string {
  if (quantity === null) return "";
  return decimalComma(quantity, 3);
}
