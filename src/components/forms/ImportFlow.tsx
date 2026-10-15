"use client";

import { useActionState, useEffect, useRef } from "react";
import { importRecipeAction, type ImportState } from "@/app/actions/import";
import { RecipeForm } from "@/components/forms/RecipeForm";
import { RecipeLinks } from "@/components/RecipeLinks";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Card, Input } from "@/components/ui";
import type { SaveRecipeState } from "@/app/actions/recipes";
import { IMPORT_NOW_KEY } from "@/lib/cook-with";

const METHOD_NOTE = {
  "dati-strutturati": "La pagina descrive la ricetta in modo strutturato: dovrebbe essere tutto al suo posto.",
  testo: "La ricetta è stata ricavata dal testo della pagina o del video: controlla soprattutto ingredienti e passi.",
  anteprima: "Dalla pagina si sono potuti leggere solo titolo e immagine.",
} as const;

/**
 * Prima si incolla il link, poi compare il form già compilato. La ricetta si
 * salva solo dal form, dopo averla controllata: un import automatico che
 * sbaglia una quantità è peggio di uno che chiede conferma.
 */
export function ImportFlow({
  saveAction,
  tagSuggestions,
  initialUrl = "",
}: {
  saveAction: (state: SaveRecipeState, formData: FormData) => Promise<SaveRecipeState>;
  tagSuggestions: string[];
  /** Da `?url=`: il link nella casella, pronto da importare. */
  initialUrl?: string;
}) {
  const [state, formAction] = useActionState<ImportState, FormData>(importRecipeAction, {});
  const form = useRef<HTMLFormElement>(null);

  // Da «Importa» di «Cosa cucino con…» si parte subito, senza un secondo
  // tocco. Vale una volta sola, e solo per il link che quella pagina ha
  // scritto: un `?url=` arrivato da fuori non scarica niente da sé.
  useEffect(() => {
    try {
      if (!initialUrl || sessionStorage.getItem(IMPORT_NOW_KEY) !== initialUrl) return;
      sessionStorage.removeItem(IMPORT_NOW_KEY);
    } catch {
      return;
    }
    form.current?.requestSubmit();
  }, [initialUrl]);

  return (
    <div className="space-y-6">
      <Card title="Link della ricetta" description="Una pagina di ricette, un video YouTube, un post di Instagram, TikTok o Facebook.">
        <form ref={form} action={formAction} className="space-y-3">
          {state.error && <Alert tone="error">{state.error}</Alert>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="url"
              type="url"
              inputMode="url"
              defaultValue={state.url ?? initialUrl}
              key={state.url ?? (initialUrl || "vuoto")}
              placeholder="https://"
              required
              aria-label="Link della ricetta"
            />
            <SubmitButton pendingLabel="Leggo la pagina…" className="shrink-0">
              Importa
            </SubmitButton>
          </div>
        </form>
      </Card>

      {state.draft && (
        <div className="space-y-4">
          {state.existing && state.existing.length > 0 && (
            <Alert tone="warning">
              {state.existing.length === 1 ? "Nel ricettario c'è già una ricetta da questo link: " : "Nel ricettario ci sono già ricette da questo link: "}
              <RecipeLinks recipes={state.existing} />. Prima di salvarne un&apos;altra ti verrà chiesta conferma.
            </Alert>
          )}

          <Alert tone={state.complete ? "success" : "info"}>
            {state.complete
              ? `Ricetta trovata. ${METHOD_NOTE[state.method ?? "dati-strutturati"]} Controlla e salva.`
              : `Importazione parziale. ${METHOD_NOTE[state.method ?? "anteprima"]} Completa a mano quello che manca: con «Incolla elenco» e «Incolla testo» fai prima.`}
          </Alert>

          {!state.complete && state.rawText && (
            <details className="rounded-card bg-surface p-4 text-[13px]">
              <summary className="cursor-pointer font-semibold text-tint">Testo trovato alla fonte</summary>
              <p className="mt-3 whitespace-pre-line text-label-secondary">{state.rawText}</p>
            </details>
          )}

          {/* La chiave cambia a ogni import: un secondo link riparte da un form pulito. */}
          <RecipeForm
            key={`${state.url}-${state.draft.title}`}
            action={saveAction}
            initial={state.draft}
            tagSuggestions={tagSuggestions}
            cancelHref="/ricette"
          />
        </div>
      )}
    </div>
  );
}
