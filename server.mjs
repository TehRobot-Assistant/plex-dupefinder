import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_DIR = process.env.CONFIG_PATH || join(__dirname, 'config');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// ===== Config =====

function loadConfig() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_FILE)) return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  const defaults = { plex: { url: '', token: '' }, sonarr: { url: '', apiKey: '' }, radarr: { url: '', apiKey: '' } };
  writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2));
  return defaults;
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

let config = loadConfig();

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ===== Helper: proxy fetch to external APIs =====

async function plexFetch(path) {
  const url = `${config.plex.url.replace(/\/$/, '')}${path}`;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}X-Plex-Token=${config.plex.token}`, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Plex ${res.status}: ${res.statusText}`);
  return res.json();
}

async function sonarrFetch(path) {
  const url = `${config.sonarr.url.replace(/\/$/, '')}/api/v3${path}`;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}apikey=${config.sonarr.apiKey}`);
  if (!res.ok) throw new Error(`Sonarr ${res.status}: ${res.statusText}`);
  return res.json();
}

async function radarrFetch(path) {
  const url = `${config.radarr.url.replace(/\/$/, '')}/api/v3${path}`;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}apikey=${config.radarr.apiKey}`);
  if (!res.ok) throw new Error(`Radarr ${res.status}: ${res.statusText}`);
  return res.json();
}

async function sonarrDelete(path) {
  const url = `${config.sonarr.url.replace(/\/$/, '')}/api/v3${path}`;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}apikey=${config.sonarr.apiKey}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Sonarr DELETE ${res.status}: ${res.statusText}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function radarrDelete(path) {
  const url = `${config.radarr.url.replace(/\/$/, '')}/api/v3${path}`;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}apikey=${config.radarr.apiKey}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Radarr DELETE ${res.status}: ${res.statusText}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// ===== Settings API =====

app.get('/api/settings', (req, res) => {
  // Return config but mask tokens
  res.json({
    plex: { url: config.plex.url, token: config.plex.token ? '••••••••' : '' },
    sonarr: { url: config.sonarr.url, apiKey: config.sonarr.apiKey ? '••••••••' : '' },
    radarr: { url: config.radarr.url, apiKey: config.radarr.apiKey ? '••••••••' : '' }
  });
});

app.put('/api/settings', (req, res) => {
  const { plex, sonarr, radarr } = req.body;

  if (plex) {
    if (plex.url !== undefined) config.plex.url = plex.url;
    if (plex.token !== undefined && plex.token !== '••••••••') config.plex.token = plex.token;
  }
  if (sonarr) {
    if (sonarr.url !== undefined) config.sonarr.url = sonarr.url;
    if (sonarr.apiKey !== undefined && sonarr.apiKey !== '••••••••') config.sonarr.apiKey = sonarr.apiKey;
  }
  if (radarr) {
    if (radarr.url !== undefined) config.radarr.url = radarr.url;
    if (radarr.apiKey !== undefined && radarr.apiKey !== '••••••••') config.radarr.apiKey = radarr.apiKey;
  }

  saveConfig(config);
  res.json({ success: true });
});

app.post('/api/settings/test', async (req, res) => {
  const results = { plex: false, sonarr: false, radarr: false };

  try {
    if (config.plex.url && config.plex.token) {
      await plexFetch('/');
      results.plex = true;
    }
  } catch {}

  try {
    if (config.sonarr.url && config.sonarr.apiKey) {
      await sonarrFetch('/system/status');
      results.sonarr = true;
    }
  } catch {}

  try {
    if (config.radarr.url && config.radarr.apiKey) {
      await radarrFetch('/system/status');
      results.radarr = true;
    }
  } catch {}

  res.json(results);
});

// ===== Scan: Plex Duplicates =====

