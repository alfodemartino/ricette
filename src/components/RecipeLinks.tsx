import { NavLink } from "@/components/NavLink";

/** Titoli di ricette separati da virgole, ognuno con il link alla sua pagina. */
export function RecipeLinks({ recipes }: { recipes: { id: string; title: string }[] }) {
  return recipes.map((recipe, index) => (
    <span key={recipe.id}>
      {index > 0 && ", "}
      <NavLink href={`/ricette/${recipe.id}`} className="underline">
        {recipe.title}
      </NavLink>
    </span>
  ));
}
