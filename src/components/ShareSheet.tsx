"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PeopleStepper } from "@/components/RecipeView";
import { Alert, Skeleton, buttonClass } from "@/components/ui";
import { copyText } from "@/lib/clipboard";
import {
  mailtoHref,
  recipeShareText,
  recipesShareText,
  shareSubject,
  whatsappHref,
  type ShareableRecipe,
} from "@/lib/share";

/*
 * Il pannello di condivisione del telefono (`navigator.share`) esiste solo in
 * HTTPS, e non in tutti i browser del computer. Non cambia mentre la pagina è
 * aperta: non c'è niente a cui iscriversi.
 */
const subscribe = () => () => {};
const nativeShareAvailable = () => typeof navigator.share === "function";

/** Un modo di mandare il messaggio che è un link: finché il testo non c'è, un pulsante spento. */
function ShareLink({ href, external = false, children }: { href: string | null; external?: boolean; children: ReactNode }) {
  if (!href) {
    return (
      <button type="button" disabled className={buttonClass("secondary")}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} className={buttonClass("secondary")} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

/** Il messaggio mentre il server prepara le ricette scelte dall'elenco. */
function PreviewSkeleton() {
  return (
    <div role="status" className="space-y-2.5">
      <span className="sr-only">Preparo il messaggio…</span>
      {["w-48", "w-32", "w-56", "w-40", "w-52", "w-36"].map((width) => (
        <Skeleton key={width} className={`h-4 max-w-full ${width}`} />
      ))}
    </div>
  );
}

/**
 * Il pannello di «Condividi»: il messaggio così come partirà, le persone per
 * cui sono le quantità e i modi per mandarlo. Sul telefono sale dal basso
 * come i fogli di iOS, sul computer sta al centro.
 *
 * «Invia con…» apre il pannello del telefono, che c'è solo in HTTPS: dalla
 * rete di casa, in http, restano WhatsApp, la copia e l'email, che funzionano
 * ovunque. Passare prima da qui serve anche a Safari, che apre il proprio
 * pannello solo subito dopo un tocco: quando si tocca «Invia con…» il testo è
 * già pronto, anche quello che arriva dal server.
 */
export function ShareSheet({
  open,
  onClose,
  heading,
  recipes,
  error = null,
  initialPeople = null,
}: {
  open: boolean;
  onClose: () => void;
  heading: string;
  /** `null` mentre il server prepara le ricette. */
  recipes: ShareableRecipe[] | null;
  error?: string | null;
  /** Le persone scelte nella pagina della ricetta, da cui parte lo stepper. */
  initialPeople?: number | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const titleId = useId();
  const canShare = useSyncExternalStore(subscribe, nativeShareAvailable, () => false);

  // Le persone si scelgono solo per una ricetta sola che dice per quante è:
  // di più ricette insieme ognuna parte con le sue porzioni.
  const single = recipes?.length === 1 ? recipes[0] : null;
  const servings = single?.servings && single.servings > 0 ? single.servings : null;
  const [people, setPeople] = useState(0);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // A ogni apertura si riparte dalle persone della pagina, senza avvisi vecchi.
  useEffect(() => {
    if (!open) return;
    setPeople(initialPeople ?? servings ?? 0);
    setCopied(false);
    setNotice(null);
  }, [open, initialPeople, servings]);

  // Il `<dialog>` segue lo stato a ogni render, non solo quando `open` cambia:
  // se i due si fossero separati, il tocco successivo su «Condividi» lo
  // riaprirebbe comunque.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  });

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  // Chi chiude avvisa subito, senza aspettare l'evento `close`: il browser lo
  // manda in un secondo momento, e fino ad allora lo stato direbbe «aperto».
  function close() {
    dialog.current?.close();
    onClose();
  }

  const text = useMemo(() => {
    if (!recipes || recipes.length === 0) return "";
    return single ? recipeShareText(single, people) : recipesShareText(recipes);
  }, [recipes, single, people]);
  const subject = recipes ? shareSubject(recipes) : "";
  const ready = text !== "";

  async function shareWithPhone() {
    setNotice(null);
    try {
      await navigator.share({ title: subject, text });
    } catch (reason) {
      // Chiudere il pannello del telefono senza scegliere un'app non è un errore.
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setNotice("Il telefono non ha aperto la condivisione: usa WhatsApp o Copia.");
    }
  }

  async function copy() {
    setNotice(null);
    if (await copyText(text, dialog.current ?? undefined)) {
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } else {
      setNotice("Il browser non ha copiato il testo: tienilo premuto per selezionarlo.");
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // Esc: il browser chiude da sé, lo stato si aggiorna già qui.
      onCancel={onClose}
      // Un `close` che arriva in ritardo, a pannello già riaperto, non lo richiude.
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
      // Il velo intorno chiude il pannello, ma solo se il tocco comincia lì:
      // chi seleziona il messaggio e rilascia fuori non lo perde.
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) close();
      }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none items-end justify-center bg-scrim p-0 text-label backdrop:bg-transparent open:flex sm:items-center sm:p-6"
    >
      {/* Il filo intorno serve al tema scuro: lì il fondo del pannello è nero come il velo. */}
      <div className="sheet-in flex max-h-[90dvh] w-full flex-col gap-3 rounded-t-card bg-grouped p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgb(0_0_0/0.18)] ring-1 ring-separator sm:max-h-[85dvh] sm:max-w-lg sm:rounded-card">
        <header className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="min-w-0 truncate text-[17px] font-semibold tracking-tight">
            {heading}
          </h2>
          <button type="button" onClick={close} className={buttonClass("ghost", "-mr-3")}>
            Chiudi
          </button>
        </header>

        {servings !== null && (
          <div className="flex items-center justify-between gap-3 rounded-card bg-surface py-1.5 pr-1.5 pl-4 text-[15px]">
            Persone
            <PeopleStepper value={people || servings} onChange={setPeople} />
          </div>
        )}

        {error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-card bg-surface p-4 text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap">
            {ready ? text : <PreviewSkeleton />}
          </div>
        )}

        {notice && <Alert tone="warning">{notice}</Alert>}

        <div className="grid grid-cols-3 gap-2">
          {canShare && (
            <button type="button" disabled={!ready} onClick={shareWithPhone} className={buttonClass("primary", "col-span-3")}>
              Invia con…
            </button>
          )}
          <ShareLink href={ready ? whatsappHref(text) : null} external>
            WhatsApp
          </ShareLink>
          <button type="button" disabled={!ready} onClick={copy} className={buttonClass("secondary")}>
            {copied ? "Copiato" : "Copia"}
          </button>
          <ShareLink href={ready ? mailtoHref(subject, text) : null}>Email</ShareLink>
        </div>
      </div>
    </dialog>
  );
}
