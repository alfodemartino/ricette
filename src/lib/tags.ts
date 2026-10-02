import { normalizeForSearch } from "@/lib/text";

/**
 * Tag liberi della famiglia. Due tag sono lo stesso se coincidono a meno di
 * maiuscole, accenti e spazi: «Veloce» e «veloce » non diventano due voci.
 */

export const MAX_TAG_LENGTH = 30;

/** La chiave con cui un tag si confronta e si salva come unico. */
export function tagKey(name: string): string {
  return normalizeForSearch(name.trim().replace(/\s+/g, " "));
}

/** Il nome da mostrare: spazi ripuliti e in minuscolo, come le etichette di iOS. */
export function cleanTagName(name: string): string {
  return name.trim().replace(/^#/, "").replace(/\s+/g, " ").toLowerCase().slice(0, MAX_TAG_LENGTH);
}

/** I tag di un elenco, senza vuoti e senza doppioni (vale il primo scritto). */
export function uniqueTags(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = cleanTagName(raw);
    const key = tagKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

/** Un elenco scritto a mano: «veloce, vegetariano; estivo». */
export function parseTagList(text: string): string[] {
  return uniqueTags(text.split(/[,;\n]/));
}
