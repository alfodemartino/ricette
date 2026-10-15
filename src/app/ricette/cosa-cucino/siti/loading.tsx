import { SkeletonPage, SkeletonRows } from "@/components/Skeletons";
import { Card, Skeleton } from "@/components/ui";

/** I siti mentre arrivano: titoli e casella veri, elenchi grigi. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-6">
      <header>
        <p className="text-[15px] text-tint">‹ Cosa cucino con…</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em]">Siti per la ricerca</h1>
      </header>
      <Card title="Aggiungi un sito">
        <Skeleton className="h-11 w-full rounded-control" />
      </Card>
      <Card title="Aggiunti dalla famiglia" flush>
        <SkeletonRows count={1} />
      </Card>
      <Card title="Dell'app" flush>
        <SkeletonRows count={7} />
      </Card>
    </SkeletonPage>
  );
}
