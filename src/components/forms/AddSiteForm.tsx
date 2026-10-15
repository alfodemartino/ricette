"use client";

import { useActionState } from "react";
import { addSiteAction, type AddSiteState } from "@/app/actions/cook-with";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Input } from "@/components/ui";

/**
 * Si incolla l'indirizzo di un sito e l'app lo prova: ricerca, robots.txt e
 * qualche ricetta di esempio. Ci vuole qualche secondo, quindi il pulsante
 * dice cosa sta facendo.
 */
export function AddSiteForm({ disabled }: { disabled: boolean }) {
  const [state, formAction] = useActionState<AddSiteState, FormData>(addSiteAction, {});

  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.added && (
        <Alert tone="success">
          {state.added.name} aggiunto. Ricette trovate per prova: {state.added.samples.join(", ")}.
        </Alert>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="url"
          // Non `type="url"`: il browser vorrebbe «https://» davanti, e
          // «www.sito.it» va bene lo stesso (lo completa `parseImportUrl`).
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://www.sitodiricette.it"
          aria-label="Indirizzo del sito"
          required
          disabled={disabled}
          // Un sito rifiutato resta scritto, da correggere; uno aggiunto lascia la casella vuota.
          defaultValue={state.url ?? ""}
          key={state.url ?? state.added?.name ?? "nuovo"}
        />
        <SubmitButton pendingLabel="Provo il sito…" className="shrink-0" disabled={disabled}>
          Verifica e aggiungi
        </SubmitButton>
      </div>
    </form>
  );
}
