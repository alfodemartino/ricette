import { prisma } from "@/lib/db";
import { isImageKey, readImage } from "@/lib/photos";
import { loadViewer } from "@/lib/session";

/**
 * Le foto delle ricette, servite solo ai membri della famiglia che le
 * possiede. Per tutti gli altri — anche chi conosce il nome del file — la
 * foto non esiste.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const notFound = new Response("Non trovata", { status: 404 });
  if (!isImageKey(key)) return notFound;

  const viewer = await loadViewer();
  if (!viewer?.familyId) return notFound;

  const owner = await prisma.recipe.findFirst({
    where: { imageKey: key, familyId: viewer.familyId },
    select: { id: true },
  });
  if (!owner) return notFound;

  const image = await readImage(key);
  if (!image) return notFound;

  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(image.length),
      // Il nome cambia a ogni nuova foto, quindi il contenuto di un nome non
      // cambia mai: il browser può tenerla. `private` perché è dietro login.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