app.get('/api/scan/tv', async (req, res) => {
  try {
    if (!config.plex.url || !config.plex.token) {
      return res.status(400).json({ error: 'Plex not configured' });
    }

    // Get TV libraries
    const sections = await plexFetch('/library/sections');
    const tvLibraries = sections.MediaContainer.Directory.filter(d => d.type === 'show');

    const duplicates = [];

    for (const lib of tvLibraries) {
      // Get all episodes with duplicates
      const episodes = await plexFetch(`/library/sections/${lib.key}/all?type=4&duplicate=1`);
      const items = episodes.MediaContainer.Metadata || [];

      for (const ep of items) {
        if (!ep.Media || ep.Media.length < 2) continue;

        const files = ep.Media.map(m => ({
          mediaId: m.id,
          duration: m.duration,
          bitrate: m.bitrate,
          videoCodec: m.videoCodec,
          videoResolution: m.videoResolution,
          audioCodec: m.audioCodec,
          audioChannels: m.audioChannels,
          container: m.container,
          width: m.width,
          height: m.height,
          size: m.Part?.[0]?.size || 0,
          file: m.Part?.[0]?.file || 'Unknown'
        }));

        duplicates.push({
          library: lib.title,
          show: ep.grandparentTitle,
          season: ep.parentIndex,
          episode: ep.index,
          title: ep.title,
          ratingKey: ep.ratingKey,
          files
        });
      }
    }

    res.json({ duplicates, count: duplicates.length });
  } catch (err) {
    console.error('TV scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scan/movies', async (req, res) => {
  try {
    if (!config.plex.url || !config.plex.token) {
      return res.status(400).json({ error: 'Plex not configured' });
    }

    const sections = await plexFetch('/library/sections');
    const movieLibraries = sections.MediaContainer.Directory.filter(d => d.type === 'movie');

    const duplicates = [];

    for (const lib of movieLibraries) {
      const movies = await plexFetch(`/library/sections/${lib.key}/all?type=1&duplicate=1`);
      const items = movies.MediaContainer.Metadata || [];

      for (const movie of items) {
        if (!movie.Media || movie.Media.length < 2) continue;

        const files = movie.Media.map(m => ({
          mediaId: m.id,
          duration: m.duration,
          bitrate: m.bitrate,
          videoCodec: m.videoCodec,
          videoResolution: m.videoResolution,
          audioCodec: m.audioCodec,
          audioChannels: m.audioChannels,
          container: m.container,
          width: m.width,
          height: m.height,
          size: m.Part?.[0]?.size || 0,
          file: m.Part?.[0]?.file || 'Unknown'
        }));

        duplicates.push({
          library: lib.title,
          title: movie.title,
          year: movie.year,
          ratingKey: movie.ratingKey,
          files
        });
      }
    }

    res.json({ duplicates, count: duplicates.length });
  } catch (err) {
    console.error('Movie scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Helper: extract filename from path =====
function basename(filePath) {
  return filePath?.split('/').pop() || filePath;
}

// ===== Sonarr Quality Scoring =====

app.get('/api/score/tv', async (req, res) => {
  try {
    if (!config.sonarr.url || !config.sonarr.apiKey) {
      return res.status(400).json({ error: 'Sonarr not configured' });
    }

    // Get quality definitions (has weight/title for each quality)
    const qualityDefs = await sonarrFetch('/qualitydefinition');
    const qualityMap = {};
    qualityDefs.forEach(q => {
      qualityMap[q.quality.id] = {
        name: q.quality.name,
        weight: q.weight,
        resolution: q.quality.resolution,
        source: q.quality.source
      };
    });

    // Score by filename (not full path) to handle different mount points
    const fileScores = {};

    // 1. Current episode files (active files Sonarr tracks)
    const series = await sonarrFetch('/series');
    for (const show of series) {
      const epFiles = await sonarrFetch(`/episodefile?seriesId=${show.id}`);
      for (const ef of epFiles) {
        const fileName = basename(ef.path);
        const qualityId = ef.quality?.quality?.id;
        const qualityInfo = qualityMap[qualityId] || { name: 'Unknown', weight: 0 };

        fileScores[fileName] = {
          qualityName: qualityInfo.name,
          qualityWeight: qualityInfo.weight,
          resolution: qualityInfo.resolution,
          source: qualityInfo.source,
          size: ef.size,
          episodeFileId: ef.id,
          seriesId: show.id,
          customFormats: ef.customFormats || [],
          customFormatScore: ef.customFormatScore || 0
        };
      }
    }

    // 2. History (covers files Sonarr grabbed but may no longer track)
    try {
      let page = 1;
      const pageSize = 250;
      let hasMore = true;

      while (hasMore) {
        const history = await sonarrFetch(`/history?page=${page}&pageSize=${pageSize}&sortKey=date&sortDirection=descending&eventType=1`);
        const records = history.records || [];

        for (const rec of records) {
          const fileName = rec.sourceTitle;
          if (!fileName || fileScores[fileName]) continue; // skip if already scored from episode files

          const qualityId = rec.quality?.quality?.id;
          const qualityInfo = qualityMap[qualityId] || { name: 'Unknown', weight: 0 };

          fileScores[fileName] = {
            qualityName: qualityInfo.name,
            qualityWeight: qualityInfo.weight,
            resolution: qualityInfo.resolution,
            source: qualityInfo.source,
            size: null,
            episodeFileId: null,
            seriesId: rec.seriesId,
            customFormats: rec.customFormats || [],
            customFormatScore: rec.customFormatScore || 0,
            fromHistory: true
          };
        }

        hasMore = records.length === pageSize && page < 20; // cap at 5000 records
        page++;
      }
    } catch (histErr) {
      console.warn('History fetch failed (non-fatal):', histErr.message);
    }

    res.json({ fileScores, qualityDefinitions: qualityMap });
  } catch (err) {
    console.error('Sonarr score error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Radarr Quality Scoring =====

app.get('/api/score/movies', async (req, res) => {
  try {
    if (!config.radarr.url || !config.radarr.apiKey) {
      return res.status(400).json({ error: 'Radarr not configured' });
    }

    const qualityDefs = await radarrFetch('/qualitydefinition');
    const qualityMap = {};
    qualityDefs.forEach(q => {
      qualityMap[q.quality.id] = {
        name: q.quality.name,
        weight: q.weight,
        resolution: q.quality.resolution,
        source: q.quality.source
      };
    });

    const fileScores = {};

    // 1. Current movie files
    const movies = await radarrFetch('/movie');
    for (const movie of movies) {
      if (!movie.movieFile) continue;
      const mf = movie.movieFile;
      const fileName = basename(mf.path);
      const qualityId = mf.quality?.quality?.id;
      const qualityInfo = qualityMap[qualityId] || { name: 'Unknown', weight: 0 };

      fileScores[fileName] = {
        qualityName: qualityInfo.name,
        qualityWeight: qualityInfo.weight,
        resolution: qualityInfo.resolution,
        source: qualityInfo.source,
        size: mf.size,
        movieFileId: mf.id,
        movieId: movie.id,
        customFormats: mf.customFormats || [],
        customFormatScore: mf.customFormatScore || 0
      };
    }

    // 2. History (covers files Radarr grabbed but may no longer track)
    try {
      let page = 1;
      const pageSize = 250;
      let hasMore = true;

      while (hasMore) {
        const history = await radarrFetch(`/history?page=${page}&pageSize=${pageSize}&sortKey=date&sortDirection=descending&eventType=1`);
        const records = history.records || [];

        for (const rec of records) {
          const fileName = rec.sourceTitle;
          if (!fileName || fileScores[fileName]) continue;

          const qualityId = rec.quality?.quality?.id;
          const qualityInfo = qualityMap[qualityId] || { name: 'Unknown', weight: 0 };

          fileScores[fileName] = {
            qualityName: qualityInfo.name,
            qualityWeight: qualityInfo.weight,
            resolution: qualityInfo.resolution,
            source: qualityInfo.source,
            size: null,
            movieFileId: null,
            movieId: rec.movieId,
            customFormats: rec.customFormats || [],
            customFormatScore: rec.customFormatScore || 0,
            fromHistory: true
          };
        }

        hasMore = records.length === pageSize && page < 20;
        page++;
      }
    } catch (histErr) {
      console.warn('Radarr history fetch failed (non-fatal):', histErr.message);
    }

    res.json({ fileScores, qualityDefinitions: qualityMap });
  } catch (err) {
    console.error('Radarr score error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Delete File =====

// Delete via Sonarr
app.delete('/api/file/tv/:episodeFileId', async (req, res) => {
  try {
    if (!config.sonarr.url || !config.sonarr.apiKey) {
      return res.status(400).json({ error: 'Sonarr not configured' });
    }
    await sonarrDelete(`/episodefile/${req.params.episodeFileId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete TV file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete via Radarr
app.delete('/api/file/movie/:movieFileId', async (req, res) => {
  try {
    if (!config.radarr.url || !config.radarr.apiKey) {
      return res.status(400).json({ error: 'Radarr not configured' });
    }
    await radarrDelete(`/moviefile/${req.params.movieFileId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete movie file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete via Plex (fallback when no Sonarr/Radarr file ID)
app.delete('/api/file/plex/:ratingKey/:mediaId', async (req, res) => {
  try {
    if (!config.plex.url || !config.plex.token) {
      return res.status(400).json({ error: 'Plex not configured' });
    }
    const { ratingKey, mediaId } = req.params;
    const url = `${config.plex.url.replace(/\/$/, '')}/library/metadata/${ratingKey}/media/${mediaId}`;
    const plexRes = await fetch(`${url}?X-Plex-Token=${config.plex.token}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    });
    if (!plexRes.ok) throw new Error(`Plex DELETE ${plexRes.status}: ${plexRes.statusText}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete Plex media error:', err);
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔍 Plex DupeFinder running at http://localhost:${PORT}`);
  console.log(`   Config: ${CONFIG_FILE}`);
});
