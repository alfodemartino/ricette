import { removeSiteAction } from "@/app/actions/cook-with";
import { AddSiteForm } from "@/components/forms/AddSiteForm";
import { NavLink } from "@/components/NavLink";
import { SubmitButton } from "@/components/SubmitButton";
import { Card } from "@/components/ui";
import { listFamilySites, MAX_FAMILY_SITES } from "@/lib/family-sites";
import { BUILT_IN_SITES } from "@/lib/import/sites";
import { requireFamilyViewer } from "@/lib/session";

export const metadata = { title: "Siti per la ricerca — Ricette" };

const dateFormat = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "Europe/Rome" });

/**
 * I siti in cui «Cosa cucino con…» cerca: quelli dell'app, fissi, e quelli
 * che la famiglia ha aggiunto, che chiunque della famiglia può togliere.
 */
export default async function SitesPage() {
  const viewer = await requireFamilyViewer();
  const sites = await listFamilySites(viewer.familyId);
  const full = sites.length >= MAX_FAMILY_SITES;

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

      <Card
        title="Aggiungi un sito"
        description={full ? `La famiglia ha già ${MAX_FAMILY_SITES} siti: per aggiungerne un altro togline uno.` : "Di solito vanno bene i siti fatti con WordPress."}
      >
        <AddSiteForm disabled={full} />
      </Card>

      <Card title="Aggiunti dalla famiglia" flush>
        {sites.length === 0 ? (
          <p className="px-4 py-6 text-center text-[15px] text-label-secondary">Ancora nessuno.</p>
        ) : (
          <ul className="divide-y divide-separator">
            {sites.map((site) => (
              <li key={site.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{site.name}</p>
                  <p className="truncate text-[12px] text-label-secondary">
                    {site.host} · aggiunto {site.createdBy ? `da ${site.createdBy} ` : ""}il {dateFormat.format(site.createdAt)}
                  </p>
                </div>
                <form action={removeSiteAction}>
                  <input type="hidden" name="id" value={site.id} />
                  <SubmitButton variant="danger" size="sm" pendingLabel="Tolgo…">
                    Togli
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Dell'app" flush>
        <ul className="divide-y divide-separator">
          {BUILT_IN_SITES.map((site) => (
            <li key={site.id} className="px-4 py-2.5">
              <p className="text-[15px] font-medium">{site.name}</p>
              <p className="text-[12px] text-label-secondary">{site.host}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
