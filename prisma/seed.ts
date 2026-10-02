/**
 * Dati di esempio per lo sviluppo.
 *
 *   npm run db:seed
 *
 * Crea una famiglia con due membri e tre ricette, così l'applicazione ha
 * subito qualcosa da mostrare. Le ricette sono scritte apposta per l'esempio.
 */
import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/db";
import { parseIngredientList, quantityInput } from "../src/lib/ingredients";
import { draftToData, emptyDraft, stepRowsFromText, type RecipeDraft } from "../src/lib/recipe-draft";
import { saveRecipe } from "../src/lib/recipes";

const DEMO_PASSWORD = "password123";
const INVITE_CODE = "DEMO2345";

/** Una ricetta scritta come la si incollerebbe nel form. */
function draft(fields: Partial<RecipeDraft>, ingredients: string, steps: string): RecipeDraft {
  return {
    ...emptyDraft(),
    ...fields,
    ingredients: parseIngredientList(ingredients).flatMap((item, index, list) => [
      ...(item.section && item.section !== list[index - 1]?.section ? [{ kind: "heading" as const, title: item.section }] : []),
      { kind: "item" as const, quantity: quantityInput(item.quantity), unit: item.unit ?? "", name: item.name, note: item.note ?? "" },
    ]),
    steps: stepRowsFromText(steps),
  };
}

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // Si riparte da zero a ogni seed, per avere sempre lo stesso scenario: la
  // cascata dello schema porta via ricette, ingredienti, passi e tag.
  await prisma.family.deleteMany({ where: { inviteCode: INVITE_CODE } });
  const family = await prisma.family.create({ data: { name: "Famiglia Demo", inviteCode: INVITE_CODE } });

  const anna = await prisma.user.upsert({
    where: { email: "demo@ricette.local" },
    update: { passwordHash, familyId: family.id, familyRole: "OWNER", joinedAt: new Date() },
    create: { email: "demo@ricette.local", name: "Anna", passwordHash, familyId: family.id, familyRole: "OWNER", joinedAt: new Date() },
  });
  const bruno = await prisma.user.upsert({
    where: { email: "bruno@ricette.local" },
    update: { passwordHash, familyId: family.id, familyRole: "MEMBER", joinedAt: new Date() },
    create: { email: "bruno@ricette.local", name: "Bruno", passwordHash, familyId: family.id, familyRole: "MEMBER", joinedAt: new Date() },
  });

  const recipes: [string, RecipeDraft][] = [
    [
      anna.id,
      draft(
        { title: "Spaghetti aglio, olio e peperoncino", category: "PRIMO", servings: "2", prepMinutes: "5", cookMinutes: "12", tags: ["veloce", "vegetariano"], description: "Il piatto di mezzanotte: pochi ingredienti, dieci minuti." },
        "180 g di spaghetti\n2 spicchi d'aglio\n1 peperoncino fresco\n4 cucchiai di olio extravergine d'oliva\nPrezzemolo q.b.\nSale q.b.",
        "Porta a bollore l'acqua, salala e cuoci gli spaghetti.\nNel frattempo scalda l'olio in padella con l'aglio a fettine e il peperoncino, a fuoco basso.\nScola la pasta al dente tenendo da parte un mestolo d'acqua di cottura.\nSalta gli spaghetti in padella con un po' d'acqua di cottura e il prezzemolo tritato.",
      ),
    ],
    [
      bruno.id,
      draft(
        { title: "Frittata di zucchine", category: "SECONDO", servings: "4", prepMinutes: "10", cookMinutes: "15", tags: ["veloce", "vegetariano"] },
        "6 uova\n3 zucchine\n50 g di parmigiano grattugiato\n1 cipolla\n2 cucchiai di olio extravergine d'oliva\nSale q.b.\nPepe q.b.",
        "Taglia le zucchine a rondelle e la cipolla a fettine sottili.\nFai appassire la cipolla nell'olio, poi aggiungi le zucchine e cuocile 8 minuti.\nSbatti le uova con il parmigiano, sale e pepe.\nVersa le uova sulle verdure e cuoci a fuoco basso con il coperchio.\nGira la frittata aiutandoti con un piatto e cuoci ancora 3 minuti.",
      ),
    ],
    [
      anna.id,
      draft(
        { title: "Tiramisù", category: "DOLCE", servings: "8", prepMinutes: "40", tags: ["senza cottura"], notes: "Meglio se riposa una notte in frigorifero." },
        "Per la crema:\n500 g di mascarpone\n4 uova\n100 g di zucchero\nPer la base:\n300 g di savoiardi\n300 ml di caffè\nCacao amaro q.b.",
        "La crema:\nMonta i tuorli con lo zucchero fino a ottenere un composto chiaro.\nAggiungi il mascarpone poco alla volta.\nMonta gli albumi a neve e incorporali delicatamente.\nIl montaggio:\nBagna i savoiardi nel caffè freddo e fai un primo strato.\nCopri con metà della crema, poi ripeti.\nSpolvera di cacao e lascia in frigorifero almeno 4 ore.",
      ),
    ],
  ];

  for (const [userId, recipe] of recipes) {
    await saveRecipe(null, { familyId: family.id, userId, data: draftToData(recipe) });
  }

  console.log("Dati di esempio pronti.");
  console.log(`  Accesso: demo@ricette.local / ${DEMO_PASSWORD} (anche bruno@ricette.local)`);
  console.log(`  Codice di invito della famiglia: ${INVITE_CODE}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
