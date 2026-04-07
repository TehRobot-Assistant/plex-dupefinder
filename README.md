# Plex DupeFinder

Find and remove duplicate media files in your Plex libraries, scored by Sonarr/Radarr quality profiles.

![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## What It Does

- Scans your Plex libraries for episodes and movies with multiple file versions
- Cross-references with Sonarr/Radarr to get quality scores for each file
- Recommends which file to keep based on quality weight + custom format scores
- Lets you delete the inferior copy directly from the UI

## Quick Start

### Docker Compose

```yaml
services:
  plex-dupefinder:
    image: ghcr.io/tehrobot-assistant/plex-dupefinder:latest
    container_name: plex-dupefinder
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config
    restart: unless-stopped
```

```bash
docker compose up -d
```

### Manual

```bash
npm install
npm start
```

## Setup

1. Open the web UI at `http://your-server:3000`
2. Go to **Settings**
3. Enter your Plex URL and token
4. Enter your Sonarr and/or Radarr URL and API key
5. Click **Save Settings** then **Test Connections**
6. Go to **Scan** and hit **Scan TV Shows** or **Scan Movies**

## How Scoring Works

Each duplicate file is scored using data from Sonarr/Radarr:

- **Quality Weight** — from your quality definitions (e.g., Bluray-1080p > HDTV-720p)
- **Custom Format Score** — bonus points from your custom format rules
- **Tie-break** — larger file size wins if quality scores are equal

The file with the highest combined score is marked **KEEP**. Others are marked **DUPE** with a delete button.

## Finding Your Plex Token

1. Open Plex Web, play any media, and click the **...** menu
2. Click **Get Info** > **View XML**
3. The token is in the URL: `X-Plex-Token=YOUR_TOKEN`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Web UI port |
| `CONFIG_PATH` | `/config` | Where settings are stored |

## Tech Stack

- Node.js + Express
- Vanilla JS frontend (no build step)
- Plex API, Sonarr API v3, Radarr API v3

## License

MIT
