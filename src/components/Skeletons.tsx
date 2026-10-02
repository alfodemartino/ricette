import { Skeleton } from "@/components/ui";

/**
 * I pezzi con cui sono fatte le pagine di caricamento (`loading.tsx`): mentre
 * il server prepara i dati, Next mostra al loro posto questa impalcatura.
 *
 * La regola che li tiene insieme: **quello che non dipende dai dati si mostra
 * per davvero**. Titoli, descrizioni e struttura sono già noti, quindi restano
 * testo vero e non diventano rettangoli grigi; a essere sostituiti sono solo i
 * valori che stanno arrivando. Così la pagina non appare due volte — prima
 * finta e poi vera — ma si riempie.
 */

/**
 * L'involucro di ogni pagina di caricamento. Fa due cose: dice una volta sola
 * che la pagina è in attesa — `role="status"` lo annuncia a chi usa un lettore
 * di schermo, i blocchi grigi sono decorativi e restano zitti — e con
 * `skeleton-in` ritarda la propria comparsa, così le risposte rapide non fanno
 * lampeggiare l'impalcatura.
 */
export function SkeletonPage({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={`skeleton-in ${className}`}>
      <span className="sr-only">Caricamento in corso…</span>
      {children}
    </div>
  );
}

/* Larghezze diverse riga per riga: nomi tutti uguali si vedono che sono finti. */
const rowWidths = ["w-40", "w-28", "w-44", "w-32"];

/**
 * Le righe di un elenco dentro una card `flush`, chevron compreso: è la forma
 * dei membri della famiglia. `icon` aggiunge a sinistra il cerchio
 * dell'avatar, grigio perché il nome è uno dei dati in arrivo.
 */
export function SkeletonRows({ count = 3, icon = false }: { count?: number; icon?: boolean }) {
  return (
    <ul className="divide-y divide-separator">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex items-center justify-between gap-3 px-4 py-3">
          {/* Non `Skeleton`: il suo `rounded-md` e un `rounded-full` passato da
              fuori sono due utility in conflitto, e vincerebbe l'ordine del
              foglio di stile. Il cerchio si dichiara per intero. */}
          {icon && (
            <span
              aria-hidden
              className="size-9 shrink-0 animate-pulse rounded-full bg-fill motion-reduce:animate-none"
            />
          )}
          <span className="min-w-0 flex-1">
            <Skeleton className={`h-4 max-w-full ${rowWidths[index % rowWidths.length]}`} />
            <Skeleton className="mt-2 h-3 w-52 max-w-full" />
          </span>
          <Skeleton className="h-4 w-16 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

/** Righe «voce a sinistra, valore a destra»: ingredienti e quantità. */
export function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3.5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <Skeleton className={`h-4 max-w-full ${rowWidths[index % rowWidths.length]}`} />
          <Skeleton className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Un modulo: per ogni campo l'etichetta e la sua casella, e in fondo il
 * pulsante. Le altezze sono quelle vere di `Field` e `SubmitButton`.
 */
export function SkeletonForm({ fields = 2 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index}>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-1.5 h-11 w-full rounded-control" />
        </div>
      ))}
      <Skeleton className="h-11 w-44 max-w-full rounded-control" />
    </div>
  );
}

/**
 * Le schede dell'elenco delle ricette: il riquadro della foto e due righe di
 * testo, righe con la miniatura sul telefono e schede da tablet in su. Lo
 * stesso reticolo della pagina vera, così all'arrivo non salta nulla.
 */
export function SkeletonRecipeCards({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex items-center gap-3 overflow-hidden rounded-card bg-surface p-2.5 sm:block sm:p-0">
          {/* Non `Skeleton`: il suo `rounded-md` e gli arrotondamenti passati da
              fuori sarebbero utility in conflitto. Il riquadro si dichiara per intero. */}
          <span
            aria-hidden
            className="block size-20 shrink-0 animate-pulse rounded-control bg-fill motion-reduce:animate-none sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-none"
          />
          <div className="min-w-0 flex-1 sm:p-4">
            <Skeleton className={`h-4 max-w-full ${rowWidths[index % rowWidths.length]}`} />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}
