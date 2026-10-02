"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { emptyActionState } from "@/lib/action-state";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>

      <SubmitButton pendingLabel="Accesso in corso…" className="w-full">
        Accedi
      </SubmitButton>
    </form>
  );
}
