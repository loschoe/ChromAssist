/**
 * Tests des modules de calcul (sans navigateur) :  node --test tests/
 *
 * Ils couvrent : conversion Lab, distance ΔE00, nommage des couleurs,
 * conversion de coordonnées avec object-fit: cover, échantillonnage médian.
 * Ils NE testent PAS la caméra ni l'interface réelles (voir README, checklist).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { rgbToLab, deltaE2000, nameColor, toHex, formatRgb } from '../public/js/colors.js';
import { coverMapping, boxToVideo, videoToBox } from '../public/js/geometry.js';
import { sampleSize, windowRect, medianRGB } from '../public/js/sampling.js';

const near = (actual, expected, eps, msg) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${msg ?? ''} attendu ${expected} ± ${eps}, obtenu ${actual}`);

// --- Couleurs ---------------------------------------------------------------

test('rgbToLab : blanc, noir et rouge pur', () => {
  const w = rgbToLab(255, 255, 255);
  near(w.L, 100, 0.01, 'L blanc');
  near(w.a, 0, 0.01);
  near(w.b, 0, 0.01);
  const k = rgbToLab(0, 0, 0);
  near(k.L, 0, 0.01, 'L noir');
  const r = rgbToLab(255, 0, 0); // valeurs de référence sRGB/D65
  near(r.L, 53.24, 0.05);
  near(r.a, 80.09, 0.1);
  near(r.b, 67.2, 0.1);
});

test('deltaE2000 : valeurs publiées (Sharma, Wu, Dalal 2005)', () => {
  const cases = [
    [{ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 }, 2.0425],
    [{ L: 50, a: 3.1571, b: -77.2803 }, { L: 50, a: 0, b: -82.7485 }, 2.8615],
    [{ L: 50, a: 2.5, b: 0 }, { L: 50, a: 0, b: -2.5 }, 4.3065],
    [{ L: 50, a: 2.5, b: 0 }, { L: 73, a: 25, b: -18 }, 27.1492],
    [{ L: 60.2574, a: -34.0099, b: 36.2677 }, { L: 60.4626, a: -34.1751, b: 39.4387 }, 1.2644],
  ];
  for (const [p, q, expected] of cases) {
    near(deltaE2000(p, q), expected, 0.001);
    near(deltaE2000(q, p), expected, 0.001, 'symétrie');
  }
  assert.equal(deltaE2000({ L: 40, a: 10, b: 10 }, { L: 40, a: 10, b: 10 }), 0);
});

test('nameColor : exemples connus', () => {
  const expected = [
    [[220, 40, 35], 'Rouge'], // exemple du cahier des charges
    [[255, 0, 0], 'Rouge'],
    [[0, 0, 0], 'Noir'],
    [[255, 255, 255], 'Blanc'],
    [[128, 128, 128], 'Gris'],
    [[210, 210, 210], 'Gris clair'],
    [[60, 60, 60], 'Gris foncé'],
    [[30, 90, 220], 'Bleu'],
    [[20, 25, 80], 'Bleu nuit'],
    [[40, 160, 60], 'Vert'],
    [[245, 215, 20], 'Jaune'],
    [[245, 130, 20], 'Orange'],
    [[120, 70, 35], 'Brun'],
    [[225, 205, 165], 'Beige'],
    [[245, 160, 190], 'Rose'],
    [[130, 50, 170], 'Violet'],
    [[0, 200, 230], 'Cyan'],
    [[235, 232, 225], 'Blanc'], // papier blanc légèrement chaud
  ];
  for (const [rgb, name] of expected) {
    assert.equal(nameColor(...rgb).name, name, `rgb(${rgb}) devrait être « ${name} »`);
  }
});

test('nameColor : achromatique vs chromatique et alternatives', () => {
  assert.equal(nameColor(120, 120, 122).achromatic, true);
  assert.equal(nameColor(220, 40, 35).achromatic, false);
  const res = nameColor(180, 40, 40);
  assert.ok(Array.isArray(res.alternatives) && res.alternatives.length <= 2);
  assert.ok(!res.alternatives.includes(res.name), 'une alternative ne répète pas le nom principal');
});

test('toHex / formatRgb : formats du cahier des charges', () => {
  assert.equal(toHex(220, 40, 35), '#DC2823');
  assert.equal(formatRgb(220, 40, 35), '220, 40, 35');
  assert.equal(toHex(0, 5, 255), '#0005FF');
});

// --- Géométrie : object-fit: cover ---------------------------------------------

test('coverMapping : vidéo 16:9 dans une boîte portrait (recadrage latéral)', () => {
  const m = coverMapping(1280, 720, 400, 800);
  near(m.scale, 800 / 720, 1e-9);
  near(m.offsetX, (400 - 1280 * (800 / 720)) / 2, 1e-9);
  near(m.offsetY, 0, 1e-9);

  // Centre de la boîte → centre de la vidéo.
  const c = boxToVideo(200, 400, m, 1280, 720);
  near(c.x, 640, 1e-6);
  near(c.y, 360, 1e-6);

  // Bord gauche de la boîte : on ne voit PAS le bord gauche de la vidéo (rogné).
  const left = boxToVideo(0, 400, m, 1280, 720);
  near(left.x, -m.offsetX / m.scale, 1e-6);
  assert.ok(left.x > 400, 'le bord gauche affiché est loin du bord gauche de la source');

  // Une règle de trois naïve donnerait x = 0 : on vérifie qu'on s'en écarte bien.
  assert.notEqual(Math.round(left.x), 0);
});

test('coverMapping : vidéo 4:3 dans une boîte paysage large (recadrage vertical)', () => {
  const m = coverMapping(640, 480, 800, 300);
  near(m.scale, 800 / 640, 1e-9);
  assert.ok(m.offsetY < 0 && Math.abs(m.offsetX) < 1e-9);
  const top = boxToVideo(400, 0, m, 640, 480);
  near(top.y, -m.offsetY / m.scale, 1e-6);
  near(top.x, 320, 1e-6);
});

test('coverMapping : même ratio → simple règle de trois', () => {
  const m = coverMapping(1280, 720, 640, 360);
  near(m.offsetX, 0, 1e-9);
  near(m.offsetY, 0, 1e-9);
  const p = boxToVideo(320, 180, m, 1280, 720);
  near(p.x, 640, 1e-6);
  near(p.y, 360, 1e-6);
});

test('boxToVideo / videoToBox : aller-retour et bornage aux bords', () => {
  const m = coverMapping(1920, 1080, 390, 700);
  for (const [x, y] of [[10, 20], [195, 350], [380, 690]]) {
    const v = boxToVideo(x, y, m, 1920, 1080);
    const back = videoToBox(v.x, v.y, m);
    near(back.x, x, 1e-6);
    near(back.y, y, 1e-6);
  }
  // Coins de la boîte : toujours dans l'image source.
  for (const [x, y] of [[0, 0], [390, 0], [0, 700], [390, 700], [-50, 900]]) {
    const v = boxToVideo(x, y, m, 1920, 1080);
    assert.ok(v.x >= 0 && v.x <= 1919 && v.y >= 0 && v.y <= 1079);
  }
});

test('coverMapping : dimensions nulles → null (vidéo pas prête)', () => {
  assert.equal(coverMapping(0, 0, 400, 800), null);
  assert.equal(coverMapping(1280, 720, 0, 0), null);
});

// --- Échantillonnage ------------------------------------------------------------

test('sampleSize : impair et borné', () => {
  for (const w of [160, 320, 640, 1280, 1920, 3840]) {
    const n = sampleSize(w);
    assert.ok(n % 2 === 1 && n >= 5 && n <= 15, `taille ${n} pour ${w}`);
  }
  assert.equal(sampleSize(1280), 9);
});

test('windowRect : centrée au milieu, décalée près des bords et des coins', () => {
  assert.deepEqual(windowRect(640, 360, 9, 1280, 720), { x: 636, y: 356, size: 9 });
  assert.deepEqual(windowRect(0, 0, 9, 1280, 720), { x: 0, y: 0, size: 9 });
  assert.deepEqual(windowRect(1279, 719, 9, 1280, 720), { x: 1271, y: 711, size: 9 });
  // Image minuscule : la fenêtre est réduite à l'image.
  assert.deepEqual(windowRect(1, 1, 9, 3, 3), { x: 0, y: 0, size: 3 });
});

test('medianRGB : couleur uniforme, valeurs aberrantes ignorées, alpha ignoré', () => {
  const px = (r, g, b, a = 255) => [r, g, b, a];

  const uniform = new Uint8ClampedArray(Array.from({ length: 49 }, () => px(220, 40, 35)).flat());
  assert.deepEqual(medianRGB(uniform), [220, 40, 35]);

  // 3 pixels « reflet » blancs parmi 25 pixels bleus : la médiane les ignore.
  const noisy = [];
  for (let i = 0; i < 25; i++) noisy.push(i < 3 ? px(255, 255, 255) : px(30, 90, 220));
  assert.deepEqual(medianRGB(Uint8ClampedArray.from(noisy.flat())), [30, 90, 220]);

  assert.deepEqual(medianRGB(Uint8ClampedArray.from([...px(10, 20, 30, 0), ...px(30, 40, 50, 0)])), [20, 30, 40]);
  assert.throws(() => medianRGB(new Uint8ClampedArray(0)));
});
