FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Install tsx globally to run .ts files
RUN npm install -g tsx

# Hugging Face uses port 7860 by default
EXPOSE 7860
ENV PORT=7860

CMD ["npx", "tsx", "game-server.ts"]
