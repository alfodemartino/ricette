import { notFound } from "next/navigation";
import { Menu } from "@/components/Menu";
import { NavLink } from "@/components/NavLink";
import { RecipePhoto } from "@/components/RecipeCard";
import { IngredientsSection, StepsSection } from "@/components/RecipeView";
import { DeleteRecipeButton } from "@/components/forms/DeleteRecipeButton";
import { Badge, Card, MoreIcon, menuItemClass } from "@/components/ui";
import { categoryLabel } from "@/lib/categories";
import { formatMinutes, totalMinutes } from "@/lib/duration";
import { filtersHref } from "@/lib/recipe-search";
import { getFamilyRecipe } from "@/lib/recipes";
import { assertId, requireFamilyViewer } from "@/lib/session";
import { siteName } from "@/lib/site";

const dateFormat = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireFamilyViewer();
  const id = assertId((await params).id);
  const recipe = await getFamilyRecipe(id, viewer.familyId);
  if (!recipe) notFound();

  const total = totalMinutes(recipe.prepMinutes, recipe.cookMinutes);
  const facts = [
    recipe.prepMinutes ? ["Preparazione", formatMinutes(recipe.prepMinutes)] : null,
    recipe.cookMinutes ? ["Cottura", formatMinutes(recipe.cookMinutes)] : null,
    recipe.prepMinutes && recipe.cookMinutes && total ? ["Totale", formatMinutes(total)] : null,
    recipe.servings ? ["Porzioni", String(recipe.servings)] : null,
  ].filter((fact): fact is string[] => fact !== null);

  return (
    <article className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <NavLink href="/ricette" className="text-[15px] text-tint hover:underline">
            ‹ Ricette
          </NavLink>
          <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[34px]">{recipe.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recipe.category && (
              <NavLink href={filtersHref({ q: "", category: recipe.category, tags: [], maxMinutes: null })}>
                <Badge className="hover:bg-fill-strong">{categoryLabel(recipe.category)}</Badge>
              </NavLink>
            )}
            {recipe.tags.map((tag) => (
              <NavLink key={tag.id} href={filtersHref({ q: "", category: null, tags: [tag.name], maxMinutes: null })}>
                <Badge className="hover:bg-fill-strong">#{tag.name}</Badge>
              </NavLink>
            ))}
          </div>
        </div>
        <Menu
          label="Altre azioni"
          trigger={<MoreIcon />}
          triggerClassName="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-tint transition hover:bg-fill"
        >
          <NavLink href={`/ricette/${recipe.id}/modifica`} className={`${menuItemClass} border-b border-separator`}>
            Modifica
          </NavLink>
          <DeleteRecipeButton recipeId={recipe.id} title={recipe.title} />
        </Menu>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          {recipe.imageKey && (
            <RecipePhoto
              imageKey={recipe.imageKey}
              title={recipe.title}
              credit={recipe.imageCredit}
              className="aspect-[4/3] w-full rounded-card"
            />
          )}

          {(facts.length > 0 || recipe.description) && (
            <Card>
              {recipe.description && <p className="text-[15px] leading-relaxed whitespace-pre-line">{recipe.description}</p>}
              {facts.length > 0 && (
                <dl className={`grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 ${recipe.description ? "mt-4 border-t border-separator pt-4" : ""}`}>
                  {facts.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[12px] text-label-secondary">{label}</dt>
                      <dd className="text-[17px] font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          )}

          <IngredientsSection ingredients={recipe.ingredients} servings={recipe.servings} />
        </div>

        <div className="space-y-6">
          <StepsSection steps={recipe.steps} />

          {recipe.notes && (
            <Card title="Note">
              <p className="text-[15px] leading-relaxed whitespace-pre-line">{recipe.notes}</p>
            </Card>
          )}

          {recipe.sourceUrl && (
            <Card title={recipe.sourceKind === "VIDEO" ? "Video originale" : "Fonte"}>
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-[15px] break-all text-tint hover:underline"
              >
                {siteName(recipe.sourceUrl) ?? recipe.sourceUrl} ↗
              </a>
            </Card>
          )}
        </div>
      </div>

      <footer className="px-1 text-[12px] text-label-secondary">
        Aggiunta {recipe.createdBy?.name ? `da ${recipe.createdBy.name} ` : ""}il {dateFormat.format(recipe.createdAt)}
        {(recipe.updatedAt.getTime() - recipe.createdAt.getTime() > 60_000 || recipe.updatedById !== recipe.createdById) &&
          ` · modificata ${recipe.updatedBy?.name ? `da ${recipe.updatedBy.name} ` : ""}il ${dateFormat.format(recipe.updatedAt)}`}
      </footer>
    </article>
  );
}
