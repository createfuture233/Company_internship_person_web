# ========== Personal Planet 前端 Dockerfile ==========
FROM node:20-alpine AS builder
WORKDIR /app
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/astro.config.mjs ./
COPY client/tsconfig.json ./
COPY client/public ./public/
COPY client/src ./src/
ARG PUBLIC_API_BASE=/api
ENV PUBLIC_API_BASE=${PUBLIC_API_BASE}
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=builder /app/dist ./dist
COPY client/package.json ./

EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
