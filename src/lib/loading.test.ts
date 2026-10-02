import { describe, expect, it } from "vitest";
import { LOADING_DELAY_MS, trackLoading } from "@/lib/loading";

describe("trackLoading", () => {
  it("conta le operazioni che iniziano e finiscono", () => {
    let count = 0;
    count = trackLoading(count, 1);
    expect(count).toBe(1);
    count = trackLoading(count, -1);
    expect(count).toBe(0);
  });

  it("resta acceso finché non finiscono tutte le operazioni sovrapposte", () => {
    let count = trackLoading(trackLoading(0, 1), 1);
    expect(count).toBe(2);

    count = trackLoading(count, -1);
    expect(count).toBeGreaterThan(0);

    count = trackLoading(count, -1);
    expect(count).toBe(0);
  });

  it("non scende sotto zero", () => {
    expect(trackLoading(0, -1)).toBe(0);
    expect(trackLoading(trackLoading(0, -1), 1)).toBe(1);
  });
});

describe("LOADING_DELAY_MS", () => {
  it("è abbastanza breve da non far sembrare l'app bloccata", () => {
    expect(LOADING_DELAY_MS).toBeGreaterThan(0);
    expect(LOADING_DELAY_MS).toBeLessThanOrEqual(300);
  });
});
