FROM node:22-bookworm-slim

WORKDIR /app

RUN npm install --global @openai/codex@0.144.6

COPY services/codex-worker/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts

COPY services/codex-worker/server.mjs ./server.mjs

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    JOBRAKER_CODEX_DATA_DIR=/data/codex

VOLUME ["/data/codex"]
EXPOSE 8787

CMD ["node", "server.mjs"]
