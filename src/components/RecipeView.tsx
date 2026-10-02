"use client";

import { useState } from "react";
import { formatQuantity, scaleQuantity, unitLabel } from "@/lib/ingredients";

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

/**
 * La sezione «Ingredienti» con il selettore delle porzioni. Il ricalcolo è
 * tutto nel browser: cambiare le persone non tocca la ricetta salvata.
 */
export function IngredientsSection({ ingredients, servings }: { ingredients: Ingredient[]; servings: number | null }) {
  const [people, setPeople] = useState(servings ?? 0);
  const canScale = servings !== null && servings > 0;

  return (
    <section className="flex flex-col">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Ingredienti</h2>
        {canScale && (
          // Lo stepper di iOS: meno e più in una pista grigia, il numero in mezzo.
          <div className="flex items-center gap-2 text-[13px] text-label-secondary">
            <span>Persone</span>
            <div className="flex items-center rounded-control bg-fill">
              <button
                type="button"
                aria-label="Una persona in meno"
                disabled={people <= 1}
                onClick={() => setPeople((count) => Math.max(1, count - 1))}
                className="flex size-9 items-center justify-center text-[20px] text-tint disabled:opacity-30"
              >
                −
              </button>
              <span aria-live="polite" className="min-w-7 text-center text-[15px] font-semibold text-label tabular-nums">
                {people}
              </span>
              <button
                type="button"
                aria-label="Una persona in più"
                disabled={people >= 99}
                onClick={() => setPeople((count) => Math.min(99, count + 1))}
                className="flex size-9 items-center justify-center text-[20px] text-tint disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
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
                  const quantity = canScale ? scaleQuantity(item.quantity, servings, people) : item.quantity;
                  const amount = [formatQuantity(quantity, item.unit), unitLabel(item.unit, quantity)].filter(Boolean).join(" ");
                  return (
                    <li key={item.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-[15px]">
                      <span>
                        {item.name}
                        {item.note && <span className="text-label-secondary"> · {item.note}</span>}
                      </span>
                      {amount && <span className="shrink-0 font-medium tabular-nums">{amount}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
      {canScale && people !== servings && (
        <p className="mt-2 px-1 text-[12px] text-label-secondary">
          Quantità ricalcolate da {servings} a {people} {people === 1 ? "persona" : "persone"}.{" "}
          <button type="button" onClick={() => setPeople(servings)} className="text-tint hover:underline">
            Ripristina
          </button>
        </p>
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
