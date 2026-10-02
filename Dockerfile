# Base Debian slim e non Alpine: il query engine di Prisma è compilato contro
# glibc e OpenSSL 3, che qui ci sono già. Su musl servirebbe una variante del
# binario e un giro di attenzioni che non vale la pena spendere.
ARG NODE_VERSION=22-bookworm-slim

# --------------------------------------------------------------- dipendenze
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Lo schema va copiato prima di `npm ci`: il postinstall del progetto è
# `prisma generate`, che senza `prisma/schema.prisma` fallisce.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Niente `--omit=dev`: `prisma` sta nelle devDependencies, e serve sia al
# postinstall qui sopra sia allo stadio che applica le migrazioni.
RUN npm ci

# -------------------------------------------------------------------- build
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Il build non legge variabili d'ambiente: nessuna pagina è prerenderizzata,
# quindi nessuna tocca il database. `npm run build` è già
# `prisma generate && next build`.
RUN npm run build

# --------------------------------------------------------------- migrazioni
# La CLI di Prisma non finisce nell'immagine di produzione, che deve restare
# piccola: le migrazioni si applicano da qui, con un container usa e getta.
# `migrate deploy` e non `migrate dev`: il primo applica soltanto, il secondo
# genera migrazioni e in certi casi ricrea il database.
FROM node:${NODE_VERSION} AS migrator
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma

CMD ["npx", "prisma", "migrate", "deploy"]

# --------------------------------------------------------------- produzione
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOADS_DIR=/app/uploads

# Utente senza privilegi: se qualcosa sfugge al processo Node, non è root.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# `WORKDIR` crea /app di root: senza questo il server non potrebbe scrivere la
# cache che Next si crea da sé al primo avvio, né le foto delle ricette.
# La cartella delle foto esiste già nell'immagine, di proprietà di `nextjs`:
# Docker copia proprietario e permessi nel volume quando lo monta la prima
# volta, ed è così che il volume nasce scrivibile dall'app.
RUN mkdir -p /app/.next/cache /app/uploads && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Il query engine di Prisma è un binario, non un `import`: la tracciatura di
# Next non sempre se lo porta dietro, e l'app parte per poi morire alla prima
# query. Copiarlo a mano costa un layer e toglie il dubbio. `sharp`, che
# converte le foto, invece la tracciatura lo trova da sé, binari compresi.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
