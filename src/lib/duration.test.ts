import { describe, expect, it } from "vitest";
import { formatMinutes, parseIsoDuration, totalMinutes } from "./duration";

describe("parseIsoDuration", () => {
  it.each([
    ["PT20M", 20],
    ["PT1H20M", 80],
    ["P0DT0H45M", 45],
    ["PT90M", 90],
    ["PT2H", 120],
    ["P1D", 1440],
    ["pt15m", 15],
  ])("%s → %d minuti", (raw, expected) => {
    expect(parseIsoDuration(raw)).toBe(expected);
  });

  it("restituisce null per durate assenti, nulle o scritte male", () => {
    expect(parseIsoDuration("PT0M")).toBeNull();
    expect(parseIsoDuration("20 minuti")).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
    expect(parseIsoDuration(20)).toBeNull();
  });
});

describe("formatMinutes", () => {
  it("scrive ore e minuti", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(80)).toBe("1 h 20 min");
    expect(formatMinutes(null)).toBe("");
  });

  it("somma i tempi solo se ce n'è almeno uno", () => {
    expect(totalMinutes(10, 20)).toBe(30);
    expect(totalMinutes(null, 20)).toBe(20);
    expect(totalMinutes(null, null)).toBeNull();
  });
});
