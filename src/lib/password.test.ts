import { describe, expect, it } from "vitest";
import { BCRYPT_COST, hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("scrive il costo dichiarato dentro l'hash", async () => {
    const hash = await hashPassword("password123");
    expect(hash.startsWith(`$2b$${BCRYPT_COST}$`)).toBe(true);
  });

  it("riconosce la password giusta e rifiuta quella sbagliata", async () => {
    const hash = await hashPassword("password123");
    expect(await verifyPassword("password123", hash)).toBe(true);
    expect(await verifyPassword("password124", hash)).toBe(false);
  });
});
