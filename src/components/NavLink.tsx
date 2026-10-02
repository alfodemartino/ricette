"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { useLoadingWhile } from "@/components/LoadingOverlay";

/**
 * `useLinkStatus` funziona solo dentro un <Link>, quindi la segnalazione vive
 * in un componente figlio che non disegna nulla. Resta spento quando la pagina
 * di destinazione è già in cache: lì la navigazione è immediata e uno spinner
 * darebbe solo fastidio.
 */
function LinkPending() {
  const { pending } = useLinkStatus();
  useLoadingWhile(pending);
  return null;
}

/**
 * Il <Link> di Next con l'indicatore di caricamento globale attaccato: si usa
 * al posto di `next/link` in tutta l'app, così ogni navigazione ha una risposta
 * visibile appena si clicca.
 */
export function NavLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      <LinkPending />
      {children}
    </Link>
  );
}
