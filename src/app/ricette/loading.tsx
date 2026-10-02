import { SkeletonPage, SkeletonRecipeCards } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui";

/** L'elenco mentre arrivano le ricette: titolo e pulsanti veri, schede grigie. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-5">
      <header>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Ricette</h1>
        <Skeleton className="mt-1 h-3.5 w-52" />
      </header>
      <Skeleton className="h-11 w-full rounded-control" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>
      <SkeletonRecipeCards />
    </SkeletonPage>
  );
}
