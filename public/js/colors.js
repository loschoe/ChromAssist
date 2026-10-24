/**
 * colors.js — conversion de couleurs et nommage approximatif en français.
 *
 * Principe : on ne classe PAS la couleur avec des « if » sur les valeurs RGB.
 * On convertit en CIELAB (espace pensé pour approcher la perception humaine),
 * puis on cherche la couleur nommée la plus proche avec la distance CIEDE2000
 * (ΔE00). Le résultat reste une ESTIMATION : l'éclairage, la balance des blancs
 * de la caméra et la palette limitée influencent le nom proposé.
 *
 * Aucune dépendance, aucun accès réseau.
 */

// Blanc de référence D65 (sRGB).
const WHITE = { x: 0.95047, y: 1.0, z: 1.08883 };

/** Composante sRGB 0..255 → lumière linéaire 0..1. */
function srgbToLinear(c8) {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB (0..255) → CIELAB { L, a, b } (illuminant D65). */
export function rgbToLab(r, g, b) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  const x = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = 0.0193339 * R + 0.119192 * G + 0.9503041 * B;

  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(x / WHITE.x);
  const fy = f(y / WHITE.y);
  const fz = f(z / WHITE.z);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Teinte en degrés [0, 360[ ; 0 si a' et b sont nuls (couleur sans teinte). */
function hueDeg(b, ap) {
  if (b === 0 && ap === 0) return 0;
  const h = (Math.atan2(b, ap) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

/**
 * Distance perceptuelle CIEDE2000 entre deux couleurs CIELAB.
 * Implémentation de référence (Sharma, Wu, Dalal 2005) ; vérifiée par les
 * tests avec les valeurs publiées.
 */
export function deltaE2000(lab1, lab2) {
  const rad = Math.PI / 180;
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(b1, a1p);
  const h2p = hueDeg(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);

  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;

  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);

  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;

  const l = dLp / Sl;
  const c = dCp / Sc;
  const h = dHp / Sh;
  return Math.sqrt(l * l + c * c + h * h + Rt * c * h);
}

// ---------------------------------------------------------------------------
// Palettes de couleurs nommées
// ---------------------------------------------------------------------------

/** Couleurs chromatiques (nom, hex de référence). Facile à modifier/étendre. */

/**
 * Palette étendue de couleurs nommées en français.
 * Chaque entrée contient un nom descriptif et une référence hexadécimale.
 * Les noms sont indicatifs : ils ne constituent pas une norme colorimétrique.
 */
const CHROMATIC = [
  // ROUGES
  ['Rouge', '#D72626'],
  ['Rouge vif', '#FF0000'],
  ['Rouge écarlate', '#FF2400'],
  ['Rouge vermillon', '#E34234'],
  ['Rouge coquelicot', '#F04444'],
  ['Rouge cerise', '#DE3163'],
  ['Rouge framboise', '#C72C48'],
  ['Rouge fraise', '#E63946'],
  ['Rouge tomate', '#FF6347'],
  ['Rouge brique', '#A94438'],
  ['Rouge rouille', '#B7410E'],
  ['Rouge sang', '#8A0303'],
  ['Rouge sombre', '#7A1423'],
  ['Rouge foncé', '#8B0000'],
  ['Rouge carmin', '#960018'],
  ['Rouge rubis', '#9B111E'],
  ['Rouge grenat', '#733635'],
  ['Rouge cardinal', '#C41E3A'],
  ['Rouge corail', '#F25F5C'],
  ['Rouge brunâtre', '#803333'],

  // ROSES
  ['Rose', '#F4A0BE'],
  ['Rose pâle', '#FADADD'],
  ['Rose poudré', '#E8B4B8'],
  ['Rose pastel', '#F2C6DE'],
  ['Rose bonbon', '#FF69B4'],
  ['Rose vif', '#E0287F'],
  ['Rose fuchsia', '#FF00FF'],
  ['Rose framboise', '#C74375'],
  ['Rose magenta', '#D00070'],
  ['Rose indien', '#CD5C5C'],
  ['Rose saumon', '#FA8072'],
  ['Rose thé', '#F4C2C2'],
  ['Rose ancien', '#C08081'],
  ['Rose mauve', '#C080A0'],
  ['Rose violacé', '#D291BC'],
  ['Rose corail', '#F88379'],
  ['Rose foncé', '#C71585'],

  // ORANGES ET CUIVRES
  ['Orange', '#F58214'],
  ['Orange vif', '#FF6600'],
  ['Orange pur', '#FF8000'],
  ['Orange clair', '#FFB366'],
  ['Orange pâle', '#FFD1A3'],
  ['Orange pastel', '#FFCC99'],
  ['Orange brûlé', '#CC5500'],
  ['Orange sanguine', '#E94B35'],
  ['Orange mandarine', '#F28500'],
  ['Orange citrouille', '#FF7518'],
  ['Orange corail', '#FF7F50'],
  ['Orange abricot', '#FBCEB1'],
  ['Pêche', '#FFCBA4'],
  ['Abricot', '#F4A460'],
  ['Cuivre', '#B87333'],
  ['Cuivre clair', '#CB8E62'],
  ['Terre cuite', '#C65D3B'],
  ['Cannelle', '#9B4722'],
  ['Ocre orangé', '#CC7722'],

  // BRUNS
  ['Brun', '#784623'],
  ['Brun foncé', '#4E2A1E'],
  ['Brun chocolat', '#5C3317'],
  ['Chocolat', '#7B3F00'],
  ['Brun clair', '#A5734A'],
  ['Brun moyen', '#8B5A2B'],
  ['Brun rougeâtre', '#8B4513'],
  ['Brun noisette', '#955628'],
  ['Brun caramel', '#AF6E35'],
  ['Caramel clair', '#C68E54'],
  ['Brun café', '#6F4E37'],
  ['Café au lait', '#A67B5B'],
  ['Brun tabac', '#8A6642'],
  ['Brun terre', '#806044'],
  ['Brun acajou', '#88421D'],
  ['Brun châtaigne', '#954535'],
  ['Brun sépia', '#704214'],
  ['Brun taupe', '#8B8589'],
  ['Beige brun', '#C2A383'],

  // JAUNES
  ['Jaune', '#F5D714'],
  ['Jaune vif', '#FFFF00'],
  ['Jaune citron', '#FFF44F'],
  ['Jaune pâle', '#F8EFA0'],
  ['Jaune pastel', '#FFF2B2'],
  ['Jaune crème', '#FFFDD0'],
  ['Jaune vanille', '#F3E5AB'],
  ['Jaune paille', '#E4D96F'],
  ['Jaune doré', '#FFD700'],
  ['Jaune moutarde', '#C9A227'],
  ['Moutarde foncé', '#A88905'],
  ['Jaune ocre', '#D4A017'],
  ['Ocre', '#CC7722'],
  ['Jaune miel', '#E6B422'],
  ['Jaune safran', '#F4C430'],
  ['Jaune maïs', '#FBEC5D'],
  ['Jaune soufre', '#E8E641'],
  ['Jaune chartreuse', '#DFFF00'],
  ['Jaune olive', '#B5A642'],

  // VERTS
  ['Vert', '#28A03C'],
  ['Vert vif', '#00FF00'],
  ['Vert clair', '#96DC6E'],
  ['Vert pâle', '#C1E1C1'],
  ['Vert pastel', '#B7E4C7'],
  ['Vert menthe', '#98FF98'],
  ['Vert menthe clair', '#AAF0D1'],
  ['Vert pomme', '#8DB600'],
  ['Vert citron', '#9ACD32'],
  ['Vert anis', '#B0BF1A'],
  ['Vert chartreuse', '#7FFF00'],
  ['Vert prairie', '#57A639'],
  ['Vert herbe', '#4C9A2A'],
  ['Vert feuille', '#228B22'],
  ['Vert forêt', '#228B22'],
  ['Vert sapin', '#0B6B3A'],
  ['Vert foncé', '#145A28'],
  ['Vert bouteille', '#006A4E'],
  ['Vert émeraude', '#50C878'],
  ['Vert jade', '#00A86B'],
  ['Vert malachite', '#0BDA51'],
  ['Vert olive', '#787D1E'],
  ['Olive clair', '#A3A832'],
  ['Kaki', '#8A865D'],
  ['Kaki clair', '#BDB76B'],
  ['Vert militaire', '#596B3A'],
  ['Vert sauge', '#9CAF88'],
  ['Vert céladon', '#ACE1AF'],
  ['Vert amande', '#A8C686'],
  ['Vert mousse', '#8A9A5B'],
  ['Vert lichen', '#849B62'],
  ['Vert bouteille sombre', '#004B35'],
  ['Vert pin', '#01796F'],
  ['Vert turquoise', '#00A693'],
  ['Vert d'eau', '#B0E0D3'],
  ['Vert opaline', '#A8C3BC'],
  ['Vert de gris', '#7A9E9F'],

  // TURQUOISES ET CYANS
  ['Turquoise', '#28B9AA'],
  ['Turquoise clair', '#7FEFE0'],
  ['Turquoise pâle', '#AFEEEE'],
  ['Turquoise vif', '#00E5D4'],
  ['Turquoise foncé', '#008B8B'],
  ['Bleu turquoise', '#00C5CD'],
  ['Cyan', '#00C8E6'],
  ['Cyan pur', '#00FFFF'],
  ['Cyan clair', '#80FFFF'],
  ['Cyan foncé', '#008B8B'],
  ['Aigue-marine', '#7FFFD4'],
  ['Aigue-marine foncée', '#66CDAA'],
  ['Bleu lagon', '#00BFC4'],
  ['Bleu canard', '#008C95'],
  ['Bleu pétrole', '#005F6B'],
  ['Vert pétrole', '#006B64'],
  ['Bleu paon', '#067790'],

  // BLEUS
  ['Bleu', '#1E5AE0'],
  ['Bleu pur', '#0000FF'],
  ['Bleu vif', '#0066FF'],
  ['Bleu électrique', '#0080FF'],
  ['Bleu roi', '#4169E1'],
  ['Bleu royal foncé', '#2346A0'],
  ['Bleu outremer', '#120A8F'],
  ['Bleu cobalt', '#0047AB'],
  ['Bleu saphir', '#0F52BA'],
  ['Bleu marine', '#000080'],
  ['Bleu nuit', '#141E5A'],
  ['Bleu très foncé', '#000033'],
  ['Bleu ardoise', '#6A7B8B'],
  ['Bleu acier', '#4682B4'],
  ['Bleu gris', '#6699CC'],
  ['Bleu denim', '#1560BD'],
  ['Bleu jean', '#5D8AA8'],
  ['Bleu ciel', '#87CEEB'],
  ['Bleu azur', '#007FFF'],
  ['Bleu clair', '#82BEF0'],
  ['Bleu pâle', '#ADD8E6'],
  ['Bleu pastel', '#AEC6CF'],
  ['Bleu glacier', '#C6E6F5'],
  ['Bleu givré', '#D7F0FA'],
  ['Bleu poudre', '#B0E0E6'],
  ['Bleu bébé', '#89CFF0'],
  ['Bleu pervenche', '#CCCCFF'],
  ['Bleu lavande', '#B4C7E7'],
  ['Bleu canard sombre', '#004F5D'],
  ['Bleu de Prusse', '#003153'],
  ['Indigo', '#4B0082'],
  ['Bleu indigo', '#3F00FF'],
  ['Bleu pétrole clair', '#317873'],
  ['Bleu minéral', '#3B7A9E'],

  // VIOLETS ET POURPRES
  ['Violet', '#8232AA'],
  ['Violet vif', '#8F00FF'],
  ['Violet foncé', '#4B0082'],
  ['Violet clair', '#B57EDC'],
  ['Violet pastel', '#DCD0FF'],
  ['Violet lavande', '#967BB6'],
  ['Lavande', '#B9A5E1'],
  ['Lavande claire', '#E6E6FA'],
  ['Lilas', '#C8A2C8'],
  ['Lilas clair', '#E8CFF0'],
  ['Mauve', '#E0B0FF'],
  ['Mauve foncé', '#915F6D'],
  ['Pourpre', '#781E64'],
  ['Pourpre vif', '#800080'],
  ['Pourpre foncé', '#4A044E'],
  ['Prune', '#673147'],
  ['Prune foncé', '#4E2A3A'],
  ['Aubergine', '#614051'],
  ['Raisin', '#6F2DA8'],
  ['Améthyste', '#9966CC'],
  ['Orchidée', '#DA70D6'],
  ['Orchidée foncée', '#9932CC'],
  ['Magenta', '#FF00FF'],
  ['Magenta foncé', '#8B008B'],
  ['Fuchsia', '#FF00FF'],
  ['Grenat violacé', '#702963'],
  ['Lie-de-vin', '#722F37'],

  // BEIGES ET TEINTES NEUTRES CHROMATIQUES
  ['Beige', '#E1CDA5'],
  ['Beige clair', '#F5F5DC'],
  ['Beige sable', '#DCC7AA'],
  ['Beige rosé', '#D8B4A0'],
  ['Beige doré', '#D8C29D'],
  ['Écru', '#CDBA96'],
  ['Ivoire', '#FFFFF0'],
  ['Champagne', '#F7E7CE'],
  ['Lin', '#FAF0E6'],
  ['Crème', '#FFFDD0'],
  ['Taupe', '#B38B6D'],
  ['Grège', '#B9A58D'],
  ['Mastic', '#BEB5A7'],
  ['Pierre', '#C8C2B8'],
  ['Gris chaud', '#A89F91'],
  ['Gris froid bleuté', '#A7B5C5'],
  ['Gris verdâtre', '#A5AC9B'],
  ['Gris rosé', '#C4A4A4'],
  ['Gris violacé', '#A99AB5'],
  ['Brun rosé', '#A4777E']
];


/** Niveaux de gris : définis directement par leur luminosité L* (a = b = 0). */
const ACHROMATIC = [
  ['Noir', 4],
  ['Gris foncé', 30],
  ['Gris', 55],
  ['Gris clair', 78],
  ['Blanc', 97],
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const CHROMATIC_ENTRIES = CHROMATIC.map(([name, hex]) => ({
  name,
  lab: rgbToLab(...hexToRgb(hex)),
}));
const ACHROMATIC_ENTRIES = ACHROMATIC.map(([name, L]) => ({ name, lab: { L, a: 0, b: 0 } }));

/**
 * Seuil de chroma C* = √(a²+b²) sous lequel on considère la couleur comme
 * « sans teinte » (noir/gris/blanc). Un peu plus tolérant pour les blancs,
 * qui virent facilement au jaune/bleu selon l'éclairage.
 */
function achromaticThreshold(L) {
  return L > 85 ? 10 : 8;
}

/** Trie la palette par distance croissante à la couleur mesurée. */
function rank(entries, lab) {
  return entries
    .map((e) => ({ name: e.name, deltaE: deltaE2000(lab, e.lab) }))
    .sort((p, q) => p.deltaE - q.deltaE);
}

/**
 * Estime le nom français d'une couleur.
 * @returns {{ name: string, alternatives: string[], deltaE: number, achromatic: boolean }}
 *   `alternatives` : jusqu'à deux autres noms proches (ΔE00 raisonnable).
 */
export function nameColor(r, g, b) {
  const lab = rgbToLab(r, g, b);
  const chroma = Math.hypot(lab.a, lab.b);
  const achromatic = chroma < achromaticThreshold(lab.L);

  const ranked = rank(achromatic ? ACHROMATIC_ENTRIES : CHROMATIC_ENTRIES, lab);
  const best = ranked[0];
  const alternatives = ranked
    .slice(1)
    .filter((e) => e.deltaE - best.deltaE < 12) // on ne propose que des noms vraiment voisins
    .slice(0, 2)
    .map((e) => e.name);

  return { name: best.name, alternatives, deltaE: best.deltaE, achromatic };
}

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();

/** (220, 40, 35) → "#DC2823" */
export function toHex(r, g, b) {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/** (220, 40, 35) → "220, 40, 35" */
export function formatRgb(r, g, b) {
  return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
}
