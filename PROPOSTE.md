# Proposte di funzionalità

Analisi dell'app fatta a ottobre 2026 sul codice di `main` (commit `69d5cfd`),
con un confronto con le app di ricette più diffuse. A parte quanto elencato
in [Realizzate](#realizzate), niente di quanto segue è ancora implementato:
sono proposte da riprendere. Quando una proposta viene realizzata o
scartata, questo file si aggiorna nella stessa PR.

## Decisioni già prese

- Ricette si usa **sia in http dalla rete di casa sia in HTTPS dal tunnel**:
  ogni funzione che richiede HTTPS deve avere un ripiego in http.
- **Niente Claude per ora**, né per completare gli import parziali né per
  leggere le foto. La predisposizione (`RecipeEnhancer`, `rawText`,
  `ANTHROPIC_API_KEY` nel `.env.example`) resta com'è.
- La **lista della spesa** sarà **condivisa dentro Ricette**, non un testo da
  mandare a un'altra app.
- Si parte da due blocchi, una PR ciascuno: **cestino e modalità cucina**,
  poi **import da testo e da link condiviso**.

## Cosa fa già bene

- Modello dati solido: quantità numeriche, unità normalizzate, sottosezioni,
  porzioni ricalcolate con arrotondamenti «da cucina».
- Import da link curato: schema.org, YouTube, anteprime, link nella
  descrizione, tag proposti, avviso dei doppioni (anche da un link
  accorciato), `safeFetch` contro la rete di casa, bozza mai salvata da sola.
- Lettura degli elenchi incollati pensata per l'italiano.
- Ricettario di famiglia vero: inviti, ruoli, filtro sul `familyId` a ogni
  richiesta, foto servite solo alla famiglia.
- Esercizio in ordine: copie notturne di database e foto, rilascio esplicito,
  log degli eventi, test sulla logica pura.

## Confronto con app simili

| Funzionalità | Ricette oggi | Dove esiste |
| --- | --- | --- |
| Import da link | Sì | Paprika, Crouton, Mealie |
| Modalità cucina, schermo sempre acceso | No (il segno dei passi si perde ricaricando) | Paprika, Crouton |
| Contaminuti avviati dal testo dei passi | No | Paprika, Crouton |
| Import da foto | No | Crouton |
| Lista della spesa che somma gli ingredienti | No | Paprika, Mealie, Tandoor, KitchenOwl |
| Menu della settimana | No | Paprika, Mealie, Tandoor, KitchenOwl |
| Voti e «ultima volta cucinata» | No | Mealie |
| Ricette dentro altre ricette (le basi) | No | Tandoor |
| Stampa, esportazione in altri formati | No | Tandoor |
| Valori nutrizionali | No | Tandoor |
| Dispensa con scadenze | No | Paprika |

## Lacune emerse dal codice

- **Nessun cestino**: chiunque elimina qualsiasi ricetta, e il recupero passa
  dal dump notturno, che riporta indietro l'intero database alla notte prima.
- **Nessun cambio né recupero della password**: senza email, una password
  dimenticata si sistema solo a mano nel database.
- **Tentativi di accesso illimitati**: `login_fallito` finisce nel log ma non
  rallenta nessuno; pesa quando l'app è raggiungibile da internet.
- **Modifiche contemporanee**: `saveRecipe` riscrive tutto, vince l'ultima
  senza avviso.

## HTTPS

Schermo sempre acceso (Screen Wake Lock API), condivisione nativa
(`navigator.share`), copia negli appunti (`navigator.clipboard`) e
installazione come app richiedono HTTPS. Poiché Ricette si apre anche in
http, queste funzioni si accendono solo dal dominio; in http compaiono
ripieghi (testo selezionabile, link `wa.me`) o una breve indicazione.

Per la copia il ripiego c'è già e va riusato: `copyText`
(`src/lib/clipboard.ts`) passa a `execCommand("copy")` quando
`navigator.clipboard` manca, e così copiano anche in http il messaggio di
«Condividi» e il codice d'invito.

- Su iOS lo schermo acceso funziona in Safari da iOS 16.4 e nelle app sulla
  schermata Home da iOS 18.4.
- Fra i telefoni, comparire nel menu «Condividi» (Web Share Target) è
  possibile solo su Android; su iOS si usa un comando rapido che apre
  `…/ricette/importa?url=<link>`.
- Quello che si salva nel browser vale per indirizzo: la stessa ricetta
  aperta in http e in HTTPS ha segni separati.

## Piano di lavoro

### Prossimi

1. **Cestino** per le ricette eliminate.
2. **Modalità cucina**: contaminuti dai passi, spunte salvate, schermo acceso.
3. **Import da testo incollato e da link condiviso**.

### Poi, in ordine di valore

4. **Account**: cambio di nome e password; link di reimpostazione monouso,
   valido 24 ore, creato dall'amministratore e mandato su WhatsApp (token
   salvato solo come hash); limite ai tentativi di accesso.
