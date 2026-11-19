# The institution front for Render: packages/app built once and served as
# static files by nginx (unprivileged) on $PORT, under /app/web/ and
# /app/chrome/ as dev-server.mjs does. Build context is the repo root:
#   docker build -f deploy/render/Dockerfile .
# It lives here and not in the repo root, because a root Dockerfile switches
# the Vercel preset. /api/v1 is not proxied here; see docs/DEPLOY.md.

FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@10.33.0
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --dir src/client install --ignore-workspace --frozen-lockfile --ignore-scripts
RUN pnpm --filter @ductura/app run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
# Render sets PORT; 8080 is the default for a local run.
ENV PORT=8080
COPY deploy/render/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/packages/app/dist /usr/share/nginx/html/app/web
EXPOSE 8080
