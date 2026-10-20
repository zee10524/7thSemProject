# syntax=docker/dockerfile:1.7
# LitSense API (and worker: same image, run `node apps/api/dist/worker.js`). Build from the repo root:
#   docker build -f apps/api/Dockerfile -t litsense-api .

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --no-audit --no-fund -w @litsense/shared -w @litsense/api --include-workspace-root

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @litsense/shared && npm run build -w @litsense/api

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund -w @litsense/shared -w @litsense/api \
  && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/healthz || exit 1
CMD ["node", "apps/api/dist/server.js"]
