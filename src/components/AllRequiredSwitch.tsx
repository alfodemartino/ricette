"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLoadingWhile } from "@/components/LoadingOverlay";
import { Switch } from "@/components/ui";
import { ALL_REQUIRED_PARAM } from "@/lib/cook-with";

/**
 * «Solo con tutti gli ingredienti», dentro il form di «Cosa cucino con…».
 * Acceso, la pagina non mostra le ricette a cui manca un ingrediente. Con una
 * ricerca già fatta la rifà subito; senza, il campo nascosto porta la scelta
 * insieme agli ingredienti quando si tocca «Cerca».
 */
export function AllRequiredSwitch({ text, initial }: { text: string; initial: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(initial);
  const [pending, startTransition] = useTransition();
  useLoadingWhile(pending);

  function change(next: boolean) {
    setChecked(next);
    if (!text) return;
    const params = new URLSearchParams({ ingredienti: text });
    if (next) params.set(ALL_REQUIRED_PARAM, "1");
    startTransition(() => router.push(`/ricette/cosa-cucino?${params}`));
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-2 sm:max-w-sm">
      <span className="text-[15px]">Solo con tutti gli ingredienti</span>
      {checked && <input type="hidden" name={ALL_REQUIRED_PARAM} value="1" />}
      <Switch checked={checked} onChange={change} label="Solo con tutti gli ingredienti" disabled={pending} />
    </div>
  );
}
