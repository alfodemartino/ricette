#!/usr/bin/env bash
#
# Copia giornaliera del database e delle foto su questa macchina.
#
# Database e foto vivono in volumi Docker su questa stessa macchina e nessun
# altro ne tiene una storia: queste copie sono l'unico modo di recuperare una
# ricetta cancellata per sbaglio, o tutto dopo una migrazione sbagliata. Non
# coprono la perdita del disco: la cartella va copiata anche fuori dall'LXC
# (vedi README).
#
#   sudo ./backup-db.sh
#
# Di norma non si lancia a mano: lo fa il timer systemd in deploy/. Serve root
# perché i file nella cartella dei backup nascono di proprietà di root, creati
# dal container.

set -euo pipefail

cd "$(dirname "$0")"

# Il valore di una variabile scritta nel `.env`, senza le virgolette. Lo script
# non può contare su `docker compose` per leggerle: `KEEP_DAYS` a Compose non
# serve, e `BACKUP_DIR` qui sotto va esportata — e una variabile esportata vince
# su quella del `.env`, che resterebbe ignorata.
# `|| true` perché una variabile assente non è un errore: con `pipefail`, il
# `grep` che non trova niente fermerebbe lo script.
env_value() {
  grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- | sed -E "s/^\"(.*)\"$/\1/; s/^'(.*)'$/\1/" || true
}

# Esportata perché la legge anche `docker compose`, interpolando
# docker-compose.yml: script e container devono usare la stessa cartella.
BACKUP_DIR="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
export BACKUP_DIR="${BACKUP_DIR:-/var/backups/ricette}"
KEEP_DAYS="${KEEP_DAYS:-$(env_value KEEP_DAYS)}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M%S)"
dump="ricette-$stamp.dump"
photos="foto-$stamp.tar.gz"

# Tutto avviene dentro lo stesso container, in un comando solo:
#
#   - ogni file nasce con estensione `.partial` e la perde solo alla fine,
#     quindi una corsa interrotta a metà non lascia in giro qualcosa che
#     sembra un backup valido;
#   - `pg_restore --list` e `tar -t` rileggono quello che è appena stato
#     scritto. Un backup mai verificato non è un backup: è un file che si
#     scopre illeggibile il giorno in cui serve.
#
# `--no-TTY` non è un dettaglio di stile: senza, Compose alloca un terminale e
# il dump binario esce corrotto.
docker compose run --rm --no-TTY -e DUMP="/backups/$dump" -e PHOTOS="/backups/$photos" backup sh -c '
  set -e
  pg_dump --format=custom --compress=9 --no-owner --no-privileges \
          -d "$DATABASE_URL" -f "$DUMP.partial"
  pg_restore --list "$DUMP.partial" > /dev/null
  mv "$DUMP.partial" "$DUMP"

  tar -czf "$PHOTOS.partial" -C /uploads .
  tar -tzf "$PHOTOS.partial" > /dev/null
  mv "$PHOTOS.partial" "$PHOTOS"
'

# Marcatore leggibile a colpo d'occhio: `ls -l` sulla cartella dice quando è
# andata bene l'ultima volta, senza dover interrogare il journal.
touch "$BACKUP_DIR/.ultimo-successo"

# La rotazione viene dopo la verifica, di proposito: se la copia di oggi fosse
# fallita, le vecchie sono l'unica cosa che resta e non vanno toccate.
find "$BACKUP_DIR" -maxdepth 1 \( -name 'ricette-*.dump' -o -name 'foto-*.tar.gz' \) -mtime "+$KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name '*.partial' -mtime +1 -delete

echo "Backup completato:"
ls -lh "$BACKUP_DIR/$dump" "$BACKUP_DIR/$photos"
