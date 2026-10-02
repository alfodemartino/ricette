#!/usr/bin/env bash
#
# Rilascio di una nuova versione sul container LXC: il merge su `main` non
# distribuisce niente da solo.
#
#   ./deploy.sh
#
# I profili attivi si dichiarano in `.env` con `COMPOSE_PROFILES`, così lo
# script funziona identico prima e dopo l'esposizione su internet.

set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "Manca il file .env: senza DATABASE_URL, POSTGRES_PASSWORD e AUTH_SECRET l'app non parte." >&2
  exit 1
fi

echo "==> Aggiorno il codice"
# `--ff-only`: se qualcuno ha modificato i file direttamente sull'LXC è meglio
# fermarsi qui che ritrovarsi un merge a metà su una macchina di produzione.
git pull --ff-only

echo "==> Costruisco le immagini"
# I servizi vanno nominati: `migrate` sta nel profilo `tools`, e un `build`
# senza argomenti salterebbe i servizi fuori dai profili attivi, lasciando in
# giro un'immagine delle migrazioni vecchia di un rilascio.
docker compose build app migrate

echo "==> Applico le migrazioni"
docker compose run --rm migrate

echo "==> Riavvio i servizi"
docker compose up -d

echo "==> Rimuovo le immagini rimaste orfane"
# Tocca solo le immagini senza nome: quelle di finanze, in uso, restano.
docker image prune -f

echo "==> Fatto."
docker compose ps
