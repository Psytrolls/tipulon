FROM node:22-alpine

WORKDIR /app

# 1. Install all dependencies using reproducible npm ci
COPY package*.json ./
RUN npm ci

# 2. Copy source files and compile Vite frontend
COPY . .
RUN npm run build && npm prune --omit=dev

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server/server.js"]



