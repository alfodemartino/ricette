import { describe, expect, it } from "vitest";
import { parseStoredTheme, THEME_STORAGE_KEY, themeInitScript } from "./theme";

describe("parseStoredTheme", () => {
  it("accetta le scelte esplicite dell'utente", () => {
    expect(parseStoredTheme("light")).toBe("light");
    expect(parseStoredTheme("dark")).toBe("dark");
    expect(parseStoredTheme("system")).toBe("system");
  });

  it("ripiega su system quando il valore manca o non è valido", () => {
    expect(parseStoredTheme(null)).toBe("system");
    expect(parseStoredTheme("")).toBe("system");
    expect(parseStoredTheme("DARK")).toBe("system");
  });
});

describe("themeInitScript", () => {
  it("usa la stessa chiave di storage del resto dell'app", () => {
    expect(themeInitScript).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it("applica al documento solo il tema salvato dall'utente", () => {
    const setAttribute = (name: string, value: string) => {
      applied.push([name, value]);
    };
    const applied: [string, string][] = [];
    const run = (stored: string | null) => {
      applied.length = 0;
      const localStorage = { getItem: () => stored };
      const document = { documentElement: { setAttribute } };
      new Function("localStorage", "document", themeInitScript)(localStorage, document);
      return applied;
    };

    expect(run("dark")).toEqual([["data-theme", "dark"]]);
    expect(run("light")).toEqual([["data-theme", "light"]]);
    expect(run("system")).toEqual([]);
    expect(run(null)).toEqual([]);
  });
});
