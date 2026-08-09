# Un solo contenedor: PocketBase sirve la API y, desde pb_public/, la SPA.
# Es el diseño que describe DEPLOY.md — mismo origen, sin proxy delante.
# El VPS no tiene node instalado: el build de la web ocurre acá.

FROM node:22-alpine AS build
WORKDIR /app
# puppeteer es solo para los scripts de QA headless; sin esto npm ci se baja
# un Chromium de ~150 MB que la imagen final nunca usa.
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM alpine:3.21 AS fetch
ARG PB_VERSION=0.39.10
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q -O /tmp/pb.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
 && unzip -q /tmp/pb.zip -d /pbbin \
 && rm /tmp/pb.zip

FROM alpine:3.21
RUN apk add --no-cache ca-certificates wget tzdata
ENV TZ=America/Santiago
COPY --from=fetch /pbbin/pocketbase /usr/local/bin/pocketbase
COPY --from=build /app/dist /pb/pb_public

WORKDIR /pb
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null 2>&1 || exit 1

# Los tres directorios van absolutos: los valores por defecto de PocketBase son
# relativos a la ubicación del binario (/usr/local/bin), no al WORKDIR.
CMD ["pocketbase", "serve", \
     "--http=0.0.0.0:8090", \
     "--dir=/pb/pb_data", \
     "--migrationsDir=/pb/pb_migrations", \
     "--publicDir=/pb/pb_public"]
