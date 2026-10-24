#!/usr/bin/env node
/**
 * server.mjs — petit serveur de fichiers statiques pour ChromAssist.
 * Aucune dépendance : uniquement des modules intégrés à Node.js (≥ 18).
 *
 * Usage :
 *   node server.mjs                                  → http://localhost:8080 (cet appareil seulement)
 *   node server.mjs --port 3000
 *   node server.mjs --host 0.0.0.0 --cert c.pem --key k.pem   → HTTPS sur le réseau local
 *
 * Il ne sert QUE le dossier public/ et n'envoie rien ailleurs.
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

// --- Arguments ---------------------------------------------------------------

function parseArgs(argv) {
  const opts = { host: '127.0.0.1', port: 8080, cert: null, key: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--host') opts.host = next();
    else if (a === '--port') opts.port = Number(next());
    else if (a === '--cert') opts.cert = next();
    else if (a === '--key') opts.key = next();
    else if (a === '--help' || a === '-h') {
      console.log('Options : --host <adresse>  --port <n>  --cert <fichier.pem> --key <fichier.pem>');
      process.exit(0);
    } else {
      console.error(`Option inconnue : ${a}`);
      process.exit(1);
    }
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    console.error('Port invalide.');
    process.exit(1);
  }
  if (Boolean(opts.cert) !== Boolean(opts.key)) {
    console.error('--cert et --key doivent être fournis ensemble.');
    process.exit(1);
  }
  return opts;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// En-têtes de sécurité : la caméra n'est autorisée que pour cette page, aucun autre capteur.
const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "media-src 'self' blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

function send(res, status, body, extra = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Méthode non autorisée', { Allow: 'GET, HEAD' });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    return send(res, 400, 'Requête invalide');
  }
  if (pathname.includes('\0')) return send(res, 400, 'Requête invalide');
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Anti « path traversal » : le chemin résolu doit rester DANS public/.
  const file = path.resolve(ROOT, '.' + pathname);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Accès interdit');

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Introuvable');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// --- Démarrage ---------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
const useTls = Boolean(opts.cert);

let server;
try {
  server = useTls
    ? https.createServer({ cert: fs.readFileSync(opts.cert), key: fs.readFileSync(opts.key) }, handler)
    : http.createServer(handler);
} catch (e) {
  console.error(`Impossible de lire le certificat : ${e.message}`);
  process.exit(1);
}

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Le port ${opts.port} est déjà utilisé (essayez --port 8081).` : e.message);
  process.exit(1);
});

server.listen(opts.port, opts.host, () => {
  const scheme = useTls ? 'https' : 'http';
  console.log('ChromAssist — serveur local démarré (Ctrl+C pour arrêter)');
  console.log(`  Sur cet appareil : ${scheme}://localhost:${opts.port}`);

  const exposed = opts.host === '0.0.0.0' || opts.host === '::';
  if (exposed) {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const ni of list || []) {
        if (ni.family === 'IPv4' && !ni.internal) console.log(`  Sur le réseau local : ${scheme}://${ni.address}:${opts.port}`);
      }
    }
    if (!useTls) {
      console.log('  ⚠ Sans HTTPS, la plupart des navigateurs REFUSERONT la caméra via une adresse IP.');
      console.log('    Voir la section « HTTPS et caméra » du README.');
    }
  }
});
