# Note per Claude Code

Contesto di lavoro su questo repository. Il [README](README.md) spiega cosa fa
l'app e come avviarla: qui ci sono solo le convenzioni da rispettare quando si
modifica il codice. Sono le stesse di finanze, da cui l'app riprende
impalcatura, interfaccia e modo di rilasciare.

## Flusso di lavoro

Si sviluppa su un branch dedicato e **si apre sempre una pull request**: il
merge su `main` avviene dalla PR, non con un merge locale.

L'app gira solo sull'LXC di casa, accanto a finanze, e il rilascio è
esplicito: un merge su `main` non mette in produzione niente finché qualcuno
non lancia `./deploy.sh` sulla macchina. Su `main` va solo ciò che è pronto.

Commit, PR, commenti nel codice e testi dell'interfaccia sono **in italiano**.
Il messaggio di commit spiega *perché* si cambia qualcosa, non solo cosa.

Quando cambia qualcosa nell'installazione o nel rilascio (variabili, porte,
comandi, servizi), si aggiorna anche «Installazione, passo per passo» nel
README: è la procedura che si segue davvero sull'LXC, e deve restare
eseguibile dall'inizio alla fine così com'è scritta.

## Dati personali

Il repository è **pubblico**. Nel codice, nei testi d'esempio dei form, nei
dati di prova, nei test e nella documentazione non vanno nomi, cognomi,
email, indirizzi IP o altri dati reali, nemmeno ricavati dal nome
dell'account GitHub. Gli esempi usano nomi generici («Famiglia Rossi»,
«Anna», «Bruno», `192.168.1.50`, `<ip-lxc>`). I valori veri stanno solo nel
`.env` dell'LXC.

## Prima di ogni push

Vanno verdi tutti e quattro (li ripete il workflow `Verifica` sulle PR):

```bash
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # build di produzione
```

Il build non richiede variabili d'ambiente: nessuna pagina tocca il database
durante il build.

Quando la modifica si vede a schermo, non basta che il build passi: si avvia
l'app e si controlla il risultato in un browser, a larghezza desktop e
telefono. Il form della ricetta è il punto delicato: sul telefono le caselle
devono restare larghe abbastanza da scriverci.

## Regole del dominio

Sono invarianti, non preferenze.

- **Le ricette appartengono alla famiglia.** Ogni lettura e ogni modifica
  filtra per `familyId` dell'utente, letto dal database a ogni richiesta
  (`src/lib/session.ts`), non dal token. Le query passano da
  `src/lib/recipes.ts`.
- **Chi non è della famiglia riceve 404**, non 403: una ricetta, o una foto,
  di un'altra famiglia per lui non esiste.
- **Tutti i membri modificano tutto**, ed è una scelta: per questo ogni
  ricetta tiene `createdBy`/`updatedBy` e le eliminazioni vanno nel log.
- **L'import non salva mai da solo.** Prepara una bozza (`RecipeDraft`) che
  l'utente controlla nel form.
- **Ogni indirizzo scritto da un utente si scarica con `safeFetch`**
  (`src/lib/import/fetch-page.ts`), mai con `fetch`: è lì che si bloccano gli
  IP della rete di casa, al momento della connessione e a ogni redirect.
  L'app sta accanto al router, a finanze e ai database.
- **Le foto passano tutte da `storeImage`** (`src/lib/photos.ts`): `sharp` le
  ricodifica in WebP, quindi su disco c'è sempre un'immagine vera con un nome
  casuale. Si servono solo dalla route `/foto/[key]`, che controlla la famiglia.
- **Le quantità sono numeri**, così le porzioni le ricalcolano; «q.b.» e
  simili sono note, senza quantità. Come si leggono e come si mostrano lo
  decide `src/lib/ingredients.ts`.

La logica sta in `src/lib/` ed è pura dove può: lettura degli ingredienti,
porzioni, ricerca, bozze, estrazione dalle pagine. Va coperta da test lì,
senza database e senza rete: l'import si prova con le pagine di
`src/lib/import/__fixtures__/`, scritte a mano, e uno scaricatore finto.

## Import da link

La catena è in `src/lib/import/index.ts`: YouTube, dati strutturati
schema.org, anteprima più testo, link nella descrizione, poi gli `enhancers`.
Un estrattore nuovo (per esempio quello con Claude, previsto ma non ancora
scritto) si aggiunge come `RecipeEnhancer` e riceve `rawText`: non si tocca il
resto. Gli errori da mostrare all'utente sono `ImportError`, con un `reason`
breve e stabile che finisce nel log.

## Interfaccia

Valgono le regole di finanze. Tailwind v4 senza file di configurazione, temi
in `src/app/globals.css`. Aspetto iOS: pagina grigia con riquadri
arrotondati, barra di navigazione traslucida, blu di sistema per ciò che si
tocca. I colori si usano **per il ruolo, non per la tinta** (`bg-surface`,
`text-label-secondary`, `text-tint`, `text-warning`…) e non vogliono la
variante `dark:`. Niente colori della tavolozza Tailwind nei componenti:

```bash
grep -rn "slate-\|emerald-\|orange-\|bg-white\|text-black" src --include=*.tsx
```

I componenti condivisi stanno in `src/components/ui.tsx` e si riusano. Le
azioni rare vanno in un `Menu` (il «…» della ricetta, il menu dell'account),
non in altri pulsanti nella testata.

## Attesa

Come in finanze: ogni pagina ha il suo `loading.tsx`, fatto con i pezzi di
`src/components/Skeletons.tsx`, in cui *quello che non dipende dai dati si
mostra per davvero*. Tutto il resto lo copre l'overlay (`useLoadingWhile`).
Una pagina nuova vuole anche il suo file di attesa.

## Database e foto

Postgres gira sull'LXC come servizio `db` del `docker-compose.yml`, con i dati
nel volume `ricette_pgdata`; le foto stanno nel volume `ricette_uploads`.
Nessuno dei due ha un fornitore che ne tenga una storia: la rete sono le copie
notturne di `backup-db.sh` (dump **e** archivio delle foto), che il backup di
Proxmox dell'LXC porta fuori dalla macchina. Mai cambiare la versione
maggiore di `PG_IMAGE` senza la procedura del README.

Le migrazioni **non** girano durante il build né all'avvio del server: nei
container il passo è `docker compose run --rm migrate` (`prisma migrate
deploy`), mai `npm run db:migrate`, che è `prisma migrate dev`.

Ricette e finanze condividono l'LXC ma niente altro: porte diverse (3001 e
5433), progetti Compose, volumi, utenti e tunnel separati. Una modifica qui
non deve mai richiedere di toccare finanze.

## Proposte

Le funzionalità proposte e non ancora realizzate, con le decisioni già prese
e le note tecniche, stanno in [PROPOSTE.md](PROPOSTE.md). Una funzionalità
nuova si progetta partendo da lì; quando una proposta viene realizzata o
scartata, il file si aggiorna nella stessa PR.
