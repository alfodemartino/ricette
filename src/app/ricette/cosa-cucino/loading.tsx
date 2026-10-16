import { SearchModes } from "@/components/SearchModes";
import { SkeletonPage, SkeletonRecipeCards } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui";

/** La ricerca per ingredienti mentre arriva: testata, scelta e casella vere, schede grigie. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Cosa cucino con…</h1>
        <Skeleton className="mt-1 h-3.5 w-80 max-w-full" />
      </header>
      <SearchModes active="ingredienti" />
      <div className="space-y-2">
        <Skeleton className="h-11 w-full rounded-control" />
        <Skeleton className="h-[47px] w-full rounded-card sm:h-[31px] sm:w-64" />
      </div>
      <SkeletonRecipeCards count={3} />
    </SkeletonPage>
  );
}
