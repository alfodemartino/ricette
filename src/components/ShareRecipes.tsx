"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { recipesToShareAction } from "@/app/actions/share";
import { useRecipePeople } from "@/components/RecipeView";
import { ShareSheet } from "@/components/ShareSheet";
import { ShareIcon, buttonClass } from "@/components/ui";
import type { ShareableRecipe } from "@/lib/share";

/** «Condividi» nella pagina della ricetta: il messaggio parte dalle persone scelte negli ingredienti. */
export function ShareRecipeButton({ recipe }: { recipe: ShareableRecipe }) {
  const [open, setOpen] = useState(false);
  const people = useRecipePeople();

  return (
    <>
      <button
        type="button"
        aria-label="Condividi la ricetta"
        title="Condividi"
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-tint transition hover:bg-fill"
      >
        <ShareIcon />
      </button>
      <ShareSheet
        open={open}
        onClose={() => setOpen(false)}
        heading="Condividi la ricetta"
        recipes={[recipe]}
        initialPeople={people}
      />
    </>
  );
}

type SheetState = { open: boolean; heading: string; recipes: ShareableRecipe[] | null; error: string | null };

type ShareContextValue = {
  selecting: boolean;
  selected: string[];
  setSelecting: (selecting: boolean) => void;
  toggle: (id: string) => void;
  share: (ids: string[]) => void;
};

const ShareContext = createContext<ShareContextValue | null>(null);

/**
 * La condivisione dall'elenco: l'icona su una scheda manda quella ricetta,
 * il tasto in testata apre la selezione per mandarne diverse in un messaggio
 * solo. L'elenco non ha quantità né passi: le ricette scelte le prepara il
 * server mentre il pannello è già aperto.
 */
export function ShareRecipesProvider({ children }: { children: ReactNode }) {
  const [selecting, setSelectingState] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetState>({ open: false, heading: "", recipes: null, error: null });
  // L'ultima richiesta partita: la risposta per un pannello già chiuso non lo riempie.
  const request = useRef(0);

  async function share(ids: string[]) {
    const current = (request.current += 1);
    setSheet({
      open: true,
      heading: ids.length === 1 ? "Condividi la ricetta" : `Condividi ${ids.length} ricette`,
      recipes: null,
      error: null,
    });

    let next: Pick<SheetState, "recipes" | "error">;
    try {
      const result = await recipesToShareAction(ids);
      next = "error" in result ? { recipes: null, error: result.error } : { recipes: result.recipes, error: null };
    } catch {
      next = { recipes: null, error: "Non riesco a preparare il messaggio: controlla la connessione e riprova." };
    }
    if (request.current === current) setSheet((state) => ({ ...state, ...next }));
  }

  function setSelecting(value: boolean) {
    setSelectingState(value);
    setSelected([]);
  }

  // Le ricette restano nell'ordine in cui si toccano: è l'ordine del messaggio.
  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  return (
    <ShareContext.Provider value={{ selecting, selected, setSelecting, toggle, share }}>
      {children}
      {selecting && <SelectionBar count={selected.length} onShare={() => share(selected)} />}
      <ShareSheet
        open={sheet.open}
        onClose={() => {
          request.current += 1;
          setSheet((state) => ({ ...state, open: false }));
        }}
        heading={sheet.heading}
        recipes={sheet.recipes}
        error={sheet.error}
      />
    </ShareContext.Provider>
  );
}

/** La barra in basso durante la selezione, come quella di Foto: quante sono e «Condividi». */
function SelectionBar({ count, onShare }: { count: number; onShare: () => void }) {
  return (
    <>
      {/* Il posto della barra in fondo all'elenco, così l'ultima scheda non ci finisce sotto. */}
      <div aria-hidden className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-surface/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <p aria-live="polite" className="text-[15px] text-label-secondary">
            {count === 0 ? "Tocca le ricette da mandare" : count === 1 ? "1 ricetta scelta" : `${count} ricette scelte`}
          </p>
          <button type="button" disabled={count === 0} onClick={onShare} className={buttonClass("primary")}>
            <ShareIcon />
            Condividi
          </button>
        </div>
      </div>
    </>
  );
}

/** Il tasto in testata dell'elenco: apre la selezione delle ricette da mandare, e la chiude. */
export function ShareSelectionToggle() {
  const context = useContext(ShareContext);
  if (!context) return null;

  if (context.selecting) {
    return (
      <button type="button" onClick={() => context.setSelecting(false)} className={buttonClass("secondary")}>
        Annulla
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label="Scegli le ricette da condividere"
      title="Condividi"
      onClick={() => context.setSelecting(true)}
      className={buttonClass("secondary", "", "icon")}
    >
      <ShareIcon />
    </button>
  );
}

/**
 * Quello che durante la selezione non serve: in testata resta solo «Annulla»,
 * come in Foto. Sul telefono, accanto ad «Annulla», gli altri pulsanti non
 * starebbero su una riga.
 */
export function HideWhileSelecting({ children }: { children: ReactNode }) {
  const context = useContext(ShareContext);
  return context?.selecting ? null : children;
}

/**
 * Una scheda dell'elenco. Durante la selezione la copre un pulsante: un tocco
 * la sceglie invece di aprirla, e il cerchio al posto dell'icona di
 * condivisione dice se è scelta.
 */
export function SelectableRecipe({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const context = useContext(ShareContext);
  const selecting = context?.selecting ?? false;
  const selected = context?.selected.includes(id) ?? false;

  return (
    <div className="relative h-full">
      <div inert={selecting} className="h-full">
        {children}
      </div>
      {selecting && (
        <button
          type="button"
          aria-pressed={selected}
          aria-label={title}
          onClick={() => context?.toggle(id)}
          className={`absolute inset-0 rounded-card transition ${selected ? "ring-2 ring-tint" : ""}`}
        >
          <span
            aria-hidden
            className={`absolute inset-y-0 right-3 my-auto flex size-7 items-center justify-center rounded-full border-2 text-[14px] font-semibold sm:top-auto sm:right-4 sm:bottom-4 sm:my-0 ${
              selected ? "border-tint bg-tint text-white" : "border-label-tertiary bg-surface"
            }`}
          >
            {selected && "✓"}
          </span>
        </button>
      )}
    </div>
  );
}

/** L'icona di condivisione su una scheda dell'elenco: manda quella ricetta sola. */
export function ShareRecipeCardButton({ id, title, className = "" }: { id: string; title: string; className?: string }) {
  const context = useContext(ShareContext);
  if (!context || context.selecting) return null;

  return (
    <button
      type="button"
      aria-label={`Condividi «${title}»`}
      title="Condividi"
      onClick={() => context.share([id])}
      className={`flex size-11 items-center justify-center rounded-full text-tint transition hover:bg-fill ${className}`}
    >
      <ShareIcon />
    </button>
  );
}
