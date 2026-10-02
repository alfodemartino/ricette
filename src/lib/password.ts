/**
 * Hashing delle password.
 *
 * Il costo sta qui e in un posto solo: quando era ripetuto nel codice, il seed
 * si era fermato a 10 mentre la registrazione era già passata a 12, e la
 * differenza non la vedeva nessuno perché bcrypt verifica comunque l'hash con
 * il costo che si porta dentro.
 */
import bcrypt from "bcryptjs";

/** Fattore di costo di bcrypt: ~0,2-0,5 s per tentativo su hardware attuale. */
export const BCRYPT_COST = 12;

/** Hash da salvare in `User.passwordHash`. Il salt è casuale e incluso. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** Verifica una password contro l'hash salvato. */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
