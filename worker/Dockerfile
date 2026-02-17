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

COPY .npmrc package-lock.json package.json ./
COPY prisma prisma/
RUN npm ci --include=dev

# Generate Prisma Client
RUN npx prisma generate

# Copy project (scripts + worker + src needed for Prisma imports)
COPY . .

# Remove dev dependencies
RUN npm prune --omit=dev

# Final stage
FROM base

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY --from=build /app /app

EXPOSE 3000
CMD ["node", "worker/server.js"]
