import { NavLink } from "@/components/NavLink";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeSearch } from "@/components/RecipeSearch";
import { ButtonLink, EmptyState } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import { filterRecipes, filtersHref, hasFilters, parseFilters, TIME_FILTERS, type RecipeFilters } from "@/lib/recipe-search";
import { listFamilyRecipes, listFamilyTags } from "@/lib/recipes";
import { requireFamilyViewer } from "@/lib/session";
import { tagKey } from "@/lib/tags";

export const metadata = { title: "Ricette" };

/** Una pastiglia dei filtri: blu quando è attiva, toccandola si accende o si spegne. */
function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition ${
        active ? "bg-tint text-white" : "bg-surface text-label hover:bg-fill-strong"
      }`}
    >
      {children}
    </NavLink>
  );
}

function toggleTag(filters: RecipeFilters, tag: string): RecipeFilters {
  const key = tagKey(tag);
  const has = filters.tags.some((entry) => tagKey(entry) === key);
  return { ...filters, tags: has ? filters.tags.filter((entry) => tagKey(entry) !== key) : [...filters.tags, tag] };
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireFamilyViewer();
  const filters = parseFilters(await searchParams);
  const [recipes, tags] = await Promise.all([listFamilyRecipes(viewer.familyId), listFamilyTags(viewer.familyId)]);
  const visible = filterRecipes(recipes, filters);
  const activeTags = new Set(filters.tags.map(tagKey));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Ricette</h1>
          <p className="text-[13px] text-label-secondary">
            {recipes.length === 1 ? "1 ricetta" : `${recipes.length} ricette`} nel ricettario di famiglia
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/ricette/importa" variant="secondary">
            Importa da link
          </ButtonLink>
          <ButtonLink href="/ricette/nuova">Nuova ricetta</ButtonLink>
        </div>
      </header>

      {recipes.length === 0 ? (
        <div className="rounded-card bg-surface">
          <EmptyState>
            Il ricettario è ancora vuoto. Scrivi la prima ricetta o importala da un sito o da un video.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <RecipeSearch filters={filters} />

            {/* Le pastiglie scorrono in orizzontale sul telefono invece di
                andare a capo in cinque righe. */}
            <div className="scroll-x flex gap-2 pb-1">
              <Chip href={filtersHref({ ...filters, category: null })} active={!filters.category}>
                Tutte
              </Chip>
              {CATEGORIES.map((category) => (
                <Chip
                  key={category.id}
                  href={filtersHref({ ...filters, category: filters.category === category.id ? null : category.id })}
                  active={filters.category === category.id}
                >
                  {category.plural}
                </Chip>
              ))}
            </div>

            <div className="scroll-x flex gap-2 pb-1">
              {TIME_FILTERS.map((minutes) => (
                <Chip
                  key={minutes}
                  href={filtersHref({ ...filters, maxMinutes: filters.maxMinutes === minutes ? null : minutes })}
                  active={filters.maxMinutes === minutes}
                >
                  Entro {minutes === 60 ? "1 ora" : `${minutes} min`}
                </Chip>
              ))}
              {tags.map((tag) => (
                <Chip key={tag.name} href={filtersHref(toggleTag(filters, tag.name))} active={activeTags.has(tagKey(tag.name))}>
                  #{tag.name}
                </Chip>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-card bg-surface">
              <EmptyState>
                Nessuna ricetta corrisponde alla ricerca.{" "}
                <NavLink href="/ricette" className="font-semibold text-tint hover:underline">
                  Azzera i filtri
                </NavLink>
              </EmptyState>
            </div>
          ) : (
            <>
              {hasFilters(filters) && (
                <p className="px-1 text-[13px] text-label-secondary">
                  {visible.length === 1 ? "1 ricetta trovata" : `${visible.length} ricette trovate`} ·{" "}
                  <NavLink href="/ricette" className="text-tint hover:underline">
                    azzera i filtri
                  </NavLink>
                </p>
              )}
              <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {visible.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
