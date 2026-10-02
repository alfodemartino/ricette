/** Stato restituito dalle server action ai form (usato con `useActionState`). */
export type ActionState = {
  error?: string;
  success?: string;
};

export const emptyActionState: ActionState = {};
