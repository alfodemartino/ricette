import { describe, expect, it } from "vitest";
import { cleanTagName, parseTagList, tagKey, uniqueTags } from "./tags";

describe("tag", () => {
  it("confronta senza maiuscole, accenti e spazi doppi", () => {
    expect(tagKey(" Più  veloce ")).toBe(tagKey("piu veloce"));
  });

  it("ripulisce il nome", () => {
    expect(cleanTagName("  #Vegetariano ")).toBe("vegetariano");
  });

  it("toglie vuoti e doppioni", () => {
    expect(uniqueTags(["Veloce", "veloce", "", "  ", "Estivo"])).toEqual(["veloce", "estivo"]);
  });

  it("legge un elenco separato da virgole", () => {
    expect(parseTagList("veloce, vegetariano; estivo,")).toEqual(["veloce", "vegetariano", "estivo"]);
  });
});
