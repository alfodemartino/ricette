import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ButtonLink, Card } from "@/components/ui";

export default async function HomePage() {
  const user = await currentUser();
  if (user) redirect("/ricette");

  return (
    <div className="space-y-10">
      {/* Il titolo grande di iOS: pesante, stretto di spaziatura, senza fronzoli. */}
      <section className="space-y-4 py-4">
        <h1 className="text-[34px] leading-[1.1] font-bold tracking-[-0.02em] sm:text-[44px]">
          Le ricette di casa, tutte in un posto.
        </h1>
        <p className="max-w-2xl text-[17px] text-label-secondary">
          Crea il ricettario della tua famiglia, scrivi ingredienti e procedimento o importali da un
          sito o da un video, e ritrova ogni piatto in un attimo.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink href="/registrati">Crea un account</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Ho già un account
          </ButtonLink>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Un ricettario per la famiglia">
          <p className="text-[15px] text-label-secondary">
            Ognuno entra con il proprio account e con un codice di invito: tutti vedono e possono
            correggere le ricette di tutti.
          </p>
        </Card>
        <Card title="Importa da un link">
          <p className="text-[15px] text-label-secondary">
            Incolla l&apos;indirizzo di una pagina di ricette o di un video: l&apos;app prepara la
            ricetta da controllare e salvare.
          </p>
        </Card>
        <Card title="Porzioni su misura">
          <p className="text-[15px] text-label-secondary">
            Cambi il numero di persone e le quantità degli ingredienti si ricalcolano da sole.
          </p>
        </Card>
      </div>
    </div>
  );
}
