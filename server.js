const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8085;
const ROOT_DIR = __dirname;
const PUBLIC_IMAGES_DIR = path.join(ROOT_DIR, 'public', 'assets', 'images');
const PUBLIC_AUDIO_DIR = path.join(ROOT_DIR, 'public', 'assets', 'audio');
const MANIFEST_PATH = path.join(ROOT_DIR, 'public', 'assets', 'manifest.json');

// Ensure directories exist
if (!fs.existsSync(PUBLIC_IMAGES_DIR)) fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_AUDIO_DIR)) fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });

// Sync manifest file on disk from actual files in public/assets/
function syncManifest() {
  let photos = [];
  let songs = [];

  if (fs.existsSync(PUBLIC_IMAGES_DIR)) {
    const imageFiles = fs.readdirSync(PUBLIC_IMAGES_DIR);
    photos = imageFiles
      .filter(f => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f))
      .map(f => {
        const stats = fs.statSync(path.join(PUBLIC_IMAGES_DIR, f));
        return {
          filename: f,
          path: `public/assets/images/${f}`,
          title: f.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
          mtime: stats.mtimeMs
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  if (fs.existsSync(PUBLIC_AUDIO_DIR)) {
    const audioFiles = fs.readdirSync(PUBLIC_AUDIO_DIR);
    songs = audioFiles
      .filter(f => /\.(mp3|wav|ogg|m4a|aac)$/i.test(f))
      .map(f => {
        const stats = fs.statSync(path.join(PUBLIC_AUDIO_DIR, f));
        return {
          filename: f,
          path: `public/assets/audio/${f}`,
          title: f.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
          mtime: stats.mtimeMs
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  const manifest = { photos, songs };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  return manifest;
}

// MIME types mapping
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- API Endpoints ---

  // GET /api/manifest
  if (req.method === 'GET' && pathname === '/api/manifest') {
    const manifest = syncManifest();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manifest));
    return;
  }

  // POST /api/upload-photo
  if (req.method === 'POST' && pathname === '/api/upload-photo') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { filename, base64Data } = data;
        if (!filename || !base64Data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing filename or base64Data' }));
          return;
        }

        // Clean filename & format path
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetName = `${Date.now()}_${safeName}`;
        const targetPath = path.join(PUBLIC_IMAGES_DIR, targetName);

        // Strip Data URL prefix if present
        const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');

        fs.writeFileSync(targetPath, buffer);
        const updatedManifest = syncManifest();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          path: `public/assets/images/${targetName}`,
          manifest: updatedManifest
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/upload-song
  if (req.method === 'POST' && pathname === '/api/upload-song') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { filename, base64Data } = data;
        if (!filename || !base64Data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing filename or base64Data' }));
          return;
        }

        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetName = `${Date.now()}_${safeName}`;
        const targetPath = path.join(PUBLIC_AUDIO_DIR, targetName);

        const base64Content = base64Data.replace(/^data:audio\/\w+;base64,/, '').replace(/^data:application\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');

        fs.writeFileSync(targetPath, buffer);
        const updatedManifest = syncManifest();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          path: `public/assets/audio/${targetName}`,
          manifest: updatedManifest
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/delete-file
  if (req.method === 'POST' && pathname === '/api/delete-file') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { relativePath } = data;
        if (relativePath) {
          const fullPath = path.join(ROOT_DIR, relativePath);
          if (fs.existsSync(fullPath) && (fullPath.startsWith(PUBLIC_IMAGES_DIR) || fullPath.startsWith(PUBLIC_AUDIO_DIR))) {
            fs.unlinkSync(fullPath);
          }
        }
        const updatedManifest = syncManifest();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, manifest: updatedManifest }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- Static File Serving ---
  let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Security check
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 File Not Found</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  syncManifest();
  console.log(`Server running at http://localhost:${PORT}`);
});
