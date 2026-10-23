ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim

WORKDIR /app

COPY . .
RUN npm ci --include=optional

CMD ["npm", "run", "build"]
