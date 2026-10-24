/**
 * Audit STATIQUE de confidentialité : on vérifie que le code de l'application
 * ne contient aucun appel réseau, aucune ressource externe et aucune
 * persistance d'image. Ce n'est pas un test réseau en conditions réelles
 * (voir la checklist manuelle du README : onglet Réseau des outils de
 * développement), mais il détecte les régressions évidentes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

const files = listFiles(PUBLIC);

/** Retire les commentaires pour ne pas déclencher sur une phrase d'explication. */
function stripComments(src, ext) {
  if (ext === '.js') return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  if (ext === '.css') return src.replace(/\/\*[\s\S]*?\*\//g, '');
  if (ext === '.html') return src.replace(/<!--[\s\S]*?-->/g, '');
  return src;
}

test('aucune API réseau ni stockage dans le JavaScript', () => {
  const forbidden = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /EventSource/,
    /sendBeacon/,
    /importScripts/,
    /localStorage|sessionStorage|indexedDB/, // aucune persistance pour le MVP
    /toDataURL|toBlob|captureStream|MediaRecorder|ImageCapture|takePhoto/, // aucune capture / enregistrement
  ];
  for (const f of files.filter((f) => f.endsWith('.js'))) {
    const code = stripComments(fs.readFileSync(f, 'utf8'), '.js');
    for (const re of forbidden) assert.ok(!re.test(code), `${path.relative(PUBLIC, f)} contient ${re}`);
  }
});

test('aucune URL externe dans le HTML, le CSS et le JS', () => {
  for (const f of files) {
    const ext = path.extname(f);
    const code = stripComments(fs.readFileSync(f, 'utf8'), ext);
    const urls = code.match(/https?:\/\/[^\s"')]+/g) || [];
    assert.deepEqual(urls, [], `${path.relative(PUBLIC, f)} référence ${urls.join(', ')}`);
  }
});

test('la page impose une CSP sans réseau et ne démarre pas la caméra seule', () => {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /Traitement local : aucune image n’est envoyée\./);
  assert.match(html, /<video[^>]*\bautoplay\b[^>]*\bplaysinline\b[^>]*\bmuted\b/);

  // getUserMedia ne doit être appelé que depuis startCamera (déclenchée par le bouton).
  const app = stripComments(fs.readFileSync(path.join(PUBLIC, 'js', 'app.js'), 'utf8'), '.js');
  assert.equal((app.match(/getUserMedia\s*\(/g) || []).length, 1);
  assert.equal((app.match(/\.addEventListener\(\s*'click'/g) || []).length, 1, 'un seul gestionnaire de clic');
  assert.match(app, /getTracks\(\)\.forEach/);
  assert.match(app, /track\.stop\(\)/);
  assert.match(app, /cancelAnimationFrame/);
});
