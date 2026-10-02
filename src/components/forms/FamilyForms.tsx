"use client";

import { useActionState, useState } from "react";
import {
  createFamilyAction,
  deleteFamilyAction,
  joinFamilyAction,
  leaveFamilyAction,
  makeOwnerAction,
  regenerateInviteAction,
  removeMemberAction,
  renameFamilyAction,
} from "@/app/actions/family";
import { emptyActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, buttonClass, Field, Input } from "@/components/ui";

export function CreateFamilyForm() {
  const [state, formAction] = useActionState(createFamilyAction, emptyActionState);
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Nome della famiglia">
        <Input name="name" placeholder="Famiglia De Martino" maxLength={60} required />
      </Field>
      <SubmitButton pendingLabel="Creo…">Crea la famiglia</SubmitButton>
    </form>
  );
}

export function JoinFamilyForm() {
  const [state, formAction] = useActionState(joinFamilyAction, emptyActionState);
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Codice di invito" hint="Te lo dà chi ha creato la famiglia.">
        <Input
          name="code"
          placeholder="ABCD2345"
          autoCapitalize="characters"
          autoComplete="off"
          className="font-mono tracking-widest uppercase"
          maxLength={10}
          required
        />
      </Field>
      <SubmitButton pendingLabel="Entro…">Entra nella famiglia</SubmitButton>
    </form>
  );
}

export function RenameFamilyForm({ name }: { name: string }) {
  const [state, formAction] = useActionState(renameFamilyAction, emptyActionState);
  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="flex gap-2">
        <Input name="name" defaultValue={name} maxLength={60} required aria-label="Nome della famiglia" />
        <SubmitButton variant="secondary" pendingLabel="Salvo…">
          Rinomina
        </SubmitButton>
      </div>
    </form>
  );
}

/** Il codice da condividere, con il pulsante per copiarlo e (per l'amministratore) cambiarlo. */
export function InviteCode({ code, canRegenerate }: { code: string; canRegenerate: boolean }) {
  const [state, formAction] = useActionState(regenerateInviteAction, emptyActionState);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-control bg-fill px-4 py-2 font-mono text-[22px] font-semibold tracking-[0.2em]">
          {code}
        </span>
        <button
          type="button"
          className={buttonClass("secondary", "", "sm")}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Senza HTTPS il browser non dà accesso agli appunti: resta il codice da leggere.
            }
          }}
        >
          {copied ? "Copiato" : "Copia"}
        </button>
        {canRegenerate && (
          <form
            action={formAction}
            onSubmit={(event) => {
              if (!confirm("Creare un nuovo codice? Quello attuale smetterà di funzionare.")) event.preventDefault();
            }}
          >
            <SubmitButton variant="ghost" size="sm" pendingLabel="Creo…">
              Nuovo codice
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}

/** Le azioni dell'amministratore su un altro membro. */
export function MemberActions({ memberId, name }: { memberId: string; name: string }) {
  const [ownerState, ownerAction] = useActionState(makeOwnerAction, emptyActionState);
  const [removeState, removeAction] = useActionState(removeMemberAction, emptyActionState);
  const message = ownerState.error ?? removeState.error;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <form
        action={ownerAction}
        onSubmit={(event) => {
          if (!confirm(`Passare il ruolo di amministratore a ${name}? Tu resterai un membro.`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="memberId" value={memberId} />
        <SubmitButton variant="ghost" size="sm" pendingLabel="…">
          Rendi amministratore
        </SubmitButton>
      </form>
      <form
        action={removeAction}
        onSubmit={(event) => {
          if (!confirm(`Togliere ${name} dalla famiglia? Le sue ricette restano.`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="memberId" value={memberId} />
        <SubmitButton variant="danger" size="sm" pendingLabel="…">
          Togli
        </SubmitButton>
      </form>
      {message && <span className="w-full text-right text-[12px] text-negative">{message}</span>}
    </div>
  );
}

export function LeaveFamilyButton() {
  const [state, formAction] = useActionState(leaveFamilyAction, emptyActionState);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Uscire dalla famiglia? Non vedrai più le sue ricette, ma quelle che hai scritto restano agli altri.")) {
          event.preventDefault();
        }
      }}
      className="space-y-3"
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <SubmitButton variant="danger" pendingLabel="Esco…">
        Esci dalla famiglia
      </SubmitButton>
    </form>
  );
}

/** Eliminazione con conferma scritta: il pulsante si accende solo col nome giusto. */
export function DeleteFamilyForm({ name }: { name: string }) {
  const [state, formAction] = useActionState(deleteFamilyAction, emptyActionState);
  const [typed, setTyped] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label={`Per confermare scrivi «${name}»`}>
        <Input name="confirm" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
      </Field>
      <SubmitButton variant="danger" disabled={typed.trim() !== name} pendingLabel="Elimino…">
        Elimina la famiglia e tutte le ricette
      </SubmitButton>
    </form>
  );
}
