"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, buttonClass, Field, inputClass, Input, PhotoCredit, Select, Textarea } from "@/components/ui";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import { CATEGORIES } from "@/lib/categories";
import { COMMON_UNITS, parseIngredientList, quantityInput } from "@/lib/ingredients";
import {
  emptyIngredient,
  emptyStep,
  MAX_TITLE_LENGTH,
  stepRowsFromText,
  type IngredientRow,
  type RecipeDraft,
  type StepRow,
} from "@/lib/recipe-draft";
import { siteName } from "@/lib/site";
import { cleanTagName, tagKey } from "@/lib/tags";

/**
 * Il form della ricetta: lo stesso per una ricetta nuova, per una da
 * modificare e per una appena importata da un link.
 *
 * Tutto lo stato sta qui, in React, e parte verso il server come un JSON nel
 * campo nascosto `payload`; la foto viaggia a parte, come file. Così le righe
 * di ingredienti e passi si aggiungono, spostano e tolgono senza dare un nome
 * a ogni casella.
 */

type WithUid<T> = T & { uid: string };

let counter = 0;
const uid = () => `riga-${(counter += 1)}`;
const withUid = <T,>(row: T): WithUid<T> => ({ ...row, uid: uid() });

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

/** Una riga vuota in fondo non è una riga: si toglie prima di aggiungere quelle incollate. */
function withoutTrailingEmpty<T extends { kind: string }>(rows: T[], isEmpty: (row: T) => boolean): T[] {
  const copy = [...rows];
  while (copy.length > 0 && isEmpty(copy[copy.length - 1])) copy.pop();
  return copy;
}

const isEmptyIngredient = (row: IngredientRow) =>
  row.kind === "item" && !row.name.trim() && !row.quantity.trim() && !row.unit.trim() && !row.note.trim();
const isEmptyStep = (row: StepRow) => row.kind === "item" && !row.text.trim();

function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section>
      <header className="mb-2 px-1">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-label-secondary">{description}</p>}
      </header>
      <div className="rounded-card bg-surface p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** I pulsanti piccoli per spostare e togliere una riga. */
