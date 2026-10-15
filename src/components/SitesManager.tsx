"use client";

import { useState, useTransition } from "react";
import { addSiteAction, removeSiteAction, restoreSiteAction, setSiteEnabledAction, type SitesState } from "@/app/actions/cook-with";
import { useLoadingWhile } from "@/components/LoadingOverlay";
import { Alert, buttonClass, Card, Input, Switch } from "@/components/ui";
import type { SiteListItem, SitesOverview } from "@/lib/family-sites";

const dateFormat = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "Europe/Rome" });

/**
 * Una riga dell'elenco. I siti in elenco hanno l'interruttore (`onToggle`):
 * spento, il sito resta ma la ricerca non lo usa, e il nome si fa grigio.
 */
function SiteRow({
  site,
  action,
  label,
  busy,
  onClick,
  onToggle,
}: {
  site: SiteListItem;
  action: "danger" | "ghost";
  label: string;
  busy: boolean;
  onClick: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const detail = site.builtIn
    ? `${site.host} · dell'app`
    : `${site.host} · aggiunto ${site.addedBy ? `da ${site.addedBy} ` : ""}${site.addedAt ? `il ${dateFormat.format(site.addedAt)}` : ""}`;
  const off = onToggle && !site.enabled;
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className={`truncate text-[15px] font-medium ${off ? "text-label-secondary" : ""}`}>{site.name}</p>
        <p className="truncate text-[12px] text-label-secondary">
          {off ? "Spento · " : ""}
          {detail}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-label={`${label} ${site.name}`}
          className={buttonClass(action, "", "sm")}
        >
          {label}
        </button>
        {onToggle && <Switch checked={site.enabled} onChange={onToggle} label={`Cerca su ${site.name}`} />}
      </div>
    </li>
  );
}

/**
 * La gestione dei siti di «Cosa cucino con…»: aggiungerne uno dopo la
 * verifica, accendere e spegnere quelli in elenco, toglierli (anche quelli
 * dell'app) e rimettere quelli dell'app tolti.
 *
 * Ogni azione restituisce l'elenco aggiornato, che si mostra da qui: la pagina
 * non si ricostruisce dopo l'azione, e l'attesa finisce quando arriva la
 * risposta.
 */
export function SitesManager({ initial, maxFamilySites }: { initial: SitesOverview; maxFamilySites: number }) {
  const [sites, setSites] = useState(initial);
  const [message, setMessage] = useState<Pick<SitesState, "error" | "added">>({});
  const [url, setUrl] = useState("");
  const [adding, startAdding] = useTransition();
  const [changing, startChanging] = useTransition();
  const full = sites.familyCount >= maxFamilySites;

  useLoadingWhile(changing);

  function apply(result: SitesState) {
    if (result.sites) setSites(result.sites);
    setMessage({ error: result.error, added: result.added });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    startAdding(async () => {
      try {
        const result = await addSiteAction(url);
        apply(result);
        // Un sito rifiutato resta scritto, da correggere; uno aggiunto lascia la casella vuota.
        if (!result.error) setUrl("");
      } catch {
        setMessage({ error: "Qualcosa è andato storto: ricarica la pagina e riprova." });
      }
    });
  }

  /*
   * L'interruttore si sposta subito, come su iOS, e poi vale l'elenco che
   * torna dal server. Niente overlay: un interruttore che blocca la pagina
   * sembrerebbe rotto. Se la richiesta fallisce torna dov'era.
   */
  const [, startToggling] = useTransition();

  function setEnabled(id: string, enabled: boolean) {
    const flip = (value: boolean) =>
      setSites((current) => ({ ...current, active: current.active.map((site) => (site.id === id ? { ...site, enabled: value } : site)) }));
    flip(enabled);
    startToggling(async () => {
      try {
        apply(await setSiteEnabledAction(id, enabled));
      } catch {
        flip(!enabled);
        setMessage({ error: "Qualcosa è andato storto: ricarica la pagina e riprova." });
      }
    });
  }

  function change(task: () => Promise<SitesState>) {
    startChanging(async () => {
      try {
        apply(await task());
      } catch {
        setMessage({ error: "Qualcosa è andato storto: ricarica la pagina e riprova." });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card
        title="Aggiungi un sito"
        description={
          full
            ? `La famiglia ha già aggiunto ${maxFamilySites} siti: per aggiungerne un altro togline uno.`
            : "Di solito vanno bene i siti fatti con WordPress. La prova richiede qualche secondo."
        }
      >
        <form onSubmit={add} className="space-y-3">
          {message.error && <Alert tone="error">{message.error}</Alert>}
          {message.added && (
            <Alert tone="success">
              {message.added.name} aggiunto. Ricette trovate per prova: {message.added.samples.join(", ")}.
            </Alert>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="url"
              // Non `type="url"`: il browser vorrebbe «https://» davanti, e
              // «www.sito.it» va bene lo stesso (lo completa `parseImportUrl`).
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://www.sitodiricette.it"
              aria-label="Indirizzo del sito"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={full || adding}
            />
            {/* Niente overlay qui: la prova dura qualche secondo e il pulsante dice cosa sta facendo. */}
            <button type="submit" disabled={full || adding || !url.trim()} className={buttonClass("primary", "shrink-0")}>
              {adding ? "Provo il sito…" : "Verifica e aggiungi"}
            </button>
          </div>
        </form>
      </Card>

      <Card
        title="Siti"
        description="Con l'interruttore spento «Cerca anche online» salta il sito, che resta qui. «Togli» lo toglie dall'elenco."
        flush
      >
        {sites.active.length === 0 ? (
          <p className="px-4 py-6 text-center text-[15px] text-label-secondary">
            Nessun sito: la ricerca online è spenta finché non ne aggiungi o rimetti uno.
          </p>
        ) : (
          <ul className="divide-y divide-separator">
            {sites.active.map((site) => (
              <SiteRow
                key={site.id}
                site={site}
                action="danger"
                label="Togli"
                busy={changing || adding}
                onClick={() => change(() => removeSiteAction(site.id))}
                onToggle={(enabled) => setEnabled(site.id, enabled)}
              />
            ))}
          </ul>
        )}
      </Card>

      {sites.removed.length > 0 && (
        <Card title="Tolti" description="I siti dell'app che avete tolto. Quelli aggiunti dalla famiglia, tolti, si cancellano." flush>
          <ul className="divide-y divide-separator">
            {sites.removed.map((site) => (
              <SiteRow
                key={site.id}
                site={site}
                action="ghost"
                label="Rimetti"
                busy={changing || adding}
                onClick={() => change(() => restoreSiteAction(site.id))}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
