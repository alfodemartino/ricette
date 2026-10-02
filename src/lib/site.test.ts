import { describe, expect, it } from "vitest";
import { siteName } from "./site";

describe("siteName", () => {
  it("tiene solo il sito, senza protocollo, www e percorso", () => {
    expect(siteName("https://www.ricetteperbimby.it/ricette/risotto-con-zucchine-bimby")).toBe("ricetteperbimby.it");
    expect(siteName("https://ricette.esempio.it/tiramisu?ref=home")).toBe("ricette.esempio.it");
    expect(siteName("http://WWW2.Esempio.IT:8080/pagina")).toBe("esempio.it");
  });

  it("toglie le versioni per il telefono", () => {
    expect(siteName("https://m.youtube.com/watch?v=abcDEF12345")).toBe("youtube.com");
    expect(siteName("https://mobile.esempio.it/ricetta")).toBe("esempio.it");
  });

  it("dà agli indirizzi corti dei social il nome del sito", () => {
    expect(siteName("https://youtu.be/abcDEF12345")).toBe("youtube.com");
    expect(siteName("https://vm.tiktok.com/ZM123/")).toBe("tiktok.com");
  });

  it("restituisce null se l'indirizzo manca o non si legge", () => {
    expect(siteName(null)).toBeNull();
    expect(siteName("")).toBeNull();
    expect(siteName("non è un indirizzo")).toBeNull();
  });
});
