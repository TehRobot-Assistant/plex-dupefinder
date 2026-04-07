FROM node:20-alpine

LABEL org.opencontainers.image.source="https://github.com/TehRobot-Assistant/plex-dupefinder"
LABEL org.opencontainers.image.description="Find and remove duplicate media files using Plex detection and Sonarr/Radarr quality scoring"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server.mjs ./
COPY public ./public

EXPOSE 3000

ENV PORT=3000
ENV CONFIG_PATH=/config

CMD ["node", "server.mjs"]
