# ========== Personal Planet 服务端 Dockerfile ==========
FROM node:20-alpine AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS builder
WORKDIR /app
COPY server/package.json ./
RUN npm install
COPY server/tsconfig.json ./
COPY server/prisma ./prisma/
COPY server/src ./src/
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY server/package.json ./
COPY server/prisma ./prisma/

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", "dist/main.js"]
