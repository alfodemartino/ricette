import { saveRecipeAction } from "@/app/actions/recipes";
import { ImportFlow } from "@/components/forms/ImportFlow";
import { NavLink } from "@/components/NavLink";
import { listFamilyTags } from "@/lib/recipes";
import { requireFamilyViewer } from "@/lib/session";

export const metadata = { title: "Importa una ricetta — Ricette" };

export default async function ImportRecipePage() {
  const viewer = await requireFamilyViewer();
  const tags = await listFamilyTags(viewer.familyId);

  return (
    <div className="space-y-6">
      <header>
        <NavLink href="/ricette" className="text-[15px] text-tint hover:underline">
          ‹ Ricette
        </NavLink>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em]">Importa da link</h1>
        <p className="max-w-2xl text-[13px] text-label-secondary">
          Dai siti di ricette arriva quasi sempre tutto; dai video e dai social quello che c&apos;è
          scritto nella descrizione. In ogni caso la ricetta si salva solo dopo che l&apos;hai
          controllata.
        </p>
      </header>
      <ImportFlow saveAction={saveRecipeAction.bind(null, null)} tagSuggestions={tags.map((tag) => tag.name)} />
    </div>
  );
}
