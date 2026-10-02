import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { safeFetch } from "@/lib/import/fetch-page";
import { ImportError, parseImportUrl } from "@/lib/import/url";

/**
 * Le foto delle ricette. Stanno su disco, nella cartella `UPLOADS_DIR` (nel
 * container è un volume Docker), e nel database c'è solo il nome del file.
 *
 * Ogni immagine, caricata dal telefono o scaricata dall'import, passa da
 * `sharp`: ruotata come è stata scattata, ridotta a 1600 px di lato e
 * convertita in WebP. Così una foto da 8 MB del telefono diventa qualche
 * centinaio di KB, e quello che si salva è sempre un'immagine vera, non un
 * file qualunque con l'estensione giusta.
 */

const MAX_SIDE = 1600;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function uploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? "./uploads");
}

/** Il nome di un file di foto: casuale, quindi non indovinabile, e senza percorsi. */
export function isImageKey(key: string): boolean {
  return /^[a-f0-9]{32}\.webp$/.test(key);
}

export class PhotoError extends Error {}

/** Converte e salva un'immagine; restituisce il nome del file. */
export async function storeImage(input: Buffer): Promise<string> {
  let output: Buffer;
  try {
    output = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new PhotoError("Il file non è un'immagine che riesco a leggere.");
  }

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const key = `${randomBytes(16).toString("hex")}.webp`;
  // Prima un file temporaneo, poi la rinomina: chi legge la cartella non vede
  // mai un'immagine scritta a metà.
  const temporary = path.join(dir, `${key}.tmp`);
  await writeFile(temporary, output);
  await rename(temporary, path.join(dir, key));
  return key;
}

/** Scarica l'immagine trovata dall'import, con gli stessi controlli delle pagine. */
export async function storeImageFromUrl(rawUrl: string): Promise<string> {
  const url = parseImportUrl(rawUrl);
  const response = await safeFetch(url, { accept: "image/*", maxBytes: MAX_UPLOAD_BYTES });
  if (response.contentType && !/^image\//i.test(response.contentType)) {
    throw new ImportError("Il link dell'immagine non porta a un'immagine.", "non_immagine");
  }
  return storeImage(response.body);
}

export async function readImage(key: string): Promise<Buffer | null> {
  if (!isImageKey(key)) return null;
  try {
    return await readFile(path.join(uploadsDir(), key));
  } catch {
    return null;
  }
}

/** Toglie una foto che nessuna ricetta usa più. Se non c'è, va bene lo stesso. */
export async function deleteImage(key: string | null | undefined): Promise<void> {
  if (!key || !isImageKey(key)) return;
  try {
    await unlink(path.join(uploadsDir(), key));
  } catch {
    // Già tolta: niente da fare.
  }
}
