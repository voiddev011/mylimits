# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --ignore-scripts --omit=optional
COPY server/package.json server/package-lock.json ./server/
RUN --mount=type=secret,id=proxy_ca NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --prefix server --ignore-scripts
COPY scripts/register-typescript.mjs ./scripts/register-typescript.mjs
COPY src/core ./src/core
COPY server ./server
RUN npm --prefix server run typecheck && npm --prefix server run build:web
FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 8787
CMD ["npm","--prefix","server","start"]
