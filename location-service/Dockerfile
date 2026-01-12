FROM node:18

WORKDIR /app

# Installation des dépendances système nécessaires pour sqlite3
RUN apt-get update && \
    apt-get install -y python3 make g++ sqlite3 && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Installation propre des dépendances (sans forcer la recompilation globale)
RUN npm install

# Forcer uniquement la reconstruction de sqlite3 pour l'environnement du conteneur
RUN npm rebuild sqlite3 --build-from-source

COPY . .

EXPOSE 5002

CMD ["npm", "start"]
