FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

# DigitalOcean App Platform injects PORT at runtime (typically 8080).
EXPOSE 8080

CMD ["npm", "start"]
