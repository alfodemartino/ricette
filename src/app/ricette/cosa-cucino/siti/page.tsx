import { NavLink } from "@/components/NavLink";
import { SitesManager } from "@/components/SitesManager";
import { familySitesOverview, MAX_FAMILY_SITES } from "@/lib/family-sites";
import { requireFamilyViewer } from "@/lib/session";

export const metadata = { title: "Siti per la ricerca — Ricette" };

/**
 * I siti in cui «Cosa cucino con…» cerca: quelli dell'app e quelli che la
 * famiglia ha aggiunto. Chiunque della famiglia ne aggiunge, ne toglie e
 * rimette quelli dell'app.
 */
export default async function SitesPage() {
  const viewer = await requireFamilyViewer();
  const sites = await familySitesOverview(viewer.familyId);

  return (
    <div className="space-y-6">
      <header>
        <NavLink href="/ricette/cosa-cucino" className="text-[15px] text-tint hover:underline">
          ‹ Cosa cucino con…
        </NavLink>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em]">Siti per la ricerca</h1>
        <p className="max-w-2xl text-[13px] text-label-secondary">
          Dove si cercano le ricette che il ricettario non ha. Un sito nuovo entra solo se la sua ricerca si può
          leggere, se il sito non la vieta ai programmi e se le sue ricette hanno i dati che l&apos;app sa importare.
        </p>
      </header>

      <SitesManager initial={sites} maxFamilySites={MAX_FAMILY_SITES} />
    </div>
  );
}
