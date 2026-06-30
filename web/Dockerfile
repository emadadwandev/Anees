FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ─── Development ──────────────────────────────────────────────────────────────
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3002
CMD ["npm", "run", "dev"]

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_LIVEKIT_URL
RUN npm install
COPY . .
RUN npm run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3002
ENV PORT=3002
CMD ["node", "server.js"]
