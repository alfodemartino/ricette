import { SkeletonForm, SkeletonPage, SkeletonRows } from "@/components/Skeletons";
import { Card, Skeleton } from "@/components/ui";

/**
 * La pagina della famiglia mentre si caricano nome, codice e membri. Non si sa
 * ancora se l'utente ha una famiglia: si mostra la forma più comune, quella di
 * chi ce l'ha.
 */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-6">
      <header>
        <p className="text-[13px] text-label-secondary">La mia famiglia</p>
        <Skeleton className="mt-1 h-8 w-56 max-w-full" />
        <Skeleton className="mt-2 h-3.5 w-36" />
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Codice di invito">
            <Skeleton className="h-11 w-48 rounded-control" />
          </Card>
          <Card title="Membri" flush>
            <SkeletonRows count={2} icon />
          </Card>
        </div>
        <Card title="Esci dalla famiglia">
          <SkeletonForm fields={0} />
        </Card>
      </div>
    </SkeletonPage>
  );
}
