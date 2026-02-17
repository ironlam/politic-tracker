# Worker Dockerfile — built from project root
# Deploy: fly deploy -c worker/fly.toml
#
# Uses the same base as the main app but runs the sync worker
# instead of Next.js.

ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app
ENV NODE_ENV="production"

# Build stage
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp openssl pkg-config python-is-python3

COPY .npmrc package-lock.json package.json prisma.config.ts ./
COPY prisma prisma/
RUN npm ci --include=dev

# Generate Prisma Client (needs prisma.config.ts + schema)
RUN npx prisma generate

# Copy project (scripts + worker + src needed for Prisma imports)
COPY . .

# Remove dev dependencies but preserve Prisma runtime
# @prisma/client is in devDependencies but the generated client
# needs @prisma/client-runtime-utils at runtime
RUN cp -r node_modules/@prisma/client-runtime-utils /tmp/prisma-runtime && \
    npm prune --omit=dev && \
    cp -r /tmp/prisma-runtime node_modules/@prisma/client-runtime-utils

# Final stage
FROM base

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY --from=build /app /app

EXPOSE 3000
CMD ["node", "worker/server.js"]
