/**
 * Minuscolo e senza accenti: la forma in cui due testi si confrontano. La
 * usano sia la ricerca sia il riconoscimento delle categorie, che quindi
 * vedono «Caffè» e «caffe» allo stesso modo.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
