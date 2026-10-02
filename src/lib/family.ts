import { randomInt } from "node:crypto";

/**
 * Codice di invito leggibile, senza caratteri ambigui (0/O, 1/I). Generato con
 * `crypto`: è l'unica cosa che separa una famiglia da chi volesse entrarci.
 */
export function generateInviteCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }
  return code;
}
