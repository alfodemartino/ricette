import { saveRecipeAction } from "@/app/actions/recipes";
import { RecipeForm } from "@/components/forms/RecipeForm";
import { NavLink } from "@/components/NavLink";
import { emptyDraft } from "@/lib/recipe-draft";
import { listFamilyTags } from "@/lib/recipes";
import { requireFamilyViewer } from "@/lib/session";

export const metadata = { title: "Nuova ricetta — Ricette" };

export default async function NewRecipePage() {
  const viewer = await requireFamilyViewer();
  const tags = await listFamilyTags(viewer.familyId);

  return (
    <div className="space-y-6">
      <header>
        <NavLink href="/ricette" className="text-[15px] text-tint hover:underline">
          ‹ Ricette
        </NavLink>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em]">Nuova ricetta</h1>
        <p className="text-[13px] text-label-secondary">
          Hai il link di una pagina o di un video?{" "}
          <NavLink href="/ricette/importa" className="text-tint hover:underline">
            Importala da lì
          </NavLink>
          .
        </p>
      </header>
      <RecipeForm
        action={saveRecipeAction.bind(null, null)}
        initial={emptyDraft()}
        tagSuggestions={tags.map((tag) => tag.name)}
        cancelHref="/ricette"
      />
    </div>
  );
}
