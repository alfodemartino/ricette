import { headers } from "next/headers";

/**
 * Indirizzo di chi ha fatto la richiesta, per i log di sicurezza.
 *
 * Sta in un file suo perché `next/headers` funziona solo dentro una richiesta:
 * tenendolo fuori da `log.ts` quest'ultimo resta puro e verificabile con i
 * test, come il resto di `src/lib/`.
 *
 * `cf-connecting-ip` lo mette Cloudflare quando l'app è raggiunta dal tunnel;
 * `x-forwarded-for` è il ripiego per qualunque altro proxy, e di quella catena
 * si prende il primo indirizzo, cioè il client originario.
 *
 * Va letto come un'indicazione, non come una prova: l'app è raggiungibile
 * anche direttamente sulla porta 3000 dalla LAN, e su quel percorso gli header
 * li scrive il chiamante. Serve a distinguere «mio padre ha sbagliato
 * password» da «qualcuno da fuori sta provando», non a incriminare nessuno.
 */
export async function clientIp(): Promise<string | undefined> {
  const intestazioni = await headers();

  const cloudflare = intestazioni.get("cf-connecting-ip");
  if (cloudflare) return cloudflare;

  const inoltrato = intestazioni.get("x-forwarded-for");
  return inoltrato?.split(",")[0]?.trim() || undefined;
}
