import { notFound } from "next/navigation";
import { saveRecipeAction } from "@/app/actions/recipes";
import { RecipeForm } from "@/components/forms/RecipeForm";
import { NavLink } from "@/components/NavLink";
import { draftFromRecipe } from "@/lib/recipe-draft";
import { getFamilyRecipe, listFamilyTags } from "@/lib/recipes";
import { assertId, requireFamilyViewer } from "@/lib/session";

export const metadata = { title: "Modifica ricetta — Ricette" };

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireFamilyViewer();
  const id = assertId((await params).id);
  const [recipe, tags] = await Promise.all([getFamilyRecipe(id, viewer.familyId), listFamilyTags(viewer.familyId)]);
  if (!recipe) notFound();

  return (
    <div className="space-y-6">
      <header>
        <NavLink href={`/ricette/${recipe.id}`} className="text-[15px] text-tint hover:underline">
          ‹ {recipe.title}
        </NavLink>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em]">Modifica ricetta</h1>
      </header>
      <RecipeForm
        action={saveRecipeAction.bind(null, recipe.id)}
        initial={draftFromRecipe(recipe)}
        existingImageKey={recipe.imageKey}
        existingImageCredit={recipe.imageCredit}
        tagSuggestions={tags.map((tag) => tag.name)}
        cancelHref={`/ricette/${recipe.id}`}
        submitLabel="Salva modifiche"
      />
    </div>
  );
}
