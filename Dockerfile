
FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ENV NODE_ENV=production

EXPOSE 5000

CMD ["npm", "start"]
