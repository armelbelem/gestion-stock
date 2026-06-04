# Utilisation de l'image officielle Node.js légère
FROM node:20-alpine AS builder

# Définir le dossier de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json package-lock.json* ./

# Installer les dépendances
RUN npm ci

# Copier tout le reste du code source
COPY . .

# Construire l'application Next.js pour la production
RUN npm run build

# ---- ÉTAPE DE PRODUCTION ----
FROM node:20-alpine AS runner
WORKDIR /app

# Définir l'environnement en production
ENV NODE_ENV production

# Copier les fichiers nécessaires depuis l'étape de build
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts

# Exposer le port que Next.js va utiliser
EXPOSE 3000

# Commande pour démarrer l'application
CMD ["npm", "run", "start"]
