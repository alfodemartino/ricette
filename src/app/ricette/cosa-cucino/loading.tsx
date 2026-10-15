import { SkeletonPage, SkeletonRecipeCards } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui";

/** La ricerca per ingredienti mentre arriva: testata e casella vere, schede grigie. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-6">
      <header>
        <p className="text-[15px] text-tint">‹ Ricette</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em]">Cosa cucino con…</h1>
        <Skeleton className="mt-1 h-3.5 w-80 max-w-full" />
      </header>
      <Skeleton className="h-11 w-full rounded-control" />
      <SkeletonRecipeCards count={3} />
    </SkeletonPage>
  );
}
