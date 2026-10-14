"use client";

import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  convertibleUnits,
  factorForAmount,
  factorForPeople,
  formatPeople,
  formatQuantity,
  isOriginalScale,
  parseAmount,
  peopleFor,
  quantityInput,
  scaleQuantity,
  stepPeople,
  unitLabel,
} from "@/lib/ingredients";

type Ingredient = {
  id: string;
  section: string | null;
  quantity: number | null;
  unit: string | null;
  name: string;
  note: string | null;
};

type Step = { id: string; section: string | null; text: string };

/** Raggruppa le righe consecutive con la stessa sezione. */
function bySection<T extends { section: string | null }>(items: T[]): { section: string | null; items: T[] }[] {
  const groups: { section: string | null; items: T[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }
  return groups;
}

/** La freccia che torna indietro di iOS, per riportare le persone a quelle della ricetta. */
function ResetIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M4.5 8.5a6 6 0 1 1 .8 5" />
      <path d="M4 4v4.5h4.5" />
    </svg>
  );
}

/**
 * Di quanto sono ricalcolate le quantità nella pagina. Il fattore lo
 * scelgono le persone o un ingrediente; `anchor` è l'ingrediente da cui si è
 * partiti, che mostra la quantità esatta scritta invece di quella arrotondata,
 * nell'unità in cui è stata scritta.
 */
type Scale = { factor: number; anchor: { id: string; quantity: number; unit: string | null } | null };

const ORIGINAL: Scale = { factor: 1, anchor: null };

/**
 * Il ricalcolo scelto nella pagina della ricetta. Sta sopra la sezione degli
 * ingredienti perché serve anche a «Condividi», in testata: il messaggio
 * parte con le quantità che si stanno guardando.
 */
const ScaleContext = createContext<[Scale, Dispatch<SetStateAction<Scale>>] | null>(null);

export function RecipeScale({ children }: { children: ReactNode }) {
  const scale = useState(ORIGINAL);
  return <ScaleContext.Provider value={scale}>{children}</ScaleContext.Provider>;
}

/** Il fattore scelto nella pagina; 1 per la ricetta com'è scritta. */
export function useRecipeFactor(): number {
  return useContext(ScaleContext)?.[0].factor ?? 1;
}

/**
 * Lo stepper di iOS: meno e più in una pista grigia, il numero in mezzo. Le
 * persone hanno la virgola quando il ricalcolo viene da un ingrediente.
 */
