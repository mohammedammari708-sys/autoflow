# AutoFlow API — production image (Node 24, SQLite).
#
# Build from the REPO ROOT (the build context must be the repo root,
# because npm workspaces resolve from the root package.json):
#   docker build -f apps/api/Dockerfile -t autoflow-api .
#
# Run (generate real secrets first — never use the examples below):
#   docker run -p 4000:4000 \
#     -v autoflow-data:/app/data \
#     -e NODE_ENV=production \
#     -e JWT_SECRET=<long-random-hex> \
#     -e ENCRYPTION_KEY=<64-hex-chars> \
#     -e WEB_ORIGIN=https://your-frontend.example.com \
#     autoflow-api
#
# Notes:
# - The SQLite file lives at /app/data/autoflow.db. Without a volume
#   (or a persistent disk on your host) the data is lost when the
#   container is replaced. See DEPLOY.md.
# - PORT is honoured from the environment (Render injects it).

FROM node:24-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build --workspace=@autoflow/api
RUN npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL=./data/autoflow.db
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/apps/api/dist ./dist
COPY --from=build /build/apps/api/package.json ./package.json
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
