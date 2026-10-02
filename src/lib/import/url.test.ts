import { describe, expect, it } from "vitest";
import { ImportError, isPrivateAddress, isVideoHost, parseImportUrl, resolvedSource, sourceKey, youtubeVideoId } from "./url";

describe("parseImportUrl", () => {
  it("accetta i link normali e aggiunge https se manca", () => {
    expect(parseImportUrl("https://www.esempio.it/ricetta").href).toBe("https://www.esempio.it/ricetta");
    expect(parseImportUrl("esempio.it/ricetta#commenti").href).toBe("https://esempio.it/ricetta");
  });

  it.each([
    ["", "link_vuoto"],
    ["ftp://esempio.it/file", "protocollo"],
    ["http://utente:password@esempio.it/", "credenziali_nel_link"],
    ["http://esempio.it:5432/", "porta"],
    ["http://localhost/", "indirizzo_privato"],
    ["http://127.0.0.1/", "indirizzo_privato"],
    ["http://192.168.1.1/", "indirizzo_privato"],
    ["http://[::1]/", "indirizzo_privato"],
    ["http://nas/", "indirizzo_privato"],
    ["http://proxmox.lan/", "indirizzo_privato"],
  ])("rifiuta «%s»", (raw, reason) => {
    expect(() => parseImportUrl(raw)).toThrow(ImportError);
    try {
      parseImportUrl(raw);
    } catch (error) {
      expect((error as ImportError).reason).toBe(reason);
    }
  });
});

describe("isPrivateAddress", () => {
  it.each([
    "10.0.0.5",
    "127.0.0.1",
    "172.16.4.1",
    "172.31.255.255",
    "192.168.1.50",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:192.168.1.1",
    "::ffff:c0a8:0101",
    "non-un-ip",
  ])("%s è privato", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "151.101.1.1", "172.32.0.1", "2a00:1450:4002::200e", "::ffff:8.8.8.8"])("%s è pubblico", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe("piattaforme", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("riconosce il video di %s", (link, id) => {
    expect(youtubeVideoId(new URL(link))).toBe(id);
  });

  it("non scambia altre pagine di YouTube per video", () => {
    expect(youtubeVideoId(new URL("https://www.youtube.com/@canale"))).toBeNull();
    expect(youtubeVideoId(new URL("https://www.esempio.it/watch?v=abcdefgh"))).toBeNull();
  });

  it("riconosce i social come video", () => {
    expect(isVideoHost(new URL("https://www.instagram.com/reel/abc/"))).toBe(true);
    expect(isVideoHost(new URL("https://vm.tiktok.com/abc"))).toBe(true);
    expect(isVideoHost(new URL("https://www.giallozafferano.it/ricetta"))).toBe(false);
  });
});

describe("sourceKey", () => {
  it.each([
    ["https://www.esempio.it/ricette/tiramisu/", "http://esempio.it/ricette/tiramisu"],
    ["https://esempio.it/tiramisu?utm_source=whatsapp&fbclid=abc#commenti", "https://esempio.it/tiramisu"],
    ["https://m.esempio.it/tiramisu", "https://esempio.it/tiramisu"],
    ["https://esempio.it/ricetta?id=4&lang=it", "https://esempio.it/ricetta?lang=it&id=4"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://www.instagram.com/reel/ABC123/?igsh=xyz", "https://instagram.com/reel/ABC123"],
  ])("«%s» e «%s» sono la stessa fonte", (a, b) => {
    expect(sourceKey(a)).toBe(sourceKey(b));
  });

  it.each([
    ["https://esempio.it/tiramisu", "https://esempio.it/panna-cotta"],
    ["https://esempio.it/ricetta?id=4", "https://esempio.it/ricetta?id=5"],
    ["https://esempio.it/tiramisu", "https://altro-sito.it/tiramisu"],
  ])("«%s» e «%s» sono fonti diverse", (a, b) => {
    expect(sourceKey(a)).not.toBe(sourceKey(b));
  });

  it("non dà una chiave a ciò che non è un link http", () => {
    expect(sourceKey("")).toBeNull();
    expect(sourceKey("non un link")).toBeNull();
    expect(sourceKey("javascript:alert(1)")).toBeNull();
  });
});

describe("resolvedSource", () => {
  const resolved = (pasted: string, final: string) => resolvedSource(new URL(pasted), new URL(final));

  it("tiene la pagina a cui porta un link accorciato", () => {
    expect(resolved("https://bit.ly/abc123", "https://ricette.esempio.it/tiramisu")).toBe("https://ricette.esempio.it/tiramisu");
    expect(resolved("https://vm.tiktok.com/ZM123/", "https://www.tiktok.com/@cuoca/video/7012345678")).toBe(
      "https://www.tiktok.com/@cuoca/video/7012345678",
    );
  });

  it("ignora i redirect che non cambiano la fonte", () => {
    expect(resolved("http://esempio.it/tiramisu", "https://www.esempio.it/tiramisu/")).toBeNull();
  });

  it("ignora le pagine di accesso e di consenso", () => {
    expect(resolved("https://instagr.am/p/ABC", "https://www.instagram.com/accounts/login/?next=%2Fp%2FABC")).toBeNull();
    expect(resolved("https://goo.gl/abc", "https://consent.google.com/ml?continue=x")).toBeNull();
    expect(resolved("https://fb.me/abc", "https://www.facebook.com/login/")).toBeNull();
  });
});
