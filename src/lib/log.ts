/**
 * Eventi applicativi da ritrovare nei log del container.
 *
 * L'applicazione, per il resto, non scrive nulla: quello che finisce in
 * `docker compose logs` viene da Next, da Auth.js e da Prisma. Qui si
 * registrano soltanto i fatti che servono a rispondere a una domanda precisa —
 * «qualcuno sta provando a entrare?», «perché quel link non si importa?»,
 * «chi ha eliminato quella ricetta?».
 *
 * Restano deliberatamente fuori gli errori di compilazione dei form (un
 * titolo mancante, una quantità scritta male): sono errori di battitura, e
 * riempirne i log è il modo più efficace per rendere inutile un log.
 */

export type LogLevel = "warn" | "error";

/**
 * Vocabolario chiuso: il nome dell'evento è la chiave con cui lo si cerca, e
 * un tipo unito impedisce che la stessa cosa venga chiamata in due modi in due
 * punti diversi del codice.
 */
export type AppEvent =
  // Accessi e permessi
  | "login_fallito"
  | "registrazione_email_esistente"
  | "invito_inesistente"
  | "permesso_negato"
  | "ricetta_non_trovata"
  // Import da link e foto
  | "import_fallito"
  | "import_bloccato"
  | "foto_non_valida"
  // Operazioni irreversibili
  | "ricetta_eliminata"
  | "famiglia_eliminata";

export type LogFields = Record<string, string | number | undefined>;

/**
 * Compone la riga, senza scriverla: è la parte che si può verificare con un
 * test. `now` è un parametro per lo stesso motivo.
 *
 * `ts`, `level` ed `event` vanno per primi perché una riga si legge da
 * sinistra, e l'ordine delle chiavi in JSON è quello di inserimento.
 *
 * Il timestamp è in UTC e ridondante rispetto a quello che Docker mette su
 * ogni riga: serve perché una riga copiata altrove — in un messaggio, in un
 * ticket — resti leggibile da sola, senza dipendere da come è stata estratta.
 */
export function buildLogRecord(
  level: LogLevel,
  event: AppEvent,
  fields: LogFields = {},
  now: Date = new Date(),
): string {
  const record: Record<string, string | number> = {
    ts: now.toISOString(),
    level,
    event,
  };

  // I campi vuoti si omettono invece di comparire come `""`: un dato assente e
  // un dato vuoto si leggono uguale, e la riga più corta si scorre meglio.
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== "") record[key] = value;
  }

  return JSON.stringify(record);
}

/**
 * Scrive l'evento su stderr, dove già scrivono Auth.js e Prisma: così «le
 * diagnostiche stanno su stderr» resta una regola sola, e `docker compose logs
 * app 2>&1 | grep …` le trova tutte.
 */
export function logEvent(level: LogLevel, event: AppEvent, fields: LogFields = {}): void {
  const line = buildLogRecord(level, event, fields);
  if (level === "error") console.error(line);
  else console.warn(line);
}
