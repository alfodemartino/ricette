"use client";

import { useActionState } from "react";
import { deleteRecipeAction } from "@/app/actions/recipes";
import { emptyActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/SubmitButton";

export function DeleteRecipeButton({ recipeId, title }: { recipeId: string; title: string }) {
  const [state, formAction] = useActionState(deleteRecipeAction, emptyActionState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm(`Eliminare «${title}»? La ricetta sparisce per tutta la famiglia.`)) event.preventDefault();
      }}
      className="p-2"
    >
      <input type="hidden" name="recipeId" value={recipeId} />
      <SubmitButton variant="danger" className="w-full" pendingLabel="Elimino…">
        Elimina ricetta
      </SubmitButton>
      {state.error && <p className="mt-1 px-2 text-[12px] text-negative">{state.error}</p>}
    </form>
  );
}
