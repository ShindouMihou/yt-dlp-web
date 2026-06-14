# syntax=docker/dockerfile:1

# ---- Build stage: compile web (Vite) and server (tsc) ----
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY server ./server
COPY web ./web
RUN npm run build

# ---- Runtime stage: slim image with ffmpeg + pinned yt-dlp ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=8382 \
    TEMP_DIR=/data/temp
WORKDIR /app

# yt-dlp is PINNED for reproducibility; bump with --build-arg YTDLP_VERSION=YYYY.MM.DD
ARG YTDLP_VERSION=latest
# Deno provides the JavaScript runtime yt-dlp needs to solve YouTube's n-signature
# challenge; without it, high-resolution adaptive formats may be unavailable.
ARG DENO_VERSION=latest
ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl tini unzip \
    && rm -rf /var/lib/apt/lists/* \
    && if [ "$TARGETARCH" = "arm64" ]; then BIN=yt-dlp_linux_aarch64; else BIN=yt-dlp_linux; fi \
    && if [ "$YTDLP_VERSION" = "latest" ]; then \
         URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/$BIN"; \
       else \
         URL="https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP_VERSION/$BIN"; \
       fi \
    && curl -fsSL "$URL" -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version \
    && if [ "$TARGETARCH" = "arm64" ]; then DENO_TRIPLE=aarch64-unknown-linux-gnu; else DENO_TRIPLE=x86_64-unknown-linux-gnu; fi \
    && if [ "$DENO_VERSION" = "latest" ]; then \
         DENO_URL="https://github.com/denoland/deno/releases/latest/download/deno-${DENO_TRIPLE}.zip"; \
       else \
         DENO_URL="https://github.com/denoland/deno/releases/download/${DENO_VERSION}/deno-${DENO_TRIPLE}.zip"; \
       fi \
    && curl -fsSL "$DENO_URL" -o /tmp/deno.zip \
    && unzip -o /tmp/deno.zip -d /usr/local/bin \
    && rm /tmp/deno.zip \
    && chmod a+rx /usr/local/bin/deno \
    && /usr/local/bin/deno --version

# Production dependencies only.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Built artifacts: server code + static SPA served from ./public.
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/web/dist ./public

RUN useradd --system --uid 10001 --create-home appuser \
    && mkdir -p /data/temp \
    && chown -R appuser:appuser /app /data
USER appuser

EXPOSE 8382
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/api/health" || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "server/dist/index.js"]
