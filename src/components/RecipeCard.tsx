import { NavLink } from "@/components/NavLink";
import { Badge, Logo, PhotoCredit } from "@/components/ui";
import { categoryLabel, type RecipeCategory } from "@/lib/categories";
import { formatMinutes, totalMinutes } from "@/lib/duration";

export type RecipeCardData = {
  id: string;
  title: string;
  category: RecipeCategory | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  imageKey: string | null;
  imageCredit: string | null;
  sourceKind: "MANUALE" | "SITO" | "VIDEO";
  tags: { name: string }[];
};

/**
 * La foto della ricetta, o al suo posto la pentola su fondo grigio. Una foto
 * presa dall'import porta in basso il nome del sito (`credit`).
 */
export function RecipePhoto({
  imageKey,
  title,
  credit = null,
  creditClassName = "",
  className = "",
  iconClassName = "size-12",
}: {
  imageKey: string | null;
  title: string;
  credit?: string | null;
  creditClassName?: string;
  className?: string;
  iconClassName?: string;
}) {
  if (!imageKey) {
    return (
      <div aria-hidden className={`flex items-center justify-center bg-fill ${className}`}>
        <Logo className={`text-label-tertiary ${iconClassName}`} />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Le foto arrivano dalla route protetta `/foto/…`, già ridotte in WebP:
          l'ottimizzazione di `next/image` non avrebbe niente da aggiungere. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/foto/${imageKey}`} alt={title} loading="lazy" className="absolute inset-0 size-full object-cover" />
      {credit && <PhotoCredit credit={credit} className={creditClassName} />}
    </div>
  );
}

/**
 * Una ricetta dell'elenco. Sul telefono è una riga con la miniatura, come le
 * liste di iOS: una foto grande per ricetta farebbe scorrere mezzo schermo a
 * ricetta. Da tablet in su diventa una scheda con la foto sopra.
 */
export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const total = formatMinutes(totalMinutes(recipe.prepMinutes, recipe.cookMinutes));
  return (
    <li>
      <NavLink
        href={`/ricette/${recipe.id}`}
        className="group flex h-full items-center gap-3 overflow-hidden rounded-card bg-surface p-2.5 transition active:scale-[0.99] motion-reduce:active:scale-100 sm:block sm:p-0"
      >
        <RecipePhoto
          imageKey={recipe.imageKey}
          title={recipe.title}
          credit={recipe.imageCredit}
          // Nella miniatura del telefono la scritta non si leggerebbe.
          creditClassName="max-sm:hidden"
          className="size-20 shrink-0 rounded-control sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-none"
          iconClassName="size-8 sm:size-12"
        />
        <div className="min-w-0 space-y-2 sm:p-4">
          <h2 className="text-[17px] leading-snug font-semibold tracking-tight group-hover:text-tint">{recipe.title}</h2>
          <div className="flex flex-wrap gap-1.5">
            {recipe.category && <Badge>{categoryLabel(recipe.category)}</Badge>}
            {total && <Badge>{total}</Badge>}
            {recipe.sourceKind === "VIDEO" && <Badge>Video</Badge>}
            {recipe.tags.slice(0, 3).map((tag) => (
              <Badge key={tag.name}>#{tag.name}</Badge>
            ))}
          </div>
        </div>
      </NavLink>
    </li>
  );
}
