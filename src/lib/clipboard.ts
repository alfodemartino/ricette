/**
 * Copia un testo negli appunti; restituisce `false` se il browser non l'ha
 * fatto. Solo nel browser.
 *
 * In HTTPS c'è `navigator.clipboard`. Dalla rete di casa, in http, il browser
 * non lo concede, e resta il vecchio `execCommand("copy")` su una casella di
 * testo appoggiata fuori dallo schermo: è deprecato, ma funziona ancora
 * ovunque.
 *
 * `container` è dove appoggiare la casella. Dentro un `<dialog>` modale
 * dev'essere il dialog stesso: il resto della pagina è inerte, e lì il testo
 * non si lascia selezionare.
 */
export async function copyText(text: string, container: HTMLElement = document.body): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permesso negato o pagina non in primo piano: si prova alla vecchia maniera.
    }
  }

  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement("textarea");
  area.value = text;
  // In sola lettura, così su iPhone selezionarla non apre la tastiera; 16 px,
  // perché con un testo più piccolo Safari ingrandisce la pagina.
  area.readOnly = true;
  Object.assign(area.style, { position: "fixed", top: "0", left: "-9999px", fontSize: "16px" });
  container.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  area.remove();
  window.getSelection()?.removeAllRanges();
  focused?.focus();
  return copied;
}
