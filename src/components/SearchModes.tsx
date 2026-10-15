import { SegmentedLinks } from "@/components/ui";

/**
 * I due modi di cercare una ricetta, come un controllo segmentato di iOS
 * sopra la casella: per nome (l'elenco) o con quello che si ha in casa
 * («Cosa cucino con…»). Sta su entrambe le pagine, così si passa dall'una
 * all'altra senza cercare un link.
 */
export function SearchModes({ active }: { active: "nome" | "ingredienti" }) {
  return (
    <SegmentedLinks
      className="sm:max-w-sm"
      items={[
        { href: "/ricette", label: "Per nome", active: active === "nome" },
        { href: "/ricette/cosa-cucino", label: "Con quello che ho", active: active === "ingredienti" },
      ]}
    />
  );
}
