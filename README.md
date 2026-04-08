# Plex DupeFinder

<p align="center">
  <img src="icon.png" alt="Plex DupeFinder" width="200">
</p>

<p align="center">
  Find and remove duplicate media files in your Plex libraries, scored by Sonarr/Radarr quality profiles.
</p>

---

## Features

- Scans Plex for duplicate TV episodes and movies
- Scores files using Sonarr/Radarr quality weights, custom formats, and grab history
- Falls back to Plex resolution when no Arr score exists (1080p > 720p > 480p)
- Handles different mount points between Plex and Sonarr/Radarr (matches by filename)
- Groups duplicates by show/movie with collapsible dropdowns
- Separates same-folder dupes (safe to clean) from different-folder dupes (review carefully)
- Per-show dupe count and reclaimable space
- Bulk select, select all dupes, show-level select, bulk delete
- Sort by name, size, or number of duplicates
- Delete via Sonarr/Radarr API or Plex API fallback
- In-app settings with connection testing

## Installation

### Unraid (Recommended)

1. Go to **Apps** tab and search **TehRobot**
2. Click the **Docker Hub** button
3. Find **plex-dupefinder** and click **Install**
4. Set your port and appdata path
5. Click **Apply**

### Docker Compose

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

### Docker Run

```bash
docker run -d \
  --name plex-dupefinder \
  -p 3000:3000 \
  -v $(pwd)/config:/config \
  tehrobot/plex-dupefinder:latest
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

The app also pulls grab history from Sonarr/Radarr, so files that were downloaded but are no longer the active episode file still get scored.

The best file is marked **KEEP**. Others are marked **DUPE** with a delete button.

## Finding Your Plex Token

1. Open Plex Web, play any media, and click the **...** menu
2. Click **Get Info** > **View XML**
3. The token is in the URL: `X-Plex-Token=YOUR_TOKEN`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Web UI port |
| `CONFIG_PATH` | `/config` | Where settings are stored |

## Links

- [Docker Hub](https://hub.docker.com/r/tehrobot/plex-dupefinder)
- [GitHub](https://github.com/TehRobot-Assistant/plex-dupefinder)

## License

MIT
