import { ButtonLink, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <Card title="Ricetta non trovata">
      <p className="mb-4 text-[15px] text-label-secondary">
        Questa ricetta non esiste o non fa parte del ricettario della tua famiglia.
      </p>
      <ButtonLink href="/ricette" variant="secondary">
        Torna alle ricette
      </ButtonLink>
    </Card>
  );
}
