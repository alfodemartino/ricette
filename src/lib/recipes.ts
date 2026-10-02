import { prisma } from "@/lib/db";
import { sourceKey } from "@/lib/import/url";
import type { RecipeData } from "@/lib/recipe-draft";
import { tagKey } from "@/lib/tags";

/**
 * Accesso alle ricette. Ogni lettura passa da qui e filtra per famiglia: una
 * ricetta di un'altra famiglia, per chi la chiede, non esiste (404, mai 403).
 */

export async function listFamilyRecipes(familyId: string) {
  return prisma.recipe.findMany({
    where: { familyId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      notes: true,
      category: true,
      prepMinutes: true,
      cookMinutes: true,
      servings: true,
      imageKey: true,
      imageCredit: true,
      sourceKind: true,
      ingredients: { select: { name: true } },
      tags: { select: { name: true }, orderBy: { name: "asc" } },
      createdBy: { select: { name: true } },
    },
  });
}

export async function getFamilyRecipe(id: string, familyId: string) {
  return prisma.recipe.findFirst({
    where: { id, familyId },
    include: {
      ingredients: { orderBy: { position: "asc" } },
      steps: { orderBy: { position: "asc" } },
      tags: { orderBy: { name: "asc" } },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });
}

/**
 * Le ricette della famiglia che vengono da uno dei link dati, confrontati con
 * `sourceKey`: la stessa pagina con o senza `www.`, parametri di
 * tracciamento o un'altra forma del link YouTube. Le ricette con una fonte
 * sono al più qualche centinaio, e il confronto si fa qui invece che in SQL.
 */
export async function findFamilyRecipesFromSource(familyId: string, urls: string[]) {
  const keys = new Set(urls.map(sourceKey).filter((key): key is string => key !== null));
  if (keys.size === 0) return [];
  const withSource = await prisma.recipe.findMany({
    where: { familyId, sourceUrl: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, sourceUrl: true },
  });
  return withSource
    .filter((recipe) => keys.has(sourceKey(recipe.sourceUrl ?? "") ?? ""))
    .map(({ id, title }) => ({ id, title }));
}

export async function listFamilyTags(familyId: string) {
  return prisma.tag.findMany({
    where: { familyId, recipes: { some: {} } },
    orderBy: { name: "asc" },
    select: { name: true },
  });
}

type SaveInput = {
  familyId: string;
  userId: string;
  data: RecipeData;
  /** `undefined` lascia la foto com'è; `null` la toglie. */
  imageKey?: string | null;
  /** Il sito da cui arriva la nuova foto, se l'ha scaricata l'import. */
  imageCredit?: string | null;
};

/**
 * Crea o aggiorna una ricetta in una transazione: ingredienti e passi si
 * riscrivono per intero, i tag si creano se la famiglia non li ha ancora.
 * Restituisce l'id e la foto che la ricetta aveva prima, da togliere dal
 * disco se è stata sostituita.
 */
export async function saveRecipe(recipeId: string | null, input: SaveInput) {
  const { familyId, userId, data } = input;

  return prisma.$transaction(async (tx) => {
    let previousImage: string | null = null;
    if (recipeId) {
      const existing = await tx.recipe.findFirst({ where: { id: recipeId, familyId }, select: { imageKey: true } });
      if (!existing) return null;
      previousImage = existing.imageKey;
    }

    const tagIds: { id: string }[] = [];
    for (const name of data.tags) {
      const key = tagKey(name);
      const tag = await tx.tag.upsert({
        where: { familyId_key: { familyId, key } },
        create: { familyId, key, name },
        update: {},
        select: { id: true },
      });
      tagIds.push(tag);
    }

    const fields = {
      title: data.title,
      description: data.description,
      category: data.category,
      servings: data.servings,
      prepMinutes: data.prepMinutes,
      cookMinutes: data.cookMinutes,
      notes: data.notes,
      sourceUrl: data.sourceUrl,
      sourceKind: data.sourceKind,
      updatedById: userId,
      // La fonte segue la foto: una foto nuova, o nessuna, porta la sua.
      ...(input.imageKey !== undefined ? { imageKey: input.imageKey, imageCredit: input.imageCredit ?? null } : {}),
    };

    let id: string;
    if (recipeId) {
      await tx.ingredient.deleteMany({ where: { recipeId } });
      await tx.recipeStep.deleteMany({ where: { recipeId } });
      await tx.recipe.update({
        where: { id: recipeId },
        data: {
          ...fields,
          tags: { set: tagIds },
          ingredients: { create: data.ingredients },
          steps: { create: data.steps },
        },
      });
      id = recipeId;
    } else {
      const created = await tx.recipe.create({
        data: {
          ...fields,
          familyId,
          createdById: userId,
          tags: { connect: tagIds },
          ingredients: { create: data.ingredients },
          steps: { create: data.steps },
        },
        select: { id: true },
      });
      id = created.id;
    }

    // I tag rimasti senza ricette non servono più: spariscono dai filtri.
    await tx.tag.deleteMany({ where: { familyId, recipes: { none: {} } } });

    const replacedImage = input.imageKey !== undefined && previousImage !== input.imageKey ? previousImage : null;
    return { id, replacedImage };
  });
}