export function PeopleStepper({ value, onChange }: { value: number; onChange: (people: number) => void }) {
  return (
    <div className="flex items-center rounded-control bg-fill">
      <button
        type="button"
        aria-label="Una persona in meno"
        disabled={value <= 1}
        onClick={() => onChange(stepPeople(value, -1))}
        className="flex size-9 items-center justify-center text-[20px] text-tint disabled:opacity-30"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-7 text-center text-[15px] font-semibold text-label tabular-nums">
        {formatPeople(value)}
      </span>
      <button
        type="button"
        aria-label="Una persona in più"
        disabled={value >= 99}
        onClick={() => onChange(stepPeople(value, 1))}
        className="flex size-9 items-center justify-center text-[20px] text-tint disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

type Amount = { quantity: number; unit: string | null };

/**
 * La casella che prende il posto della quantità toccata. Accanto, quando
 * l'ingrediente è a peso o a volume, la scelta dell'unità: le patate segnate
 * «1 kg» si possono pesare in grammi. Anche l'unità scritta nella casella
 * («600 g») vale. Invio o un tocco fuori applicano, Esc annulla; una quantità
 * che non si legge (vuota, zero, «tanto», un'unità che non c'entra) lascia
 * tutto com'era.
 */
function QuantityEditor({
  name,
  initial,
  initialUnit,
  units,
  onDone,
}: {
  name: string;
  initial: string;
  initialUnit: string | null;
  /** Le unità in cui si può scrivere la quantità; una sola se non si converte. */
  units: (string | null)[];
  onDone: (amount: Amount | null) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState(initialUnit);
  // Invio chiude la casella, e la casella che sparisce perde il fuoco: si
  // applica una volta sola.
  const finished = useRef(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  function finish(amount: Amount | null) {
    if (finished.current) return;
    finished.current = true;
    onDone(amount);
  }

  /** Quello che c'è scritto, nell'unità scritta o, se manca, in quella scelta accanto. */
  function written(): Amount | null {
    const parsed = parseAmount(input.current?.value);
    return parsed ? { quantity: parsed.quantity, unit: parsed.unit ?? unit } : null;
  }

  return (
    <form
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        finish(written());
      }}
      // Si applica quando il fuoco esce dalla casella e dalla scelta dell'unità,
      // non quando passa dall'una all'altra.
      onBlur={(event) => {
        if (!form.current?.contains(event.relatedTarget)) finish(written());
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") finish(null);
      }}
      className="flex shrink-0 items-center gap-1.5"
    >
      {/* 16 px: sotto, Safari ingrandisce la pagina quando la casella prende il fuoco. */}
      <input
        ref={input}
        defaultValue={initial}
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        aria-label={`Quantità di ${name}`}
        className="w-20 rounded-control border border-tint bg-fill px-2 py-1 text-right text-base font-medium text-label tabular-nums outline-none focus:ring-2 focus:ring-tint/25"
      />
      {units.length > 1 ? (
        <select
          value={unit ?? ""}
          aria-label={`Unità di ${name}`}
          onChange={(event) => {
            setUnit(event.target.value);
            // Si torna al numero: Invio sulla tastiera applica.
            input.current?.focus();
          }}
          className="rounded-control bg-fill px-1.5 py-1 text-base font-medium text-label outline-none focus:ring-2 focus:ring-tint/25"
        >
          {units.map((option) => (
            <option key={option} value={option ?? ""}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        unit && <span className="font-medium">{unitLabel(unit, parseAmount(initial)?.quantity ?? null)}</span>
      )}
    </form>
  );
}

/** «300 g di farina», «2 uova»: l'ingrediente da cui è partito il ricalcolo, dentro una frase. */
function anchorText(quantity: number, unit: string | null, name: string): string {
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  const amount = quantityInput(quantity);
  return unit ? `${amount} ${unitLabel(unit, quantity)} di ${lower}` : `${amount} ${lower}`;
}

/** «persona» o «persone»: 2,4 persone, ma anche 0,6 persone. */
function peopleLabel(people: number): string {
  return `${formatPeople(people)} ${people === 1 ? "persona" : "persone"}`;
}

/**
 * La sezione «Ingredienti» con il ricalcolo delle quantità: dalle persone,
 * con lo stepper, o da un ingrediente, toccandone la quantità («ho solo 300 g
 * di farina»). Il ricalcolo è tutto nel browser: non tocca la ricetta salvata.
 */
export function IngredientsSection({ ingredients, servings }: { ingredients: Ingredient[]; servings: number | null }) {
  // Il ricalcolo è quello della pagina, se c'è `RecipeScale`; altrimenti della sezione.
  const shared = useContext(ScaleContext);
  const own = useState(ORIGINAL);
  const [scale, setScale] = shared ?? own;
  const [editing, setEditing] = useState<string | null>(null);

  const people = peopleFor(servings, scale.factor);
  const scaled = !isOriginalScale(scale.factor);
  const anchor = scale.anchor ? ingredients.find((item) => item.id === scale.anchor?.id) : undefined;
  const canEdit = ingredients.some((item) => item.quantity !== null && item.quantity > 0);

  const resetButton = scaled && (
    <button
      type="button"
      aria-label={servings ? `Torna a ${peopleLabel(servings)}` : "Torna alle quantità della ricetta"}
      title="Ripristina le quantità della ricetta"
      onClick={() => setScale(ORIGINAL)}
      className="flex size-9 items-center justify-center rounded-full text-tint transition hover:bg-fill"
    >
      <ResetIcon className="size-[18px]" />
    </button>
  );

  return (
    <section className="flex flex-col">
      <header className="mb-2 flex min-h-9 flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Ingredienti</h2>
        {servings && people !== null ? (
          <div className="flex items-center gap-2 text-[13px] text-label-secondary">
            {resetButton}
            <span>Persone</span>
            <PeopleStepper value={people} onChange={(next) => setScale({ factor: factorForPeople(servings, next), anchor: null })} />
          </div>
        ) : (
          resetButton
        )}
      </header>

      <div className="rounded-card bg-surface">
        {ingredients.length === 0 ? (
          <p className="px-4 py-6 text-center text-[15px] text-label-secondary">Nessun ingrediente indicato.</p>
        ) : (
          bySection(ingredients).map((group, index) => (
            <div key={index}>
              {group.section && (
                <h3 className="px-4 pt-4 pb-1 text-[13px] font-semibold tracking-wide text-label-secondary uppercase">
                  {group.section}
                </h3>
              )}
              <ul className="divide-y divide-separator">
                {group.items.map((item) => {
                  // L'ingrediente da cui si è partiti tiene la quantità scritta, senza arrotondarla.
                  // Anche nell'unità in cui è stata scritta: «600 g» di patate segnate in chili.
                  const itemAnchor = scale.anchor?.id === item.id ? scale.anchor : null;
                  const quantity = itemAnchor ? itemAnchor.quantity : scaleQuantity(item.quantity, scale.factor);
                  const quantityUnit = itemAnchor ? itemAnchor.unit : item.unit;
                  const shown = itemAnchor ? quantityInput(itemAnchor.quantity) : formatQuantity(quantity, item.unit);
                  const amount = [shown, unitLabel(quantityUnit, quantity)].filter(Boolean).join(" ");
                  const editable = item.quantity !== null && item.quantity > 0;
                  return (
                    <li key={item.id} className="flex min-h-11 items-center justify-between gap-4 px-4 py-1.5 text-[15px]">
                      <span className="py-1">
                        {item.name}
                        {item.note && <span className="text-label-secondary"> · {item.note}</span>}
                      </span>
                      {editing === item.id ? (
                        <QuantityEditor
                          name={item.name}
                          initial={shown}
                          initialUnit={quantityUnit}
                          units={convertibleUnits(item.unit)}
                          onDone={(wanted) => {
                            setEditing(null);
                            if (!wanted) return;
                            const factor = factorForAmount(item.quantity, item.unit, wanted.quantity, wanted.unit);
                            if (factor === null) return;
                            setScale(isOriginalScale(factor) ? ORIGINAL : { factor, anchor: { id: item.id, ...wanted } });
                          }}
                        />
                      ) : editable ? (
                        <button
                          type="button"
                          aria-label={`${item.name}: ${amount}. Cambia la quantità per ricalcolare le altre`}
                          onClick={() => setEditing(item.id)}
                          className={`-mr-2 shrink-0 rounded-control px-2 py-1 font-medium text-tint tabular-nums transition hover:bg-fill ${
                            itemAnchor ? "bg-tint/15" : ""
                          }`}
                        >
                          {amount}
                        </button>
                      ) : (
                        amount && <span className="shrink-0 font-medium tabular-nums">{amount}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
      {scaled && anchor && scale.anchor ? (
        <p className="mt-2 px-1 text-[12px] text-label-secondary">
          Quantità ricalcolate partendo da{" "}
          {anchorText(scale.anchor.quantity, scale.anchor.unit, anchor.name)}
          {people !== null && `: bastano per ${peopleLabel(people)}`}.
        </p>
      ) : scaled && servings && people !== null ? (
        <p className="mt-2 px-1 text-[12px] text-label-secondary">
          Quantità ricalcolate da {servings} a {peopleLabel(people)}.
        </p>
      ) : (
        canEdit && <p className="mt-2 px-1 text-[12px] text-label-secondary">Tocca una quantità per ricalcolare le altre.</p>
      )}
    </section>
  );
}

/**
 * La sezione «Procedimento». Toccare un passo lo segna come fatto: serve in
 * cucina, con le mani in pasta, per non perdere il segno.
 */
export function StepsSection({ steps }: { steps: Step[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  let number = 0;

  return (
    <section className="flex flex-col">
      <header className="mb-2 px-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Procedimento</h2>
      </header>
      <div className="rounded-card bg-surface">
        {steps.length === 0 ? (
          <p className="px-4 py-6 text-center text-[15px] text-label-secondary">Nessun passo indicato.</p>
        ) : (
          bySection(steps).map((group, index) => (
            <div key={index}>
              {group.section && (
                <h3 className="px-4 pt-4 pb-1 text-[13px] font-semibold tracking-wide text-label-secondary uppercase">
                  {group.section}
                </h3>
              )}
              <ol className="divide-y divide-separator">
                {group.items.map((step) => {
                  number += 1;
                  const isDone = done.has(step.id);
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        aria-pressed={isDone}
                        onClick={() =>
                          setDone((current) => {
                            const next = new Set(current);
                            if (next.has(step.id)) next.delete(step.id);
                            else next.add(step.id);
                            return next;
                          })
                        }
                        className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-fill"
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                            isDone ? "bg-positive text-white" : "bg-tint/15 text-tint"
                          }`}
                        >
                          {isDone ? "✓" : number}
                        </span>
                        <span className={`text-[15px] leading-relaxed whitespace-pre-line ${isDone ? "text-label-tertiary line-through" : ""}`}>
                          {step.text}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))
        )}
      </div>
      {steps.length > 0 && <p className="mt-2 px-1 text-[12px] text-label-secondary">Tocca un passo per segnarlo come fatto.</p>}
    </section>
  );
}
