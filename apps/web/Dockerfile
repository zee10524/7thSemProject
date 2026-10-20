# syntax=docker/dockerfile:1.7
# LitSense web: static build served by nginx, which also proxies /api to the API container.
#   docker build -f apps/web/Dockerfile -t litsense-web .

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --no-audit --no-fund -w @litsense/shared -w @litsense/web --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w @litsense/shared && npm run build -w @litsense/web

FROM nginx:1.27-alpine AS runtime
ENV API_UPSTREAM=http://api:4000
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
