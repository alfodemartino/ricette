import { SkeletonForm, SkeletonPage } from "@/components/Skeletons";
import { Card, Skeleton } from "@/components/ui";

/** Il form mentre il server prepara i tag della famiglia (e, in modifica, la ricetta). */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-6">
      <header>
        <p className="text-[15px] text-tint">‹ Ricette</p>
        <Skeleton className="mt-2 h-8 w-56 max-w-full" />
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="La ricetta">
          <SkeletonForm fields={3} />
        </Card>
        <Card title="Foto">
          <Skeleton className="aspect-[4/3] w-full max-w-sm rounded-control" />
        </Card>
      </div>
    </SkeletonPage>
  );
}
