import { describe, expect, it } from "vitest";
import { buildLogRecord } from "./log";

const QUANDO = new Date("2026-08-27T14:32:11.482Z");

describe("buildLogRecord", () => {
  it("produce una riga JSON valida", () => {
    const riga = buildLogRecord("warn", "login_fallito", { email: "tizio@esempio.it" }, QUANDO);

    expect(JSON.parse(riga)).toEqual({
      ts: "2026-08-27T14:32:11.482Z",
      level: "warn",
      event: "login_fallito",
      email: "tizio@esempio.it",
    });
  });

  it("mette data, livello ed evento in testa alla riga", () => {
    // Una riga si legge da sinistra: le prime tre chiavi devono dire subito
    // quando, quanto è grave e cosa è successo.
    const riga = buildLogRecord("warn", "invito_inesistente", { codice: "ABC1234" }, QUANDO);

    expect(Object.keys(JSON.parse(riga)).slice(0, 3)).toEqual(["ts", "level", "event"]);
  });

  it("scrive il timestamp in UTC", () => {
    const riga = JSON.parse(buildLogRecord("warn", "login_fallito", {}, QUANDO));

    expect(riga.ts).toBe(QUANDO.toISOString());
    expect(riga.ts).toMatch(/Z$/);
  });

  it("omette i campi assenti o vuoti invece di scriverli vuoti", () => {
    // L'IP non c'è quando la richiesta arriva dalla LAN senza proxy davanti.
    const riga = JSON.parse(
      buildLogRecord("warn", "login_fallito", { email: "tizio@esempio.it", ip: undefined }, QUANDO),
    );

    expect(riga).not.toHaveProperty("ip");
  });

  it("omette anche la stringa vuota", () => {
    const riga = JSON.parse(buildLogRecord("warn", "login_fallito", { ip: "" }, QUANDO));

    expect(riga).not.toHaveProperty("ip");
  });

  it("conserva i campi numerici come numeri", () => {
    const riga = JSON.parse(buildLogRecord("warn", "ricetta_non_trovata", { tentativi: 3 }, QUANDO));

    expect(riga.tentativi).toBe(3);
  });

  it("resta su una riga sola, così `grep` restituisce l'evento intero", () => {
    const riga = buildLogRecord(
      "warn",
      "permesso_negato",
      { azione: "elimina_famiglia", nota: "con\nun a capo dentro" },
      QUANDO,
    );

    expect(riga).not.toContain("\n");
  });
});
