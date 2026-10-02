"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Un pulsante che apre un piccolo menu sotto di sé, come i menu contestuali di
 * iOS: raccoglie le azioni che si usano di rado, così non occupano la testata.
 *
 * Si chiude toccando fuori, con Esc e quando si sceglie una voce che porta da
 * qualche parte (un link o un invio di form). I controlli che restano sulla
 * pagina, come la scelta del tema, lo lasciano aperto: si vede subito
 * l'effetto e si può cambiare idea.
 */
export function Menu({
  label,
  trigger,
  triggerClassName,
  children,
}: {
  /** Il nome del pulsante per chi usa un lettore di schermo. */
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      <div
        id={panelId}
        hidden={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a, button[type=submit]")) setOpen(false);
        }}
        className="absolute top-full right-0 z-50 mt-2 w-60 overflow-hidden rounded-card bg-surface shadow-[0_10px_40px_rgb(0_0_0/0.18)] ring-1 ring-separator"
      >
        {children}
      </div>
    </div>
  );
}
