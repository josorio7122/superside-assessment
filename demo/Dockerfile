FROM node:24-alpine

RUN apk add --no-cache bash curl
RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json biome.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY infra ./infra

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=development

EXPOSE 3001 5173

# Default command is overridden per-service in docker-compose.yml.
CMD ["node", "--version"]
