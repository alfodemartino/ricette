import Form from "next/form";
import { CookWithOnline } from "@/components/CookWithOnline";
import { MatchFacts } from "@/components/MatchFacts";
import { SearchModes } from "@/components/SearchModes";
import { RecipeCard } from "@/components/RecipeCard";
import { Alert, buttonClass, EmptyState, Input } from "@/components/ui";
import {
  amountHint,
  countableWanted,
  limitingAmount,
  matchRecipe,
  MAX_WANTED_TEXT,
  parseWanted,
  rankMatches,
  type RecipeMatch,
} from "@/lib/cook-with";
import { listSearchSites } from "@/lib/family-sites";
import { quantityInput, unitLabel } from "@/lib/ingredients";
import { listFamilyRecipes } from "@/lib/recipes";
import { requireFamilyViewer } from "@/lib/session";

export const metadata = { title: "Cosa cucino con… — Ricette" };

type FamilyRecipe = Awaited<ReturnType<typeof listFamilyRecipes>>[number];
type Ranked = FamilyRecipe & { match: RecipeMatch<FamilyRecipe["ingredients"][number]> };

/**
 * Il link alla ricetta: già ricalcolata sull'ingrediente che finisce per
 * primo, se se ne è scritta la quantità.
 */
function recipeHref(recipe: Ranked): string {
  const limiting = limitingAmount(recipe.match);
  if (!limiting?.ingredient.id) return `/ricette/${recipe.id}`;
  const { quantity, unit } = limiting.wanted;
  const amount = [quantityInput(quantity), unit && unitLabel(unit, quantity)].filter(Boolean).join(" ");
  return `/ricette/${recipe.id}?${new URLSearchParams({ da: limiting.ingredient.id, quantita: amount })}`;
}

function MatchList({ title, recipes }: { title: string; recipes: Ranked[] }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[15px] font-semibold tracking-tight">
        {title} <span className="font-normal text-label-secondary">· {recipes.length}</span>
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} href={recipeHref(recipe)}>
            <MatchFacts
              missing={recipe.match.missing.map((item) => item.name)}
              alsoNeeded={recipe.match.alsoNeeded}
              amount={amountHint(recipe.servings, limitingAmount(recipe.match))}
            />
          </RecipeCard>
        ))}
      </ul>
    </section>
  );
}

/**
 * «Cosa cucino con…»: si scrivono gli ingredienti che si hanno e la pagina
 * mostra le ricette del ricettario che li usano. Sotto, a richiesta, la
 * ricerca sui siti. Gli ingredienti stanno nell'indirizzo
 * (`?ingredienti=zucchine, ricotta`), così la ricerca si ricarica e si torna
 * indietro senza perderla.
 */
export default async function CookWithPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireFamilyViewer();
  const raw = (await searchParams).ingredienti;
  const text = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, MAX_WANTED_TEXT) ?? "";
  const wanted = parseWanted(text);
  const countable = countableWanted(wanted);

  const [recipes, sites] = await Promise.all([
    countable > 0 ? listFamilyRecipes(viewer.familyId) : Promise.resolve([]),
    countable > 0 ? listSearchSites(viewer.familyId) : Promise.resolve([]),
  ]);
  const ranked = rankMatches(
    recipes.map((recipe) => ({ ...recipe, match: matchRecipe(wanted, recipe.ingredients) })),
    wanted,
  );
  const found = ranked.all.length + ranked.almost.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Cosa cucino con…</h1>
        <p className="max-w-2xl text-[13px] text-label-secondary">
          Scrivi quello che hai, separato da virgole. Con le quantità («300 g zucchine») ti dico anche per quanti
          basta. Sale, pepe, olio e acqua si danno per scontati.
        </p>
      </header>

      {/* Al posto di «‹ Ricette»: le due ricerche sono allo stesso livello. */}
      <SearchModes active="ingredienti" />

      <Form action="/ricette/cosa-cucino" role="search" className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="ingredienti"
          defaultValue={text}
          key={text}
          maxLength={MAX_WANTED_TEXT}
          placeholder="300 g zucchine, ricotta, menta"
          aria-label="Gli ingredienti che hai"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" className={buttonClass("primary", "shrink-0")}>
          Cerca
        </button>
      </Form>

      {text && countable === 0 && (
        <Alert tone="info">Scrivi almeno un ingrediente che non sia sale, pepe, olio o acqua.</Alert>
      )}

      {countable > 0 && (
        <>
          {found === 0 ? (
            <div className="rounded-card bg-surface">
              <EmptyState>Nel ricettario non c&apos;è niente con questi ingredienti.</EmptyState>
            </div>
          ) : (
            <div className="space-y-6">
              {ranked.all.length > 0 && <MatchList title="Con tutti gli ingredienti" recipes={ranked.all} />}
              {ranked.almost.length > 0 && <MatchList title="Ne manca uno" recipes={ranked.almost} />}
            </div>
          )}

          {/* La chiave riparte da zero a ogni ricerca nuova. */}
          <CookWithOnline
            key={text}
            text={text}
            sites={sites.map(({ id, name, builtIn }) => ({ id, name, builtIn }))}
            prominent={ranked.all.length === 0}
          />
        </>
      )}
    </div>
  );
}
