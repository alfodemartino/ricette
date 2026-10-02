// Sonda per l'healthcheck del container e per capire, quando l'app non
// risponde, se il problema è il processo Node o quello che gli sta davanti.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Di proposito non interroga il database: se Postgres è momentaneamente
 * irraggiungibile (un riavvio, un restore) il problema non è il processo
 * Node, e un healthcheck che fallisce farebbe riavviare un container sano.
 */
export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
