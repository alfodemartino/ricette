"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LOADING_DELAY_MS, trackLoading } from "@/lib/loading";

/**
 * Funzione con cui i componenti annunciano che stanno caricando qualcosa:
 * `+1` all'inizio, `-1` alla fine. Fuori dal provider non fa nulla, così un
 * componente riusato da solo (nei test, per esempio) non si rompe.
 */
const LoadingContext = createContext<(delta: number) => void>(() => {});

/**
 * Tiene acceso l'overlay finché `active` resta vero. Il conteggio si azzera
 * anche se il componente sparisce durante l'attesa (succede a ogni
 * navigazione: la pagina di partenza viene smontata a caricamento finito).
 */
export function useLoadingWhile(active: boolean) {
  const track = useContext(LoadingContext);

  useEffect(() => {
    if (!active) return;
    track(1);
    return () => track(-1);
  }, [active, track]);
}

/**
 * Indicatore di caricamento globale: copre la pagina con uno spinner mentre è
 * in corso una navigazione o l'invio di un form, così il clic ha una risposta
 * immediata anche quando il server ci mette qualche istante.
 */
export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(0);
  const [visible, setVisible] = useState(false);

  const track = useCallback((delta: number) => {
    setRunning((count) => trackLoading(count, delta));
  }, []);

  const busy = running > 0;

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => setVisible(true), LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  return (
    <LoadingContext.Provider value={track}>
      {children}
      <Overlay visible={visible} />
    </LoadingContext.Provider>
  );
}

/**
 * Resta sempre nel DOM, ma trasparente e insensibile ai clic: così l'apparizione
 * è una dissolvenza e non un salto. Quando invece è visibile intercetta i clic
 * di proposito, per non far partire un'altra azione a metà caricamento.
 */
function Overlay({ visible }: { visible: boolean }) {
  return (
    <div
      role="status"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/15 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none dark:bg-black/50 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Il riquadro sfocato che iOS mette sopra la schermata mentre lavora. */}
      <span className="rounded-2xl bg-surface/85 p-6 shadow-xl backdrop-blur-xl">
        <span aria-hidden className="ios-spinner block size-8 text-label-secondary" />
      </span>
      {/* Il testo compare solo a overlay acceso: è il cambiamento dentro la
          regione `status` che i lettori di schermo annunciano. */}
      {visible && <span className="sr-only">Caricamento in corso…</span>}
    </div>
  );
}
