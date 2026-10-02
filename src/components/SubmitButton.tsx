"use client";

import { useFormStatus } from "react-dom";
import { useLoadingWhile } from "@/components/LoadingOverlay";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Per i form che pretendono una conferma prima di lasciar premere. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  // Ogni invio accende anche l'overlay globale: il pulsante da solo si nota
  // poco, soprattutto quando è in fondo a un form lungo.
  useLoadingWhile(pending);

  return (
    <button type="submit" disabled={pending || disabled} className={buttonClass(variant, className, size)}>
      {pending ? (pendingLabel ?? "Attendere…") : children}
    </button>
  );
}
