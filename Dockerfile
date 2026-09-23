FROM node:20-alpine

WORKDIR /app

RUN mkdir -p /app/data && chown -R node:node /app

COPY --chown=node:node package*.json ./
RUN npm install

COPY --chown=node:node . .
RUN npm run build

USER node

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server/server.js"]

