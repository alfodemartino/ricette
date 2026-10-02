"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { emptyActionState } from "@/lib/action-state";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Field label="Nome">
        <Input name="name" autoComplete="name" required maxLength={60} />
      </Field>

      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Password" hint="Almeno 8 caratteri.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>

      <SubmitButton pendingLabel="Creazione account…" className="w-full">
        Crea l&apos;account
      </SubmitButton>
    </form>
  );
}
