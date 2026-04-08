# Plex DupeFinder

<p align="center">
  <img src="icon.png" alt="Plex DupeFinder" width="200">
</p>

<p align="center">
  Find and remove duplicate media files in your Plex libraries, scored by Sonarr/Radarr quality profiles.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Docker-Ready-blue" alt="Docker">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

## Features

- **Plex duplicate scanning** — finds episodes and movies with multiple file versions
- **Sonarr/Radarr quality scoring** — uses quality weights, custom format scores, and grab history
- **Filename matching** — handles different mount points between Plex and Sonarr/Radarr
- **History fallback** — scores files from Sonarr/Radarr grab history, not just active files
- **Resolution fallback** — when no Arr score exists, uses Plex resolution (1080p > 720p)
- **Show grouping** — duplicates grouped by show/movie with collapsible dropdowns
- **Folder classification** — separates same-folder dupes (safe to clean) from different-folder dupes (review carefully)
- **Per-show stats** — dupe count and reclaimable space per show
- **Bulk operations** — checkboxes, select all dupes, show-level select, bulk delete
- **Sorting** — by name, size, or number of duplicates
- **Delete via Sonarr/Radarr or Plex** — uses Arr API when available, falls back to Plex API
- **In-app settings** — configure Plex, Sonarr, and Radarr connections with connection testing

## Quick Start

### Docker Compose (Recommended)

```yaml
services:
  plex-dupefinder:
    image: tehrobot/plex-dupefinder:latest
    container_name: plex-dupefinder
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config
    environment:
      - PORT=3000
      - CONFIG_PATH=/config
    restart: unless-stopped
```

```bash
docker compose up -d
```

### Docker Run

```bash
docker run -d \
  --name plex-dupefinder \
  -p 3000:3000 \
  -v $(pwd)/config:/config \
  tehrobot/plex-dupefinder:latest
```

### Run Locally

```bash
git clone https://github.com/TehRobot-Assistant/plex-dupefinder.git
cd plex-dupefinder
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

Each duplicate file is scored in this order:

1. **Sonarr/Radarr quality weight** — from your quality definitions (e.g., Bluray-1080p > HDTV-720p)
2. **Custom format score** — bonus points from your custom format rules
3. **Plex resolution** — fallback when no Arr score (1080 > 720 > 480)
4. **Pixel count** — 1920x1080 beats 1280x720
5. **File size** — last resort tie-breaker

Files are matched by **filename** (not full path), so different mount points between Plex (`/mnt/media/...`) and Sonarr (`/tv/...`) are handled correctly.

The app also pulls **grab history** from Sonarr/Radarr, so files that were downloaded but are no longer the active episode file still get scored.

The file with the highest combined score is marked **KEEP**. Others are marked **DUPE** with a delete button.

## Unraid Installation

### Option A: Search Docker Hub

1. Go to **Apps** tab and search **TehRobot**
2. Find **plex-dupefinder** and click **Install**
3. Set your port and appdata path
4. Click **Apply**

### Option B: Docker Tab (Manual)

1. Go to **Docker** > **Add Container**
2. Repository: `tehrobot/plex-dupefinder:latest`
3. Port: `3000` > `3000`
4. Path: `/config` > `/mnt/user/appdata/plex-dupefinder`
5. Click **Apply**

## Finding Your Plex Token

1. Open Plex Web, play any media, and click the **...** menu
2. Click **Get Info** > **View XML**
3. The token is in the URL: `X-Plex-Token=YOUR_TOKEN`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Web UI port |
| `CONFIG_PATH` | `/config` | Where settings are stored |

## Docker Hub

Available on Docker Hub: [tehrobot/plex-dupefinder](https://hub.docker.com/r/tehrobot/plex-dupefinder)

## Tech Stack

- Node.js + Express
- Vanilla JS frontend (no build step)
- Plex API, Sonarr API v3, Radarr API v3

## License

MIT
