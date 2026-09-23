FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server/server.js"]