5. **Lista della spesa condivisa**: «Aggiungi alla spesa» con le persone
   scelte, righe uguali sommate (g con kg, ml con l), reparti da un piccolo
   dizionario italiano in `src/lib/` (puro, con test), spunte condivise.
6. **Preferite e diario «l'abbiamo cucinata»** (data, voto, nota), con gli
   ordinamenti «cucinate di recente», «non la facciamo da un po'», «A-Z».
7. **Menu della settimana**, che riempie la lista della spesa.
8. **Stampa** (con i colori del tema chiaro anche in tema scuro) e
   **installazione come app** (`src/app/manifest.ts`, `share_target` su
   Android). L'invio della ricetta come testo è fatto: vedi
   [Realizzate](#realizzate).
9. **Storico delle modifiche** e **avviso di modifica contemporanea**
   (confronto di `updatedAt` al salvataggio).
10. Più avanti: ricette collegate (ragù, besciamella, frolla), più foto per
    ricetta, «cosa cucino con…», esportazione completa (JSON schema.org e
    foto), conversione delle unità americane.

### Realizzate

- **Invio della ricetta come testo** (ottobre 2026): «Condividi» nella
  ricetta e nell'elenco, con l'icona su ogni scheda e la selezione di più
  ricette. Il messaggio ha un'emoji davanti a ogni sezione e le quantità per
  le persone scelte; lo compone `src/lib/share.ts`. Per mandarlo c'è il
  pannello del telefono in HTTPS, mentre WhatsApp (`wa.me`), la copia e
  l'email funzionano anche in http.

### Accantonate

- **Claude e import da foto**: per scelta. Senza un modello l'import da foto
  non è realistico, perché l'OCR tradizionale legge male la scrittura a mano.
- **Valori nutrizionali e dispensa**: chiedono di collegare ogni ingrediente
  a una banca dati o di tenere aggiornato l'inventario, troppo lavoro per un
  ricettario di casa.
- **Link pubblici a una ricetta**: romperebbero «chi non è della famiglia
  riceve 404»; l'invio come testo copre lo stesso bisogno.
- **Trascrizione dei video YouTube**: si basa su interfacce non ufficiali.

## Note tecniche per i prossimi blocchi

### Cestino

«Elimina» sposta nel cestino; da «Eliminate di recente» (menu dell'account)
si ripristina o si elimina per sempre; dopo 30 giorni ricetta e foto
spariscono.

- `Recipe.deletedAt` e `Recipe.deletedById` (relazione `RecipeDeletedBy`,
  `onDelete: SetNull`), indice `[familyId, deletedAt]`, migrazione nuova.
- `src/lib/trash.ts`, puro e con test: durata, data di eliminazione
  definitiva, scadenza.
- `src/lib/recipes.ts`: le letture, comprese `findFamilyRecipesFromSource`
  e `listFamilyRecipesToShare` arrivate dopo l'analisi, e il controllo
  iniziale di `saveRecipe` filtrano `deletedAt: null`; `listFamilyTags` usa
  `recipes: { some: { deletedAt: null } }`, così i tag di una ricetta nel
  cestino restano legati e il ripristino non li perde. Nuove `trashRecipe`,
  `restoreRecipe`, `listTrashedRecipes`, `purgeRecipe`,
  `purgeExpiredTrash`. `deleteRecipeAction` oggi usa Prisma direttamente:
  passa da qui.
- La pulizia dei 30 giorni gira quando si elimina o si apre il cestino:
  nessun timer di sistema in più.
- Dopo l'eliminazione, `/ricette?eliminata=<id>` mostra «“Titolo” è nel
  cestino» con «Ripristina».
- `src/app/ricette/cestino/` con `page.tsx` e `loading.tsx`; conteggi di
  `src/app/famiglia/page.tsx` senza il cestino; la route delle foto e
  l'eliminazione della famiglia restano come sono.
- Log: `ricetta_ripristinata`, `ricetta_eliminata_definitivamente` (con
  `motivo`: `manuale` o `scaduta`); `ricetta_eliminata` diventa «spostata nel
  cestino». README e regole del dominio in `CLAUDE.md` aggiornati.

### Modalità cucina

- `findDurations(text)` in `src/lib/duration.ts`, con test: «20 minuti»,
  «1 ora e 30 minuti» (una sola durata), «un'ora e mezza», «mezz'ora», «un
  quarto d'ora», «un paio di minuti», «dieci minuti», «10'», «1h30»,
  «20-25 minuti» (vale il primo numero, come per le quantità), notazione del
  Bimby («10 sec. vel. 5»). Le temperature («180°») no.
- `src/lib/cooking.ts`, puro e con test: segni salvati, scadenza dopo 12 ore,
  tempo rimasto da un'ora di fine, formato «12:05».
- Componente client con il contesto della pagina: passi fatti, ingredienti
  spuntati e contaminuti in `localStorage` per ricetta, dentro `try/catch`
  (gli id spariti dopo una modifica si ignorano); barra fissa in basso con i
  contaminuti; suono con Web Audio, preparato al tocco che avvia il
  contaminuti come iOS richiede; vibrazione dove esiste; interruttore
  «Schermo acceso» che in http lascia il posto a un'indicazione;
  «Ricomincia».
- `src/components/RecipeView.tsx`: pulsanti «⏱ 20 min» sotto ogni passo,
  fuori dal pulsante del passo (niente pulsanti annidati); ingredienti
  spuntabili come i passi.
- Limiti da scrivere nel README: i contaminuti vivono nella pagina della
  ricetta (uscendo restano salvati); con lo schermo bloccato iOS sospende la
  pagina; in silenzioso il suono può non sentirsi, resta l'avviso a schermo.

### Import da testo e da link condiviso

- `src/lib/import/pasted.ts`, puro e con test: una ricetta incollata
  (WhatsApp, email, note) diventa `ImportedRecipe`; titolo dalla prima riga
  se è breve e non è un ingrediente; il resto con `parseRecipeText`; se
  mancano i passi, le frasi dopo l'elenco diventano passi.
- Va riletto anche il messaggio di «Condividi»: un test di
  `src/lib/share.test.ts` verifica già che `parseRecipeText` ne ricavi
  ingredienti, passi e porzioni. Al titolo va tolta l'emoji 🍽️ in testa.
- `ImportedRecipe` ammette `sourceKind` `MANUALE` e `sourceUrl` vuoto.
- La coda di `importRecipe` (link nel testo, `enhancers`, controllo «nessuna
  ricetta») diventa una funzione comune, usata anche da
  `importRecipeFromText`. Se il testo rimanda alla ricetta completa, quella
  pagina diventa la fonte, e come per i link vale l'avviso dei doppioni:
  `importTextAction` restituisce `existing` da
  `findFamilyRecipesFromSource`, con `sourceUrl` e `resolvedUrl`.
- `importTextAction` (al massimo 20.000 caratteri) e, in
  `/ricette/importa`, il controllo segmentato «Da link | Da testo»
  (`SegmentedLinks`, `?da=testo`).
- `?url=…` e `?text=…` precompilano i campi senza scaricare niente finché
  non si tocca il pulsante: servono al comando rapido di iOS e al segnalibro
  sul computer.
- Se la sessione è scaduta, `/login?da=<percorso>` riporta all'import dopo
  l'accesso; il percorso si accetta solo se interno (`/…`, mai `//…`).

### Verifica

- I quattro controlli di `CLAUDE.md` prima di ogni push.
- Migrazione provata sul Postgres locale, su un database vuoto e su uno con
  i dati di prova.
- A schermo a 1280 e 390 px: eliminazione, ripristino ed eliminazione
  definitiva (foto tolta dal disco); 404 per una ricetta nel cestino;
  contaminuti e spunte che restano dopo una ricarica; interruttore dello
  schermo su `localhost` e indicazione in http; ricetta incollata con e
  senza intestazioni; parametri `?url=` e `?text=`; ritorno all'import dopo
  il login.

## Fonti

- [Paprika Recipe Manager 3 — App Store](https://apps.apple.com/us/app/paprika-recipe-manager-3/id1303222868)
- [Crouton: Recipe Manager — App Store](https://apps.apple.com/us/app/crouton-recipe-manager/id1461650987)
- [Mealie — funzionalità](https://mealie.io/documentation/getting-started/features/)
- [Tandoor — esportazione e importazione](https://docs.tandoor.dev/features/import_export/)
- [Tandoor — lista della spesa](https://docs.tandoor.dev/features/shopping/)
- [Tandoor vs Mealie vs KitchenOwl](https://cooklang.org/blog/42-tandoor-vs-mealie-vs-kitchenowl/)
- [KitchenOwl — GitHub](https://github.com/TomBursch/kitchenowl)
- [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- [Web Share Target — supporto dei browser](https://web-platform-dx.github.io/web-features-explorer/features/app-share-targets/)
- [Screen Wake Lock API — W3C](https://www.w3.org/TR/screen-wake-lock/)
- [Web Share API — W3C](https://www.w3.org/TR/web-share/)
