#!/bin/bash
# Prepara l'ambiente di una sessione di Claude Code sul web.
#
# Il container nasce con il repository appena clonato e senza `node_modules`:
# senza le dipendenze installate i quattro controlli che CLAUDE.md impone prima
# di ogni push — test, typecheck, lint, build — non si possono nemmeno lanciare.
set -euo pipefail

# In locale le dipendenze ci sono già, e reinstallarle a ogni sessione sarebbe
# solo tempo perso: l'hook serve alle sessioni remote.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# `npm install` e non `npm ci`: riusa quello che trova invece di ripartire da
# zero, e lo stato del container resta in cache dopo l'hook. Il `postinstall`
# del progetto esegue già `prisma generate`, quindi il client c'è subito.
npm install --no-audit --no-fund
