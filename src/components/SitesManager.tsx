"use client";

import { useState, useTransition } from "react";
import {
  addKnownSiteAction,
  addSiteAction,
  removeSiteAction,
  setSiteEnabledAction,
  type SitesState,
} from "@/app/actions/cook-with";
import { useLoadingWhile } from "@/components/LoadingOverlay";
import { Alert, buttonClass, Card, Input, Switch } from "@/components/ui";
import type { SiteListItem, SitesOverview } from "@/lib/family-sites";

const dateFormat = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "Europe/Rome" });

const FAILED = "Qualcosa è andato storto: ricarica la pagina e riprova.";

/**
 * Un sito della famiglia: interruttore e «Togli». Spento, il sito resta ma la
 * ricerca non lo usa, e il nome si fa grigio.
 */
function SiteRow({
  site,
  busy,
  onRemove,
  onToggle,
}: {
  site: SiteListItem;
  busy: boolean;
  onRemove: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className={`truncate text-[15px] font-medium ${site.enabled ? "" : "text-label-secondary"}`}>{site.name}</p>
        <p className="truncate text-[12px] text-label-secondary">
          {site.enabled ? "" : "Spento · "}
          {site.host} · aggiunto {site.addedBy ? `da ${site.addedBy} ` : ""}il {dateFormat.format(site.addedAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Togli ${site.name}`}
          className={buttonClass("danger", "", "sm")}
        >
          Togli
        </button>
        <Switch checked={site.enabled} onChange={onToggle} label={`Cerca su ${site.name}`} />
      </div>
    </li>
  );
}

/**
 * La gestione dei siti di «Cosa cucino con…». La famiglia parte senza siti:
 * li aggiunge fra quelli già provati, con un tocco, o scrivendo un indirizzo,
 * che l'app prova prima di accettarlo. Poi li accende, li spegne e li toglie.
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
  const full = sites.sites.length >= maxFamilySites;
  const busy = changing || adding;

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
        setMessage({ error: FAILED });
      }
    });
  }

  function change(task: () => Promise<SitesState>) {
    startChanging(async () => {
      try {
        apply(await task());
      } catch {
        setMessage({ error: FAILED });
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
      setSites((current) => ({ ...current, sites: current.sites.map((site) => (site.id === id ? { ...site, enabled: value } : site)) }));
    flip(enabled);
    startToggling(async () => {
      try {
        apply(await setSiteEnabledAction(id, enabled));
      } catch {
        flip(!enabled);
        setMessage({ error: FAILED });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card
        title="Aggiungi un sito"
        description={
          full
            ? `La famiglia ha già ${maxFamilySites} siti: per aggiungerne un altro togline uno.`
            : "Di solito vanno bene i siti fatti con WordPress. La prova richiede qualche secondo."
        }
      >
        <form onSubmit={add} className="space-y-3">
          {message.error && <Alert tone="error">{message.error}</Alert>}
          {message.added && (
            <Alert tone="success">
              {message.added.name} aggiunto.
              {message.added.samples.length > 0 && ` Ricette trovate per prova: ${message.added.samples.join(", ")}.`}
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
        title="Siti della famiglia"
        description="Con l'interruttore spento «Cerca anche online» salta il sito, che resta qui. «Togli» lo toglie dall'elenco."
        flush
      >
        {sites.sites.length === 0 ? (
          <p className="px-4 py-6 text-center text-[15px] text-label-secondary">
            Ancora nessun sito: la ricerca online parte quando ne aggiungi uno, qui sopra o fra quelli già provati.
          </p>
        ) : (
          <ul className="divide-y divide-separator">
            {sites.sites.map((site) => (
              <SiteRow
                key={site.id}
                site={site}
                busy={busy}
                onRemove={() => change(() => removeSiteAction(site.id))}
                onToggle={(enabled) => setEnabled(site.id, enabled)}
              />
            ))}
          </ul>
        )}
      </Card>

      {sites.suggestions.length > 0 && (
        <Card
          title="Siti già provati"
          description="Verificati per l'app: hanno i dati che l'import sa leggere e una ricerca che il sito permette. Si aggiungono con un tocco."
          flush
        >
          <ul className="divide-y divide-separator">
            {sites.suggestions.map((site) => (
              <li key={site.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{site.name}</p>
                  <p className="truncate text-[12px] text-label-secondary">{site.host}</p>
                </div>
                <button
                  type="button"
                  onClick={() => change(() => addKnownSiteAction(site.id))}
                  disabled={busy || full}
                  aria-label={`Aggiungi ${site.name}`}
                  className={buttonClass("secondary", "shrink-0", "sm")}
                >
                  Aggiungi
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
