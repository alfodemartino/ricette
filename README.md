# Ricette — il ricettario di famiglia

Applicazione web per tenere le ricette di casa: ingredienti e procedimento in
due sezioni distinte, foto, categorie e tag, porzioni che si ricalcolano e
import da un link (pagine di ricette, video, post). Ogni utente ha il suo
account ed entra nella famiglia con un codice di invito: tutti i membri vedono
e modificano tutte le ricette.

Gira sullo stesso container LXC di [finanze](https://github.com/alfodemartino/finanze),
con la stessa impostazione: Docker Compose, Postgres locale, migrazioni a parte,
copie notturne.

## Cosa fa

- **Famiglia** — chi si registra crea una famiglia (e ne diventa
  amministratore) oppure entra in una esistente con il codice di invito. Si
  appartiene a una famiglia sola. L'amministratore rinomina la famiglia,
  cambia il codice, toglie i membri, passa il ruolo a un altro o elimina la
  famiglia riscrivendone il nome.
- **Ricette della famiglia, non del singolo** — ogni membro vede, corregge ed
  elimina qualsiasi ricetta. Chi esce dalla famiglia lascia le sue ricette agli
  altri. Sotto ogni ricetta c'è scritto chi l'ha aggiunta e chi l'ha modificata
  per ultimo; le eliminazioni finiscono nel log.
- **Ingredienti e procedimento** — due sezioni separate, ognuna con le sue
  righe da aggiungere, spostare e togliere, e con sottosezioni facoltative
  («Per la crema», «Il montaggio»). Ogni ingrediente ha quantità, unità, nome e
  nota («q.b.», «a temperatura ambiente»). Le quantità accettano `200`, `1,5`,
  `1/2`, `½`.
- **Incolla elenco / incolla testo** — si incolla un elenco di ingredienti
  scritto in qualsiasi modo comune («200 g di farina», «Farina 00 200 g»,
  «2 spicchi d'aglio», «Sale q.b.») e diventa righe già divise; lo stesso per
  il procedimento, un passo per riga, numeri tolti.
- **Porzioni ricalcolabili** — nella ricetta si cambia il numero di persone e
  le quantità si ricalcolano come le scriverebbe una persona: grammi
  arrotondati come su una bilancia, uova e cucchiai in frazioni di casa (½, ⅓,
  ¾). «q.b.» resta «q.b.».
- **In cucina** — toccando un passo del procedimento lo si segna come fatto.
- **Categorie e tag** — la portata (antipasto, primo, secondo, contorno,
  piatto unico, dolce, pane e lievitati, salse, bevande, altro) e tag liberi
  della famiglia (#veloce, #vegetariano). I tag che non usa più nessuna ricetta
  spariscono da soli.
- **Ricerca e filtri** — la casella cerca mentre si scrive in titolo,
  descrizione, note, ingredienti, tag e categoria, senza badare a maiuscole e
  accenti. Le pastiglie filtrano per categoria, per tag e per tempo totale
  (entro 15, 30, 60 minuti). Tutto resta nell'indirizzo
  (`/ricette?q=zucchine&tag=veloce`).
- **Foto** — una per ricetta, dal telefono o presa dalla fonte importata.
  Ogni immagine viene ruotata, ridotta a 1600 px e salvata in WebP. Le foto si
  vedono solo dai membri della famiglia.
- **Import da link** — vedi [più sotto](#import-da-link).
- **Aspetto in stile iOS** e **tema chiaro o scuro**, come finanze.

## Stack

| Ambito | Scelta |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Actions) |
| Linguaggio | TypeScript |
| Database | PostgreSQL con Prisma |
| Autenticazione | Auth.js (NextAuth v5): email + password, Google opzionale |
| Foto | `sharp` (conversione in WebP), file su un volume Docker |
| Import | `cheerio` per leggere le pagine |
| Stile | Tailwind CSS v4, palette di sistema iOS |
| Test | Vitest |

## Avvio in locale

Serve Node 20+ e un database PostgreSQL raggiungibile.

```bash
npm install
cp .env.example .env        # poi compila DATABASE_URL e AUTH_SECRET
npx auth secret             # genera AUTH_SECRET

npm run db:migrate          # crea le tabelle
npm run db:seed             # (facoltativo) dati di esempio
npm run dev                 # http://localhost:3000
```

Con i dati di esempio puoi accedere subito:

- email `demo@ricette.local` (o `bruno@ricette.local`), password `password123`
- codice di invito della famiglia dimostrativa: `DEMO2345`

In sviluppo le foto finiscono nella cartella `uploads/` del progetto, ignorata
da git.

## Import da link

Si incolla un link in **Importa da link**; l'app prepara la ricetta e apre il
form già compilato. **Non salva mai da sola**: la ricetta si salva dal form,
dopo averla controllata.

Cosa si ottiene dipende dalla fonte:

| Fonte | Come si legge | Risultato tipico |
| --- | --- | --- |
| Siti di ricette | I dati strutturati `schema.org/Recipe` che i siti pubblicano per Google | Completo: titolo, foto, porzioni, tempi, ingredienti, passi, spesso la categoria |
| Video YouTube | Titolo e descrizione del video; nella descrizione si cercano i blocchi «Ingredienti» e «Procedimento» | Completo se l'autore scrive la ricetta nella descrizione, altrimenti titolo e miniatura |
| Descrizione con un link | Se manca qualcosa e la descrizione rimanda a una pagina («ricetta completa sul sito»), si prova a leggere quella | Completo, con il video come fonte |
| Instagram, TikTok, Facebook | La didascalia, quando la piattaforma la mostra senza login | Spesso parziale: titolo e immagine |
| Altre pagine | Titolo e immagine dell'anteprima, più la ricerca di ingredienti e passi nel testo | Variabile |

Quando l'import è parziale il form lo dice, e mostra il testo trovato alla
fonte: con **Incolla elenco** e **Incolla testo** si completa in fretta. I
siti che respingono i programmi (protezioni anti-bot, login obbligatorio)
rispondono con un errore, e l'app lo spiega.

La bozza arriva anche con qualche tag già proposto (`src/lib/import/tags.ts`):

- il nome del sito, senza `https://`, `www.` e percorso (`#ricetteperbimby.it`,
  `#youtube.com`), per ritrovare le ricette di una fonte;
- `#bimby`, se la fonte nomina il Bimby (titolo, link, parole chiave, testo)
  o ne usa la notazione («10 sec. vel. 5» insieme a boccale, misurino o
  antiorario). In quel caso il titolo finisce con «- Bimby», e una menzione
  che c'era già si sposta in fondo: «Risotto con zucchine Bimby» diventa
  «Risotto con zucchine - Bimby».

Come tutto il resto della bozza, tag e titolo si cambiano nel form prima di
salvare.

**Sicurezza.** L'app gira nella rete di casa, accanto al router, a finanze e
ai database: un link non deve diventare un modo per interrogarli dal server.
Per questo l'import accetta solo `http`/`https` sulle porte standard, rifiuta
`localhost`, i nomi senza dominio e quelli `.lan`/`.local`, e controlla l'IP
**al momento della connessione**, dopo la risoluzione DNS e a ogni redirect:
ogni indirizzo privato, di loopback, link-local o CGNAT viene bloccato
(evento `import_bloccato` nel log). Le pagine hanno 10 secondi e 5 MB al
massimo, le immagini 10 MB.

L'LXC deve poter uscire su internet perché l'import funzioni.

### Predisposizione per Claude

L'estrazione con un modello linguistico non c'è ancora, ma la catena è pronta
ad accoglierla senza toccare il resto:

- ogni import porta con sé il testo grezzo da cui è partito (`rawText`: la
  descrizione del video, la didascalia, il corpo della pagina);
- `src/lib/import/index.ts` passa le ricette ancora **incomplete** agli
  `enhancers` (`RecipeEnhancer` in `src/lib/import/types.ts`), oggi un elenco
  vuoto;
- `ANTHROPIC_API_KEY` è già prevista, commentata, nel `.env.example`.

Per aggiungerla basterà un `RecipeEnhancer` attivo solo con la chiave
valorizzata, che riceve `rawText` e restituisce ingredienti e passi. I test in
`src/lib/import/import.test.ts` verificano già che la catena lo chiami solo
quando serve.

## Deploy sull'LXC di finanze

L'applicazione gira in Docker sullo stesso container LXC di Proxmox che
ospita finanze. Le due app **non condividono niente**: ognuna ha il suo
progetto Compose (`name: ricette`), la sua rete, i suoi volumi (`ricette_pgdata`
per il database, `ricette_uploads` per le foto), il suo Postgres e i suoi
utenti. Cambiano solo le porte pubblicate sull'LXC:

| | finanze | ricette |
| --- | --- | --- |
| App | 3000 | **3001** |
| Database (client SQL) | 5432 | **5433** |
| Cartella | `/opt/finanze` | `/opt/ricette` |
| Copie notturne | `/var/backups/finanze`, alle 3:00 | `/var/backups/ricette`, alle **3:30** |

In una prova a riposo i due container di ricette occupavano circa 110 MB di
RAM in tutto (app e database); crescono mentre si converte una foto. Prima del
primo avvio conviene comunque un `free -h` sull'LXC.

Come in finanze, il `Dockerfile` produce due immagini: `runner`, il server, e
`migrator`, un container usa e getta che applica le migrazioni.

### Variabili d'ambiente

Vivono nel file `.env` accanto al `docker-compose.yml`, mai nell'immagine:

| Variabile | Valore |
| --- | --- |
| `DATABASE_URL` | `postgresql://ricette:<POSTGRES_PASSWORD>@db:5432/ricette`, senza `?schema=public` (lo rifiutano `pg_dump` e `pg_restore`). Dentro Compose la porta resta 5432 |
| `POSTGRES_PASSWORD` | La password dell'utente `ricette`, generata con `openssl rand -hex 24`. Va fissata una volta sola, prima del primo avvio |
| `AUTH_SECRET` | Una chiave generata con `openssl rand -base64 32` (o `npx auth secret`, dove c'è Node), diversa da quella di finanze |
| `AUTH_URL` | Vuoto quando si accede dalla LAN, il dominio `https://…` quando l'app è pubblica |
| `APP_PORT`, `DB_PORT` | Facoltative: le porte sull'LXC, 3001 e 5433 se assenti |
| `DB_LAN_IP` | Facoltativo: l'IP di rete locale dell'LXC, per aprire il database ai client SQL della LAN. Vuoto significa solo `127.0.0.1` |
| `COMPOSE_PROFILES` | Vuoto per la sola app, `public` per accendere anche il tunnel |
| `TUNNEL_TOKEN` | Il token del tunnel Cloudflare di ricette, solo con il profilo `public` |
| `BACKUP_DIR`, `KEEP_DAYS` | Facoltative: cartella delle copie e giorni di conservazione (`/var/backups/ricette`, 30) |

Su `AUTH_URL` vale quanto spiegato nel README di finanze: il codice imposta
`trustHost: true`, quindi finché si accede per indirizzo IP va **lasciato
vuoto**.

### Installazione, passo per passo

È la procedura seguita per la prima installazione sull'LXC, con i controlli
da fare a ogni passo.

**1. Scarica il codice.** `/opt` appartiene a root: con `sudo` si crea solo la
cartella, che poi si intesta al proprio utente. Clonando con `sudo`, i file
sarebbero di root e ogni `./deploy.sh` (che fa `git pull`) vorrebbe di nuovo
`sudo`. Se `/opt/finanze` è di root e lì si lavora sempre con `sudo`, conviene
fare lo stesso anche qui.

```bash
sudo mkdir /opt/ricette
sudo chown "$USER": /opt/ricette
git clone https://github.com/alfodemartino/ricette /opt/ricette
cd /opt/ricette
```

**2. Crea il `.env` con password e chiave.** I valori non vanno presi da
nessuna parte: si generano qui, **una volta sola e prima del primo avvio**.
Postgres registra la password quando crea il volume: rigenerando il `.env`
dopo, il database terrebbe quella vecchia (il rimedio è più sotto, in
[Accedere al database con un client SQL](#accedere-al-database-con-un-client-sql)).
`openssl` e non `npx auth secret` perché sull'LXC Node di solito non c'è.

```bash
cp .env.example .env
PASS=$(openssl rand -hex 24)
SECRET=$(openssl rand -base64 32)
sed -i \
  -e "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://ricette:${PASS}@db:5432/ricette\"|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\"${PASS}\"|" \
  -e "s|^AUTH_SECRET=.*|AUTH_SECRET=\"${SECRET}\"|" \
  -e "s|^AUTH_URL=.*|AUTH_URL=\"\"|" \
  .env
chmod 600 .env
grep -E "^(DATABASE_URL|POSTGRES_PASSWORD|AUTH_SECRET|AUTH_URL)=" .env   # controllo
```

Una copia del `.env` va in un gestore di password: sta solo sull'LXC, non su
git. Perdere `AUTH_SECRET` costa poco (tutti rifanno l'accesso); la password
del database si può sempre reimpostare dall'interno del container.

**3. Costruisci, applica le migrazioni e avvia.** Il primo build scarica le
immagini di base e le dipendenze: qualche minuto.

```bash
free -h                          # memoria libera sull'LXC
docker compose build
docker compose run --rm migrate  # deve finire con «All migrations have been successfully applied»
docker compose up -d
```

**4. Controlla che risponda,** dal più interno al più esterno:

```bash
curl -fsS localhost:3001/api/health   # {"ok":true}
docker compose ps                     # app e db «healthy»
```

poi `http://<ip-lxc>:3001` da un altro dispositivo della rete.

**5. Primo accesso.** Il primo utente si registra e crea la famiglia; il
codice di invito si legge in **La mia famiglia** (menu dell'account). Gli
altri si registrano e lo inseriscono in «Entra in una famiglia».

**6. Attiva le copie notturne** e fai subito la prima, come descritto in
[Copia giornaliera di database e foto](#copia-giornaliera-di-database-e-foto).
In `/var/backups/ricette` devono comparire un `ricette-<data>.dump` e un
`foto-<data>.tar.gz`.

**7. Sposta il backup di Proxmox** dell'LXC **dopo le 3:45**, perché includa le
copie notturne di entrambe le app.

**8. Prova l'import** con una ricetta di un sito (per esempio GialloZafferano)
e con un video YouTube che abbia la ricetta nella descrizione.

**9. Facoltativi:** l'accesso al database da un client SQL della LAN
([più sotto](#accedere-al-database-con-un-client-sql)) e l'esposizione su
internet con il tunnel ([qui](#esporre-lapp-su-internet)).

Da qui in poi gli aggiornamenti sono un comando solo, `./deploy.sh` (vedi
[Rilasciare una nuova versione](#rilasciare-una-nuova-versione)).

### Esporre l'app su internet

Il servizio `cloudflared` sta dietro il profilo `public`. Serve un tunnel
**suo**, distinto da quello di finanze, creato da **Zero Trust → Networks →
Tunnels** con un hostname pubblico (es. `ricette.tuodominio.it`) che punta a
`http://app:3000`. Poi nel `.env`:

```
COMPOSE_PROFILES="public"
TUNNEL_TOKEN="…"
AUTH_URL="https://ricette.tuodominio.it"
```

e `docker compose up -d`. Due tunnel separati tengono le app indipendenti: si
può spegnere o rigenerare l'uno senza toccare l'altro.

### Rilasciare una nuova versione

```bash
./deploy.sh
```

Aggiorna il codice, ricostruisce le immagini, applica le migrazioni e riavvia.
Il merge su `main` non distribuisce niente da solo. Le migrazioni non girano
durante il build né all'avvio del server: sono il passo `docker compose run
--rm migrate`.

### Log dell'applicazione

```bash
docker compose logs -f --tail=50 app
docker compose logs app 2>&1 | grep -i import_
```

Il `2>&1` serve: Next, Auth.js, Prisma e gli eventi dell'app scrivono su
stderr. I timestamp sono in UTC. Oltre agli errori delle librerie, l'app
registra una riga JSON solo per questi eventi:

| Evento | Quando | Campi oltre a `ts`, `level`, `event` |
| --- | --- | --- |
| `login_fallito` | Credenziali non valide | `email`, `ip` |
| `registrazione_email_esistente` | Iscrizione su un'email già presente | `email`, `ip` |
| `invito_inesistente` | Codice di invito che non esiste | `codice`, `utente`, `ip` |
| `permesso_negato` | Un membro non amministratore tenta un'azione da amministratore | `famiglia`, `utente`, `azione`, `ip` |
| `ricetta_non_trovata` | Modifica o eliminazione di una ricetta che non c'è (o non è della famiglia) | `ricetta`, `utente`, `azione` |
| `import_bloccato` | Link verso un indirizzo della rete locale | `url`, `motivo`, `utente` |
| `import_fallito` | Pagina irraggiungibile, errore del sito, nessuna ricetta | `url`, `motivo`, `utente` |
| `foto_non_valida` | Foto illeggibile o troppo grande, immagine della fonte non scaricabile | `motivo`, `utente`, a volte `url` |
| `ricetta_eliminata` | Eliminazione di una ricetta (non è un errore) | `ricetta`, `titolo`, `famiglia`, `utente`, `ip` |
| `famiglia_eliminata` | Eliminazione di una famiglia (non è un errore) | `famiglia`, `nome`, `ricette`, `utente`, `ip` |

Le password non compaiono mai.

### Copia giornaliera di database e foto

`backup-db.sh` salva ogni notte due file, entrambi verificati prima di essere
considerati buoni: il dump del database (`ricette-<data>.dump`, riletto con
`pg_restore --list`) e l'archivio delle foto (`foto-<data>.tar.gz`, riletto
con `tar -t`). Nascono `.partial` e perdono l'estensione solo a verifica
riuscita. Le foto vanno copiate a parte perché non stanno nel database.

Per attivarlo, una volta sola:

```bash
sudo cp deploy/ricette-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ricette-backup.timer

sudo ./backup-db.sh          # prima corsa, per vedere subito se funziona
```

Il timer scatta alle **3:30**, mezz'ora dopo quello di finanze, con fino a 10
minuti di ritardo casuale, ed è `Persistent`. Il **backup di Proxmox dell'LXC
va quindi spostato dopo le 3:45**, così porta fuori dalla macchina le copie di
entrambe le app. Controlli:

```bash
systemctl list-timers ricette-backup.timer
journalctl -u ricette-backup -n 50
ls -lh /var/backups/ricette          # `.ultimo-successo` porta la data buona
```

### Ripristinare una copia

Il database: si ferma l'app, si ricrea vuoto il database e si ricarica il
dump. `--single-transaction` fa sì che un errore a metà lasci il database
vuoto, invece che mezzo pieno.

```bash
docker compose stop app
docker compose exec db dropdb -U ricette ricette
docker compose exec db createdb -U ricette ricette
docker compose run --rm --no-TTY backup sh -c \
  'pg_restore --no-owner --no-privileges --exit-on-error --single-transaction \
              -d "$DATABASE_URL" /backups/ricette-<data>.dump'
```

Le foto: il servizio `backup` le vede in sola lettura, quindi si ricaricano
con un container dell'app lanciato come root, che svuota il volume, estrae
l'archivio e restituisce i file all'utente dell'app:

```bash
docker compose run --rm --no-TTY --no-deps -u root \
  -v /var/backups/ricette:/backups:ro app sh -c \
  'find /app/uploads -mindepth 1 -delete \
   && tar -xzf /backups/foto-<data>.tar.gz -C /app/uploads \
   && chown -R nextjs:nodejs /app/uploads'
docker compose up -d
```

Conviene ripristinare dump e foto della **stessa data**: il database dice
quale foto ha ogni ricetta. Entrambe le procedure sono state provate in un
ambiente di prova; vale comunque la pena farlo una volta a freddo.

### Accedere al database con un client SQL

Il database di ricette risponde sulla porta **5433** dell'LXC: la 5432 è
quella di finanze. Senza `DB_LAN_IP` la porta ascolta solo su `127.0.0.1`,
quindi dal PC non si raggiunge. Per aprirla alla rete di casa si aggiunge al
`.env` l'IP dell'LXC e si ricrea il solo container del database (i dati
restano nel volume, l'app si ricollega da sola):

```bash
cd /opt/ricette
echo 'DB_LAN_IP="<ip-lxc>"' >> .env
docker compose up -d db
docker compose ps db        # in PORTS: <ip-lxc>:5433->5432/tcp
```

In alternativa, senza aprire niente, un tunnel SSH:
`ssh -N -L 5433:127.0.0.1:5433 <utente>@<ip-lxc>`, e nel client host
`localhost`.

| Campo | Valore |
| --- | --- |
| Host | L'IP dell'LXC (`localhost` con il tunnel) |
| Porta | **5433** |
| Database | `ricette` |
| Utente | `ricette`, non `postgres` né `finanze` |
| Password | Il valore di `POSTGRES_PASSWORD`, **senza le virgolette** |
| SSL | Disattivato |

La password già senza virgolette:
`grep '^POSTGRES_PASSWORD=' /opt/ricette/.env | cut -d= -f2 | tr -d '"'`.

Se qualcosa non va:

| Sintomo | Causa e rimedio |
| --- | --- |
| «Connection refused» sulla 5433 | Manca `DB_LAN_IP`, oppure l'IP dell'LXC è cambiato: vedi sopra |
| Timeout | Il firewall di Proxmox sull'LXC blocca la 5433: va aperta lì, solo per i dispositivi che servono |
| «password authentication failed» | Il client sta parlando con il database di **finanze** (porta 5432, che quell'utente non lo conosce), oppure la password è stata copiata con le virgolette, oppure l'utente non è `ricette` |

Per escludere che sia la password del `.env`:

```bash
docker compose run --rm migrate   # «No pending migrations to apply» = la password è giusta
```

Se invece risponde «Authentication failed», il database ha una password
diversa dal `.env` (succede rigenerandolo dopo il primo avvio). Si riallinea
dall'interno del container, dove la password non serve:

```bash
PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2 | tr -d '"')
docker compose exec db psql -U ricette -d ricette -c "ALTER USER ricette PASSWORD '$PASS'"
```

Tre avvertenze:

- **Il firewall dell'LXC non conta**: Docker scrive le sue regole prima di
  quelle di `ufw`, quindi una porta pubblicata passa comunque. Per restringere
  a certi dispositivi si usa il firewall di Proxmox.
- **L'IP deve essere fisso** (prenotazione DHCP sul router o indirizzo statico
  in Proxmox): se cambia, `db` non riesce a legarsi alla porta, non parte, e
  l'app si ferma con lui.
- **Fuori da internet lo tiene il router**: nessun inoltro della 5433.

L'utente `ricette` è proprietario del database e può cancellare tutto: prima
di modificare dati a mano, `sudo ./backup-db.sh`.

### Aggiornare Postgres a una versione maggiore

Stessa procedura di finanze, perché lo stesso è il motivo: dalla 18
l'immagine tiene i dati in una sottocartella del volume con il numero di
versione, e un server nuovo partirebbe su un database vuoto. Si passa da un
dump: `sudo ./backup-db.sh`, `docker compose stop app`, nuovo `PG_IMAGE` nel
`.env`, `docker compose up -d db`, ripristino del dump senza
`dropdb`/`createdb`, `docker compose up -d`. Le foto non c'entrano.

## Comandi utili

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Avvia l'app in sviluppo |
| `npm run build` | Build di produzione (esegue anche `prisma generate`) |
| `npm test` | Esegue i test |
| `npm run typecheck` | Controlla i tipi |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Applica/crea le migrazioni (**solo in sviluppo**) |
| `npm run db:seed` | Dati di esempio |
| `npm run db:studio` | Apre Prisma Studio sui dati |
| `./deploy.sh` | Rilascia una nuova versione sull'LXC |
| `./backup-db.sh` | Copia database e foto in `/var/backups/ricette` |

## Come sono organizzati i file

```
prisma/schema.prisma          Modello dati (famiglie, ricette, ingredienti, passi, tag)
prisma/seed.ts                Dati di esempio
src/lib/ingredients.ts        Lettura delle righe di ingredienti, unità, porzioni e formattazione
src/lib/recipe-draft.ts       La bozza del form: da import, da database, verso il database
src/lib/recipe-search.ts      Ricerca e filtri dell'elenco
src/lib/categories.ts         Le portate e il riconoscimento dalle etichette dei siti
src/lib/tags.ts               Tag liberi: normalizzazione e doppioni
src/lib/duration.ts           Tempi: durate ISO 8601 e formattazione
src/lib/import/               Import da link: indirizzi e sicurezza, download, schema.org,
                              YouTube, anteprime, testo libero, catena degli estrattori
src/lib/photos.ts             Foto: conversione con sharp, salvataggio e lettura
src/lib/recipes.ts            Accesso alle ricette, sempre filtrato per famiglia
src/lib/session.ts            Utente e famiglia della richiesta, redirect per le pagine
src/app/actions/              Server action: autenticazione, famiglia, ricette, import
src/app/foto/[key]/route.ts   Le foto, servite solo ai membri della famiglia
src/components/               Interfaccia: form della ricetta, vista con porzioni, schede
```
