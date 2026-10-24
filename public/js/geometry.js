/**
 * geometry.js — conversion entre coordonnées écran et pixels de la vidéo source.
 *
 * POURQUOI C'EST NÉCESSAIRE
 * -------------------------
 * La vidéo est affichée avec `object-fit: cover` : elle est agrandie jusqu'à
 * remplir entièrement la boîte d'affichage, puis RECADRÉE (centrée) là où elle
 * dépasse. Exemple : une vidéo 1280×720 (16:9) dans une boîte portrait 400×800
 * est agrandie à 1422×800 et on ne voit que sa partie centrale.
 * Un point à l'écran ne correspond donc PAS au même pixel de la vidéo source
 * que si on faisait une simple règle de trois sur la largeur et la hauteur.
 *
 * FORMULES (object-position par défaut = 50 % 50 %, donc centré)
 *   scale   = max(boîteL / vidéoL, boîteH / vidéoH)
 *   offsetX = (boîteL − vidéoL × scale) / 2      (≤ 0 : partie rognée à gauche)
 *   offsetY = (boîteH − vidéoH × scale) / 2
 *   vidéoX  = (écranX − offsetX) / scale
 *   vidéoY  = (écranY − offsetY) / scale
 *
 * Ce module ne touche pas au DOM : il est testable sous Node.
 */

/**
 * Calcule l'échelle et le décalage appliqués par `object-fit: cover`.
 * @returns {{scale:number, offsetX:number, offsetY:number} | null}
 *          null si une dimension est nulle (vidéo pas encore prête).
 */
export function coverMapping(videoW, videoH, boxW, boxH) {
  if (!(videoW > 0 && videoH > 0 && boxW > 0 && boxH > 0)) return null;
  const scale = Math.max(boxW / videoW, boxH / videoH);
  return {
    scale,
    offsetX: (boxW - videoW * scale) / 2,
    offsetY: (boxH - videoH * scale) / 2,
  };
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Point de la boîte d'affichage (px CSS, origine en haut à gauche de la boîte)
 * → pixel de la vidéo source (flottant, borné à [0, largeur−1] × [0, hauteur−1]).
 */
export function boxToVideo(x, y, mapping, videoW, videoH) {
  return {
    x: clamp((x - mapping.offsetX) / mapping.scale, 0, videoW - 1),
    y: clamp((y - mapping.offsetY) / mapping.scale, 0, videoH - 1),
  };
}

/** Opération inverse : pixel vidéo source → point de la boîte d'affichage. */
export function videoToBox(vx, vy, mapping) {
  return {
    x: vx * mapping.scale + mapping.offsetX,
    y: vy * mapping.scale + mapping.offsetY,
  };
}
