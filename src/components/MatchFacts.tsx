/**
 * La riga sotto una ricetta di «Cosa cucino con…»: cosa manca di quello che
 * si ha, cosa serve in più, per quanti basta. La usano sia le schede del
 * ricettario sia i risultati dei siti.
 */
export function MatchFacts({ missing, alsoNeeded, amount }: { missing: string[]; alsoNeeded: string[]; amount: string | null }) {
  const facts = [
    missing.length > 0 && <span className="font-medium text-warning">Manca: {missing.join(", ").toLowerCase()}</span>,
    alsoNeeded.length > 0 && (
      <span>
        Servono anche: {alsoNeeded.slice(0, 4).join(", ").toLowerCase()}
        {alsoNeeded.length > 4 && ` e altri ${alsoNeeded.length - 4}`}
      </span>
    ),
    amount && <span>{amount}</span>,
  ].filter(Boolean);
  if (facts.length === 0) return null;
  return (
    <p className="text-[13px] leading-snug text-label-secondary">
      {facts.map((fact, index) => (
        <span key={index}>
          {index > 0 && " · "}
          {fact}
        </span>
      ))}
    </p>
  );
}
