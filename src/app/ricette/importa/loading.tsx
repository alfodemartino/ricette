import { SkeletonPage } from "@/components/Skeletons";
import { Card, Skeleton } from "@/components/ui";

/** La pagina di import ha una casella sola: si mostra subito per com'è. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-6">
      <header>
        <p className="text-[15px] text-tint">‹ Ricette</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em]">Importa da link</h1>
      </header>
      <Card title="Link della ricetta">
        <Skeleton className="h-11 w-full rounded-control" />
      </Card>
    </SkeletonPage>
  );
}
