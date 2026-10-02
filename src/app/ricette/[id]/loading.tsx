import { SkeletonLines, SkeletonPage } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui";

/** La ricetta mentre arriva: le due sezioni hanno già il loro titolo vero. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-6">
      <header>
        <p className="text-[15px] text-tint">‹ Ricette</p>
        <Skeleton className="mt-2 h-9 w-72 max-w-full" />
        <Skeleton className="mt-3 h-5 w-40" />
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          <Skeleton className="aspect-[4/3] w-full rounded-card" />
          <section>
            <h2 className="mb-2 px-1 text-[15px] font-semibold tracking-tight">Ingredienti</h2>
            <div className="rounded-card bg-surface p-4">
              <SkeletonLines count={5} />
            </div>
          </section>
        </div>
        <section>
          <h2 className="mb-2 px-1 text-[15px] font-semibold tracking-tight">Procedimento</h2>
          <div className="space-y-4 rounded-card bg-surface p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex gap-3">
                <span aria-hidden className="size-7 shrink-0 animate-pulse rounded-full bg-fill motion-reduce:animate-none" />
                <span className="flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SkeletonPage>
  );
}
