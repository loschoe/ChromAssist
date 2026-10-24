/**
 * sampling.js — prélèvement robuste de la couleur autour d'un point.
 *
 * On ne lit jamais un pixel isolé : un pixel peut être du bruit capteur, un
 * reflet ou un artefact de compression. On lit une petite fenêtre carrée
 * (≈ 9×9 pixels) et on prend la MÉDIANE de chaque canal R, G, B.
 * La médiane ignore les valeurs extrêmes isolées, contrairement à la moyenne.
 *
 * Ce module ne touche pas au DOM : il est testable sous Node.
 */

/**
 * Taille (impaire) de la fenêtre d'échantillonnage en pixels de la vidéo source.
 * Elle grandit avec la résolution pour couvrir une zone comparable à l'écran :
 * 640 px → 5, 1280 px → 9, 1920 px → 13 ; bornée entre 5 et 15.
 */
export function sampleSize(videoW) {
  let n = Math.round(videoW / 160);
  n = Math.min(15, Math.max(5, n));
  return n % 2 === 0 ? n + 1 : n;
}

/**
 * Fenêtre carrée de `size` pixels centrée sur (cx, cy), décalée si besoin pour
 * rester entièrement dans l'image (pipette près d'un bord ou d'un coin).
 * @returns {{x:number, y:number, size:number}} coin haut-gauche entier + côté
 */
export function windowRect(cx, cy, size, videoW, videoH) {
  const s = Math.max(1, Math.min(size, videoW, videoH));
  const half = Math.floor(s / 2);
  const x = Math.min(Math.max(Math.floor(cx) - half, 0), videoW - s);
  const y = Math.min(Math.max(Math.floor(cy) - half, 0), videoH - s);
  return { x, y, size: s };
}

function median(values) {
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  return values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
}

/**
 * Médiane par canal d'un tableau RGBA (ex. `ImageData.data`). Le canal alpha
 * est ignoré.
 * @returns {[number, number, number]} [R, G, B] entiers 0..255
 */
export function medianRGB(rgba) {
  const n = rgba.length >> 2;
  if (n === 0) throw new Error('Aucun pixel à analyser');
  const r = new Array(n);
  const g = new Array(n);
  const b = new Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = rgba[i * 4];
    g[i] = rgba[i * 4 + 1];
    b[i] = rgba[i * 4 + 2];
  }
  return [median(r), median(g), median(b)];
}
