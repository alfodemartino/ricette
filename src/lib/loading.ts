/**
 * Stato dell'indicatore di caricamento globale (overlay con lo spinner).
 * Qui c'è solo la logica pura: il componente che la usa sta in
 * `src/components/LoadingOverlay.tsx`.
 */

/**
 * Quanto si aspetta prima di mostrare l'overlay. Le risposte rapide finiscono
 * entro questo tempo: senza attesa lo spinner lampeggerebbe a ogni clic,
 * dando l'impressione opposta a quella voluta.
 */
export const LOADING_DELAY_MS = 150;

/**
 * Conta le operazioni in corso: `+1` quando una parte, `-1` quando finisce.
 * Serve un contatore e non un booleano perché più operazioni possono
 * sovrapporsi (un form che salva mentre si naviga altrove) e la prima che
 * finisce non deve spegnere l'overlay delle altre.
 *
 * Il conteggio non scende mai sotto zero: un `-1` di troppo (un componente
 * smontato due volte in sviluppo, con StrictMode) non deve lasciare
 * l'indicatore in credito e impedirgli di riaccendersi.
 */
export function trackLoading(count: number, delta: number): number {
  return Math.max(0, count + delta);
}
