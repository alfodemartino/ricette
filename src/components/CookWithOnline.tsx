"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { searchSiteAction, type SiteSearchState, type WebResult } from "@/app/actions/cook-with";
import { useLoadingWhile } from "@/components/LoadingOverlay";
import { MatchFacts } from "@/components/MatchFacts";
import { NavLink } from "@/components/NavLink";
import { RecipeLinks } from "@/components/RecipeLinks";
import { Badge, buttonClass, Logo, Skeleton } from "@/components/ui";
import { IMPORT_NOW_KEY } from "@/lib/cook-with";
import { formatMinutes } from "@/lib/duration";

/** I siti spenti, ricordati nel browser: è una comodità di chi cerca, non un dato della famiglia. */
const OFF_KEY = "ricette.siti-spenti";

type Site = { id: string; name: string };
type SiteState = "loading" | SiteSearchState;

function readOff(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(OFF_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeOff(off: string[]) {
  try {
    localStorage.setItem(OFF_KEY, JSON.stringify(off));
  } catch {
    // Navigazione privata o spazio pieno: la scelta vale per questa pagina e basta.
  }
}

/** Un risultato di un sito: miniatura, titolo, cosa manca, e i due modi di proseguire. */
function WebResultRow({ result, siteName }: { result: WebResult; siteName: string }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  useLoadingWhile(opening);
  const minutes = formatMinutes(result.minutes);

  function importNow() {
    try {
      sessionStorage.setItem(IMPORT_NOW_KEY, result.url);
    } catch {
      // Senza sessionStorage il link arriva precompilato: basta un tocco su «Importa».
    }
    setOpening(true);
    router.push(`/ricette/importa?${new URLSearchParams({ url: result.url })}`);
  }

  return (
    <li className="flex gap-3 px-4 py-3">
      {result.imageUrl ? (
        // Le foto restano sul sito: qui si mostrano e basta, senza dire al sito da quale pagina.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-16 shrink-0 rounded-control bg-fill object-cover"
        />
      ) : (
        <div aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-control bg-fill">
          <Logo className="size-7 text-label-tertiary" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="text-[15px] leading-snug font-semibold">{result.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge>{siteName}</Badge>
          {minutes && <Badge>{minutes}</Badge>}
        </div>
        <MatchFacts missing={result.missing} alsoNeeded={result.alsoNeeded} amount={result.amount} />
        {result.existing.length > 0 && (
          <p className="text-[13px] text-label-secondary">
            Già nel ricettario: <RecipeLinks recipes={result.existing} />
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={importNow} disabled={opening} className={buttonClass("secondary", "", "sm")}>
            Importa
          </button>
          <a href={result.url} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("ghost", "", "sm")}>
            Apri sul sito ↗
          </a>
        </div>
      </div>
    </li>
  );
}

function SiteResults({ site, state, allRequired }: { site: Site; state: SiteState; allRequired: boolean }) {
  if (state === "loading") {
    return (
      <section aria-busy="true" className="rounded-card bg-surface">
        <h3 className="px-4 pt-3 text-[13px] font-semibold text-label-secondary">{site.name} · cerco…</h3>
        <div className="flex gap-3 px-4 py-3">
          <Skeleton className="size-16 shrink-0 rounded-control" />
          <div className="flex-1">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="mt-2 h-3 w-64 max-w-full" />
          </div>
        </div>
      </section>
    );
  }
  if (!state.ok) {
    return <p className="px-1 text-[13px] text-label-secondary">{state.error}</p>;
  }
  const results = allRequired ? state.all : [...state.all, ...state.almost];
  if (results.length === 0) {
    return (
      <p className="px-1 text-[13px] text-label-secondary">
        {site.name}: niente con {allRequired ? "tutti questi" : "questi"} ingredienti
        {state.checked > 0 && ` fra le prime ${state.checked} ricette trovate`}.
      </p>
    );
  }
  return (
    <section className="rounded-card bg-surface">
      <h3 className="px-4 pt-3 text-[13px] font-semibold text-label-secondary">{site.name}</h3>
      <ul className="divide-y divide-separator">
        {results.map((result) => (
          <WebResultRow key={result.url} result={result} siteName={site.name} />
        ))}
      </ul>
    </section>
  );
}

/**
 * La ricerca sui siti di ricette. Parte solo col pulsante: ogni ricerca sono
 * decine di pagine da scaricare, e i risultati del ricettario non le
 * aspettano. Ogni sito si cerca per conto suo, così i risultati compaiono
 * man mano e un sito lento non trattiene gli altri. «Solo con tutti gli
 * ingredienti» filtra i risultati già arrivati: cambiarlo non rifà la ricerca.
 */
export function CookWithOnline({
  text,
  allRequired,
  sites,
  prominent,
}: {
  text: string;
  allRequired: boolean;
  sites: Site[];
  prominent: boolean;
}) {
  const [off, setOff] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, SiteState>>({});

  // Dopo il mount, quando `localStorage` si può leggere.
  useEffect(() => setOff(readOff()), []);

  function toggle(id: string) {
    const next = off.includes(id) ? off.filter((item) => item !== id) : [...off, id];
    setOff(next);
    writeOff(next);
  }

  const chosen = sites.filter((site) => !off.includes(site.id));
  const pending = chosen.filter((site) => states[site.id] === undefined);
  const shown = sites.filter((site) => states[site.id] !== undefined);

  function search() {
    for (const site of pending) {
      setStates((current) => ({ ...current, [site.id]: "loading" }));
      searchSiteAction(site.id, text)
        .catch((): SiteSearchState => ({ ok: false, error: `${site.name} non ha risposto.` }))
        .then((state) => setStates((current) => ({ ...current, [site.id]: state })));
    }
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Sui siti di ricette</h2>
          <p className="text-[13px] text-label-secondary">
            Le ricette dei siti si importano nel ricettario dopo averle controllate.
          </p>
        </div>
        <NavLink href="/ricette/cosa-cucino/siti" className="text-[13px] text-tint hover:underline">
          Gestisci i siti
        </NavLink>
      </header>

      <div className="scroll-x flex gap-2 pb-1">
        {sites.map((site) => {
          const active = !off.includes(site.id);
          return (
            <button
              key={site.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(site.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition ${
                active ? "bg-tint text-white" : "bg-surface text-label hover:bg-fill-strong"
              }`}
            >
              {site.name}
            </button>
          );
        })}
      </div>

      {pending.length > 0 && (
        <button type="button" onClick={search} className={buttonClass(prominent ? "primary" : "secondary")}>
          {shown.length === 0 ? "Cerca anche online" : `Cerca anche su ${pending.length === 1 ? pending[0].name : `altri ${pending.length} siti`}`}
        </button>
      )}
      {chosen.length === 0 && (
        <p className="px-1 text-[13px] text-label-secondary">
          {sites.length === 0
            ? "Nessun sito acceso per la ricerca online: aggiungine o accendine uno in «Gestisci i siti»."
            : "Accendi almeno un sito per cercare."}
        </p>
      )}

      {shown.length > 0 && (
        <div className="space-y-3">
          {shown.map((site) => (
            <SiteResults key={site.id} site={site} state={states[site.id]} allRequired={allRequired} />
          ))}
        </div>
      )}
    </section>
  );
}
