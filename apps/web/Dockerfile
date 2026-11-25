# AutoFlow web — static build served by nginx.
#
# Build from the REPO ROOT:
#   docker build -f apps/web/Dockerfile -t autoflow-web .
#
# Build arg VITE_API_URL: absolute URL of the API, baked into the build
# (e.g. https://autoflow-api.onrender.com). Leave it empty for
# same-origin deployments (docker-compose proxies /api to the API):
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://autoflow-api.onrender.com -t autoflow-web .

FROM node:24-alpine AS build
WORKDIR /build
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci --no-audit --no-fund
COPY apps/web apps/web
RUN npm run build --workspace=@autoflow/web

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