function RowTools({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
  label: string;
}) {
  const tool = "flex size-9 items-center justify-center rounded-full text-label-secondary transition hover:bg-fill disabled:opacity-25";
  return (
    // Sul telefono i tre pulsanti stanno in colonna: affiancati si
    // prenderebbero un terzo della riga e le caselle resterebbero strette.
    <div className="flex shrink-0 flex-col items-center sm:flex-row">
      <button type="button" className={tool} aria-label={`Sposta su ${label}`} disabled={index === 0} onClick={() => onMove(-1)}>
        ↑
      </button>
      <button type="button" className={tool} aria-label={`Sposta giù ${label}`} disabled={index === count - 1} onClick={() => onMove(1)}>
        ↓
      </button>
      <button type="button" className={`${tool} text-negative`} aria-label={`Togli ${label}`} onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

function IngredientsEditor({
  rows,
  setRows,
}: {
  rows: WithUid<IngredientRow>[];
  setRows: (update: (rows: WithUid<IngredientRow>[]) => WithUid<IngredientRow>[]) => void;
}) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const update = (index: number, patch: Partial<IngredientRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? ({ ...row, ...patch } as WithUid<IngredientRow>) : row)));

  return (
    <div className="space-y-3">
      <datalist id="unita-comuni">
        {COMMON_UNITS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>

      <ul className="space-y-3">
        {rows.map((row, index) =>
          row.kind === "heading" ? (
            <li key={row.uid} className="flex items-center gap-2 border-t border-separator pt-3 first:border-0 first:pt-0">
              <Input
                value={row.title}
                onChange={(event) => update(index, { title: event.target.value })}
                placeholder="Nome della sottosezione (es. Per la crema)"
                aria-label="Sottosezione"
                className="font-semibold"
              />
              <RowTools
                index={index}
                count={rows.length}
                label="la sottosezione"
                onMove={(delta) => setRows((current) => move(current, index, delta))}
                onRemove={() => setRows((current) => current.filter((_, i) => i !== index))}
              />
            </li>
          ) : (
            <li key={row.uid} className="flex items-start gap-2">
              {/* Sul telefono quantità e unità stanno sopra al nome: in una riga
                  sola le caselle sarebbero troppo strette per scriverci. */}
              <div className="grid flex-1 grid-cols-[5rem_6.5rem_1fr] gap-2 max-sm:grid-cols-2">
                <input
                  value={row.quantity}
                  onChange={(event) => update(index, { quantity: event.target.value })}
                  placeholder="Q.tà"
                  aria-label="Quantità"
                  inputMode="decimal"
                  className={inputClass}
                />
                <input
                  value={row.unit}
                  onChange={(event) => update(index, { unit: event.target.value })}
                  placeholder="Unità"
                  aria-label="Unità di misura"
                  list="unita-comuni"
                  autoCapitalize="off"
                  className={inputClass}
                />
                <input
                  value={row.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  placeholder="Ingrediente"
                  aria-label="Ingrediente"
                  className={`${inputClass} max-sm:col-span-2`}
                />
                <input
                  value={row.note}
                  onChange={(event) => update(index, { note: event.target.value })}
                  placeholder="Nota (es. q.b., a temperatura ambiente)"
                  aria-label="Nota"
                  className={`${inputClass} col-span-3 py-2 text-[15px] max-sm:col-span-2`}
                />
              </div>
              <RowTools
                index={index}
                count={rows.length}
                label="l'ingrediente"
                onMove={(delta) => setRows((current) => move(current, index, delta))}
                onRemove={() => setRows((current) => current.filter((_, i) => i !== index))}
              />
            </li>
          ),
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass("secondary", "", "sm")} onClick={() => setRows((current) => [...current, withUid(emptyIngredient())])}>
          + Ingrediente
        </button>
        <button
          type="button"
          className={buttonClass("ghost", "", "sm")}
          onClick={() => setRows((current) => [...current, withUid({ kind: "heading", title: "" }), withUid(emptyIngredient())])}
        >
          + Sottosezione
        </button>
        <button type="button" className={buttonClass("ghost", "", "sm")} onClick={() => setPasting((open) => !open)}>
          Incolla elenco
        </button>
      </div>

      {pasting && (
        <div className="space-y-2 rounded-control bg-fill p-3">
          <Textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={"Un ingrediente per riga, per esempio:\n200 g di farina\n2 uova\nSale q.b."}
            aria-label="Elenco di ingredienti da incollare"
            className="min-h-32 bg-surface"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonClass("primary", "", "sm")}
              disabled={!pasted.trim()}
              onClick={() => {
                const parsed = parseIngredientList(pasted);
                const added: WithUid<IngredientRow>[] = [];
                let section: string | null = null;
                for (const item of parsed) {
                  if (item.section !== section && item.section) added.push(withUid({ kind: "heading", title: item.section }));
                  section = item.section;
                  added.push(
                    withUid({ kind: "item", quantity: quantityInput(item.quantity), unit: item.unit ?? "", name: item.name, note: item.note ?? "" }),
                  );
                }
                setRows((current) => [...withoutTrailingEmpty(current, isEmptyIngredient), ...added]);
                setPasted("");
                setPasting(false);
              }}
            >
              Aggiungi all&apos;elenco
            </button>
            <button type="button" className={buttonClass("ghost", "", "sm")} onClick={() => setPasting(false)}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepsEditor({
  rows,
  setRows,
}: {
  rows: WithUid<StepRow>[];
  setRows: (update: (rows: WithUid<StepRow>[]) => WithUid<StepRow>[]) => void;
}) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  let number = 0;

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {rows.map((row, index) => {
          if (row.kind === "item") number += 1;
          return (
            <li key={row.uid} className="flex items-start gap-2">
              {row.kind === "heading" ? (
                <Input
                  value={row.title}
                  onChange={(event) =>
                    setRows((current) => current.map((r, i) => (i === index ? { ...r, title: event.target.value } : r)))
                  }
                  placeholder="Nome della sottosezione (es. La crema)"
                  aria-label="Sottosezione"
                  className="font-semibold"
                />
              ) : (
                <>
                  <span className="mt-2.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-tint/15 text-[13px] font-semibold text-tint">
                    {number}
                  </span>
                  <textarea
                    value={row.text}
                    onChange={(event) =>
                      setRows((current) => current.map((r, i) => (i === index ? { ...r, text: event.target.value } : r)))
                    }
                    placeholder="Descrivi questo passaggio"
                    aria-label={`Passo ${number}`}
                    rows={2}
                    className={`${inputClass} min-h-20 [field-sizing:content]`}
                  />
                </>
              )}
              <RowTools
                index={index}
                count={rows.length}
                label={row.kind === "heading" ? "la sottosezione" : `il passo ${number}`}
                onMove={(delta) => setRows((current) => move(current, index, delta))}
                onRemove={() => setRows((current) => current.filter((_, i) => i !== index))}
              />
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass("secondary", "", "sm")} onClick={() => setRows((current) => [...current, withUid(emptyStep())])}>
          + Passo
        </button>
        <button
          type="button"
          className={buttonClass("ghost", "", "sm")}
          onClick={() => setRows((current) => [...current, withUid({ kind: "heading", title: "" }), withUid(emptyStep())])}
        >
          + Sottosezione
        </button>
        <button type="button" className={buttonClass("ghost", "", "sm")} onClick={() => setPasting((open) => !open)}>
          Incolla testo
        </button>
      </div>

      {pasting && (
        <div className="space-y-2 rounded-control bg-fill p-3">
          <Textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={"Un passo per riga; i numeri all'inizio si tolgono da soli."}
            aria-label="Procedimento da incollare"
            className="min-h-32 bg-surface"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonClass("primary", "", "sm")}
              disabled={!pasted.trim()}
              onClick={() => {
                const added = stepRowsFromText(pasted).map(withUid);
                setRows((current) => [...withoutTrailingEmpty(current, isEmptyStep), ...added]);
                setPasted("");
                setPasting(false);
              }}
            >
              Aggiungi al procedimento
            </button>
            <button type="button" className={buttonClass("ghost", "", "sm")} onClick={() => setPasting(false)}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TagsEditor({ tags, setTags, suggestions }: { tags: string[]; setTags: (tags: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState("");
  const keys = new Set(tags.map(tagKey));

  function add(raw: string) {
    const names = raw.split(/[,;]/).map(cleanTagName).filter(Boolean);
    const next = [...tags];
    for (const name of names) {
      if (!next.some((tag) => tagKey(tag) === tagKey(name))) next.push(name);
    }
    setTags(next.slice(0, 20));
    setText("");
  }

  const available = suggestions.filter((tag) => !keys.has(tagKey(tag)));

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => setTags(tags.filter((entry) => entry !== tag))}
                className="rounded-full bg-tint/15 px-3 py-1 text-[13px] font-medium text-tint transition hover:bg-tint/25"
                aria-label={`Togli il tag ${tag}`}
              >
                #{tag} ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              if (text.trim()) add(text);
            }
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder="veloce, vegetariano, estivo…"
          aria-label="Aggiungi un tag"
          list="tag-famiglia"
          className={inputClass}
        />
        <datalist id="tag-famiglia">
          {available.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        <button type="button" className={buttonClass("secondary")} disabled={!text.trim()} onClick={() => add(text)}>
          Aggiungi
        </button>
      </div>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.slice(0, 12).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="rounded-full bg-fill px-3 py-1 text-[13px] text-label-secondary transition hover:bg-fill-strong"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoPicker({
  existingImageKey,
  existingImageCredit,
  importedImageUrl,
  importedImageCredit,
}: {
  existingImageKey: string | null;
  existingImageCredit: string | null;
  importedImageUrl: string;
  importedImageCredit: string | null;
}) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [fileName, setFileName] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const preview = fileUrl ?? (removed ? null : existingImageKey ? `/foto/${existingImageKey}` : importedImageUrl || null);
  // La fascia con la fonte, come la si vedrà sulla ricetta. Una foto appena
  // scelta dal telefono non ne ha.
  const credit = fileUrl || removed ? null : existingImageKey ? existingImageCredit : importedImageUrl ? importedImageCredit : null;

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-control bg-fill">
          {/* L'anteprima può essere un file appena scelto (blob:) o l'immagine
              trovata dall'import, ancora sul sito d'origine. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Anteprima della foto" className="absolute inset-0 size-full object-cover" />
          {credit && <PhotoCredit credit={credit} />}
        </div>
      ) : (
        <p className="text-[13px] text-label-secondary">Nessuna foto.</p>
      )}
      {!fileUrl && !removed && !existingImageKey && importedImageUrl && (
        <p className="text-[12px] text-label-secondary">È l&apos;immagine trovata alla fonte: verrà copiata nell&apos;app quando salvi.</p>
      )}
      {/* Il pulsante nativo del file parla la lingua del browser («Choose
          File»): l'input resta nascosto e lo apre un'etichetta in italiano. */}
      <div className="flex flex-wrap items-center gap-2">
        <label className={buttonClass("secondary", "cursor-pointer", "sm")}>
          {preview ? "Cambia foto" : "Scegli una foto"}
          <input
            ref={input}
            type="file"
            name="photo"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileUrl(file ? URL.createObjectURL(file) : null);
              setFileName(file?.name ?? "");
              if (file) setRemoved(false);
            }}
          />
        </label>
        {(preview || removed) && (
          <button
            type="button"
            className={buttonClass(removed ? "ghost" : "danger", "", "sm")}
            onClick={() => {
              if (removed) {
                setRemoved(false);
                return;
              }
              if (input.current) input.current.value = "";
              setFileUrl(null);
              setFileName("");
              setRemoved(true);
            }}
          >
            {removed ? "Ripristina la foto" : "Togli la foto"}
          </button>
        )}
      </div>
      {fileName && <p className="truncate text-[12px] text-label-secondary">{fileName}</p>}
      <input type="hidden" name="removePhoto" value={removed ? "1" : ""} />
    </div>
  );
}

export function RecipeForm({
  action,
  initial,
  existingImageKey = null,
  existingImageCredit = null,
  tagSuggestions,
  cancelHref,
  submitLabel = "Salva ricetta",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial: RecipeDraft;
  existingImageKey?: string | null;
  existingImageCredit?: string | null;
  tagSuggestions: string[];
  cancelHref: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, emptyActionState);
  const [fields, setFields] = useState(() => {
    const { ingredients, steps, tags, ...rest } = initial;
    void ingredients;
    void steps;
    void tags;
    return rest;
  });
  const [tags, setTags] = useState(initial.tags);
  const [ingredients, setIngredients] = useState(() => initial.ingredients.map(withUid));
  const [steps, setSteps] = useState(() => initial.steps.map(withUid));
  const errorRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) => setFields((current) => ({ ...current, [key]: value }));

  const payload = useMemo(
    () => JSON.stringify({ ...fields, tags, ingredients, steps } satisfies RecipeDraft),
    [fields, tags, ingredients, steps],
  );

  // Un errore dal server si vede subito, anche in fondo a un form lungo.
  useEffect(() => {
    if (state.error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />
      <div ref={errorRef}>{state.error && <Alert tone="error">{state.error}</Alert>}</div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard title="La ricetta">
          <div className="space-y-4">
            <Field label="Titolo">
              <Input value={fields.title} onChange={(event) => set("title", event.target.value)} maxLength={MAX_TITLE_LENGTH} required placeholder="Pasta e patate" />
            </Field>
            <Field label="Descrizione" hint="Facoltativa: due righe per ricordare com'è il piatto.">
              <Textarea value={fields.description} onChange={(event) => set("description", event.target.value)} maxLength={2000} rows={2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria">
                <Select value={fields.category} onChange={(event) => set("category", event.target.value as RecipeDraft["category"])}>
                  <option value="">Nessuna</option>
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Porzioni (persone)">
                <Input value={fields.servings} onChange={(event) => set("servings", event.target.value)} inputMode="numeric" placeholder="4" />
              </Field>
              <Field label="Preparazione (minuti)">
                <Input value={fields.prepMinutes} onChange={(event) => set("prepMinutes", event.target.value)} inputMode="numeric" placeholder="20" />
              </Field>
              <Field label="Cottura (minuti)">
                <Input value={fields.cookMinutes} onChange={(event) => set("cookMinutes", event.target.value)} inputMode="numeric" placeholder="30" />
              </Field>
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-label-secondary">Tag</span>
              <TagsEditor tags={tags} setTags={setTags} suggestions={tagSuggestions} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Foto">
          <PhotoPicker
            existingImageKey={existingImageKey}
            existingImageCredit={existingImageCredit}
            importedImageUrl={fields.importedImageUrl}
            importedImageCredit={siteName(fields.sourceUrl)}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Ingredienti"
        description={fields.servings ? `Le quantità per ${fields.servings} ${fields.servings === "1" ? "persona" : "persone"}. Accetta anche 1/2 e 1,5.` : "Accetta anche 1/2 e 1,5."}
      >
        <IngredientsEditor rows={ingredients} setRows={setIngredients} />
      </SectionCard>

      <SectionCard title="Procedimento">
        <StepsEditor rows={steps} setRows={setSteps} />
      </SectionCard>

      <SectionCard title="Note e fonte">
        <div className="space-y-4">
          <Field label="Note" hint="Varianti, consigli, come conservarla.">
            <Textarea value={fields.notes} onChange={(event) => set("notes", event.target.value)} maxLength={4000} rows={3} />
          </Field>
          <Field label="Link alla fonte" hint="La pagina o il video da cui viene la ricetta.">
            <Input type="url" value={fields.sourceUrl} onChange={(event) => set("sourceUrl", event.target.value)} placeholder="https://" />
          </Field>
        </div>
      </SectionCard>

      {/* La barra in fondo resta a portata di pollice mentre si scorre il form. */}
      <div className="sticky bottom-0 z-30 -mx-4 flex items-center justify-end gap-2 border-t border-separator bg-grouped/85 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-card sm:border-0">
        <NavLink href={cancelHref} className={buttonClass("ghost")}>
          Annulla
        </NavLink>
        <SubmitButton pendingLabel="Salvo…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
