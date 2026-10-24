/**
 * app.js — ChromAssist : caméra en direct + pipette + lecture de couleur.
 *
 * Tout se passe dans le navigateur. Aucune requête réseau, aucune image
 * conservée : on dessine uniquement une minuscule fenêtre (≈ 9×9 px) de la
 * vidéo dans un canvas HORS ÉCRAN, on en lit les pixels, puis on les oublie.
 *
 * ÉTATS (state.phase)
 *   idle      caméra éteinte (état initial et final)
 *   starting  demande d'autorisation / démarrage en cours
 *   active    flux affiché, boucle d'analyse en marche
 *
 * Le bouton principal n'a qu'UN gestionnaire (toggleCamera) qui décide quoi
 * faire selon la phase : pas de gestionnaires contradictoires.
 */

import { coverMapping, boxToVideo } from './geometry.js';
import { sampleSize, windowRect, medianRGB } from './sampling.js';
import { nameColor, toHex, formatRgb } from './colors.js';

// --- Réglages -------------------------------------------------------------

const ANALYSIS_INTERVAL_MS = 100; // ≈ 10 analyses/s : fluide pour l'œil, léger pour le téléphone
const KEY_STEP = 0.02;            // déplacement clavier : 2 % de la zone (10 % avec Maj)

// --- Éléments du DOM ------------------------------------------------------

const $ = (id) => document.getElementById(id);
const els = {
  app: $('app'),
  status: $('status'),
  stage: $('stage'),
  video: $('video'),
  reticle: $('reticle'),
  error: $('error'),
  swatch: $('swatch'),
  name: $('colorName'),
  alts: $('colorAlts'),
  hex: $('hex'),
  rgb: $('rgb'),
  toggle: $('toggle'),
  toggleIcon: $('toggleIcon'),
  toggleLabel: $('toggleLabel'),
};

// Canvas HORS ÉCRAN (jamais ajouté à la page) : sert uniquement à lire des pixels.
// willReadFrequently : le navigateur garde le canvas côté CPU, plus rapide pour getImageData.
const probe = document.createElement('canvas');
const probeCtx = probe.getContext('2d', { willReadFrequently: true });

// --- État -----------------------------------------------------------------

const state = {
  phase: 'idle',
  stream: null,
  token: 0,          // incrémenté à chaque start/stop : invalide les démarrages devenus obsolètes
  rafId: 0,
  lastTick: 0,
  loopRunning: false,
  fx: 0.5,           // position de la pipette en FRACTION de la zone (0..1) :
  fy: 0.5,           // reste correcte quand la zone change de taille (rotation)
  lastHex: '',
  videoReady: false,
  canvasErrorShown: false,
};

// --- Messages -------------------------------------------------------------

const MSG = {
  insecure:
    'La caméra n’est autorisée que sur une page sécurisée (HTTPS ou localhost). ' +
    'Ouvrez le site depuis « localhost » ou en HTTPS (voir le README).',
  noApi: 'Ce navigateur ne propose pas l’accès à la caméra (API getUserMedia indisponible).',
  denied:
    'Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages du navigateur, puis réessayez.',
  notFound: 'Aucune caméra détectée sur cet appareil.',
  busy: 'La caméra est occupée ou inaccessible (utilisée par une autre application ?). Fermez-la puis réessayez.',
  interrupted: 'Le flux de la caméra a été interrompu. La caméra est arrêtée.',
  background: 'Caméra arrêtée : la page a quitté le premier plan.',
  canvas: 'Impossible de lire les pixels de l’image. La mesure est suspendue tant que le problème persiste.',
  play: 'La vidéo n’a pas pu démarrer. Réessayez.',
};

function describeError(err) {
  switch (err && err.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return MSG.denied;
    case 'SecurityError':
      return MSG.insecure;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return MSG.notFound;
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return MSG.busy;
    case 'PlayError': // video.play() a échoué alors que la caméra était accordée
      return MSG.play;
    default:
      return `Impossible de démarrer la caméra (${(err && err.name) || 'erreur inconnue'}).`;
  }
}

// --- Affichage : phases, erreurs, résultat ---------------------------------

function setPhase(phase) {
  state.phase = phase;
  els.app.dataset.phase = phase;
  els.reticle.hidden = phase !== 'active';

  const ui = {
    idle: ['▶', 'Activer la caméra', 'Caméra arrêtée'],
    starting: ['✕', 'Annuler', 'Démarrage… autorisez la caméra si le navigateur le demande'],
    active: ['■', 'Arrêter la caméra', 'Caméra active — déplacez la pipette'],
  }[phase];
  // Le libellé du bouton change avec l'état (« Activer » / « Arrêter ») : le texte suffit
  // aux lecteurs d'écran, l'icône est décorative (aria-hidden dans le HTML).
  [els.toggleIcon.textContent, els.toggleLabel.textContent, els.status.textContent] = ui;
}

function showError(text) {
  els.error.textContent = text;
  els.error.hidden = false;
}

function clearError() {
  els.error.hidden = true;
  els.error.textContent = '';
}

function resetReadout() {
  state.lastHex = '';
  els.swatch.style.backgroundColor = '';
  els.swatch.style.backgroundImage = '';
  els.name.textContent = '—';
  els.alts.textContent = '';
  els.hex.textContent = '—';
  els.rgb.textContent = '—';
}

function updateReadout(r, g, b) {
  const hex = toHex(r, g, b);
  if (hex === state.lastHex) return; // rien à redessiner
  state.lastHex = hex;

  const res = nameColor(r, g, b);
  els.swatch.style.backgroundImage = 'none';
  els.swatch.style.backgroundColor = hex;
  els.name.textContent = res.name;
  els.alts.textContent = res.alternatives.length ? `Proche de : ${res.alternatives.join(', ')}` : '';
  els.hex.textContent = hex;
  els.rgb.textContent = formatRgb(r, g, b);
}

// --- Caméra ---------------------------------------------------------------

/** Arrête toutes les pistes d'un flux (idempotent). Libère réellement la caméra. */
function releaseStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    track.removeEventListener('ended', onTrackEnded);
    track.stop();
  });
}

async function startCamera() {
  clearError();

  // Vérifications préalables : messages explicites plutôt qu'une erreur obscure.
  if (!window.isSecureContext) return showError(MSG.insecure);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return showError(MSG.noApi);

  const token = ++state.token;
  setPhase('starting');

  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false, // on ne demande QUE la vidéo
      video: {
        facingMode: { ideal: 'environment' }, // caméra arrière de préférence
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    // L'utilisateur a annulé (ou arrêté) pendant l'attente : on rend la caméra aussitôt.
    if (token !== state.token) {
      releaseStream(stream);
      return;
    }

    state.stream = stream;
    stream.getVideoTracks().forEach((t) => t.addEventListener('ended', onTrackEnded));

    els.video.srcObject = stream;
    try {
      await els.video.play();
    } catch (playErr) {
      if (token !== state.token) return; // annulé pendant play() : stopCamera a déjà tout nettoyé
      throw Object.assign(new Error('play'), { name: 'PlayError', cause: playErr });
    }
    if (token !== state.token) return;

    state.videoReady = false;
    setPhase('active');
    startLoop();
  } catch (err) {
    if (token !== state.token) {
      releaseStream(stream); // démarrage obsolète : on s'assure que la caméra est rendue
      return;
    }
    // Erreur réelle : on libère tout ce qui a pu être démarré, puis on l'explique.
    console.warn('[ChromAssist] échec caméra :', err && err.name);
    stopCamera();
    showError(describeError(err));
  }
}

/** Arrêt complet et retour à l'état initial. Peut être appelée à tout moment. */
function stopCamera() {
  state.token++;                 // invalide un éventuel démarrage en cours
  stopLoop();                    // 1) plus d'analyse
  releaseStream(state.stream);   // 2) stoppe TOUTES les pistes → voyant caméra éteint
  state.stream = null;
  els.video.pause();
  els.video.srcObject = null;    // 3) détache le flux de l'élément vidéo
  state.videoReady = false;
  state.canvasErrorShown = false;
  resetReadout();
  setPhase('idle');
}

/** La caméra a été reprise par une autre application, ou débranchée. */
function onTrackEnded() {
  if (state.phase === 'idle') return;
  stopCamera();
  showError(MSG.interrupted);
}

/** Unique gestionnaire du bouton principal. */
function toggleCamera() {
  if (state.phase === 'idle') {
    startCamera();
  } else {
    // 'starting' (Annuler) ou 'active' (Arrêter)
    clearError();
    stopCamera();
  }
}

els.toggle.addEventListener('click', toggleCamera);

// Quitter la page ou la mettre en arrière-plan : on rend la caméra.
window.addEventListener('pagehide', () => {
  if (state.phase !== 'idle') stopCamera();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase !== 'idle') {
    stopCamera();
    showError(MSG.background);
  }
});

// --- Boucle d'analyse -----------------------------------------------------

function startLoop() {
  stopLoop();
  state.loopRunning = true;
  state.lastTick = 0;
  state.rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  state.loopRunning = false;
  cancelAnimationFrame(state.rafId);
}

function tick(ts) {
  if (!state.loopRunning) return; // garde-fou : jamais d'analyse caméra éteinte
  state.rafId = requestAnimationFrame(tick);
  if (ts - state.lastTick < ANALYSIS_INTERVAL_MS) return;
  state.lastTick = ts;
  analyze();
}

/**
 * Lit la couleur sous la pipette.
 *
 * 1. Boîte d'affichage = rectangle de .stage (la vidéo le remplit exactement).
 * 2. Pipette (fractions) → pixels CSS → pixel de la vidéo SOURCE, en tenant
 *    compte du recadrage `object-fit: cover` (geometry.js).
 * 3. On ne copie dans le canvas que la petite fenêtre autour de ce pixel
 *    (drawImage avec rectangle source) : léger, et aucune image complète n'est
 *    jamais stockée.
 * 4. Médiane RGB de la fenêtre (sampling.js), puis nom estimé (colors.js).
 */
function analyze() {
  const v = els.video;
  if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
    els.status.textContent = 'Caméra active — en attente de l’image vidéo…';
    return; // vidéo pas encore prête
  }
  if (!state.videoReady) {
    state.videoReady = true;
    els.status.textContent = 'Caméra active — déplacez la pipette';
  }

  const box = els.stage.getBoundingClientRect();
  const mapping = coverMapping(v.videoWidth, v.videoHeight, box.width, box.height);
  if (!mapping) return;

  const p = boxToVideo(state.fx * box.width, state.fy * box.height, mapping, v.videoWidth, v.videoHeight);
  const win = windowRect(p.x, p.y, sampleSize(v.videoWidth), v.videoWidth, v.videoHeight);

  try {
    if (probe.width !== win.size) probe.width = probe.height = win.size;
    probeCtx.drawImage(v, win.x, win.y, win.size, win.size, 0, 0, win.size, win.size);
    const { data } = probeCtx.getImageData(0, 0, win.size, win.size);
    const [r, g, b] = medianRGB(data);
    updateReadout(r, g, b);
    if (state.canvasErrorShown) {
      state.canvasErrorShown = false;
      clearError();
    }
  } catch (err) {
    // Ne bloque pas l'interface : on affiche le problème et on réessaie au prochain tour.
    if (!state.canvasErrorShown) {
      state.canvasErrorShown = true;
      console.warn('[ChromAssist] lecture canvas impossible :', err && err.name);
      showError(MSG.canvas);
    }
  }
}

// --- Pipette : Pointer Events (tactile + souris + stylet) ------------------

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function placeReticle() {
  els.reticle.style.left = `${state.fx * 100}%`;
  els.reticle.style.top = `${state.fy * 100}%`;
}

/** Place la pipette au point écran (clientX, clientY), borné à la zone vidéo. */
function moveReticleTo(clientX, clientY) {
  const box = els.stage.getBoundingClientRect();
  if (!box.width || !box.height) return;
  state.fx = clamp01((clientX - box.left) / box.width);
  state.fy = clamp01((clientY - box.top) / box.height);
  placeReticle();
}

let drag = null; // { id, dx, dy } pendant un glisser

els.stage.addEventListener('pointerdown', (e) => {
  if (state.phase !== 'active' || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();

  // Si on saisit la pipette elle-même, on garde l'écart doigt/pipette (pas de saut).
  // Sinon la pipette vient se placer sous le doigt, puis suit le glissement.
  let dx = 0;
  let dy = 0;
  if (e.target === els.reticle) {
    const r = els.reticle.getBoundingClientRect();
    dx = r.left + r.width / 2 - e.clientX;
    dy = r.top + r.height / 2 - e.clientY;
  }
  drag = { id: e.pointerId, dx, dy };
  els.stage.setPointerCapture(e.pointerId); // on continue de recevoir les mouvements hors de la zone
  moveReticleTo(e.clientX + dx, e.clientY + dy);
});

els.stage.addEventListener('pointermove', (e) => {
  if (drag && e.pointerId === drag.id) moveReticleTo(e.clientX + drag.dx, e.clientY + drag.dy);
});

const endDrag = (e) => {
  if (drag && e.pointerId === drag.id) drag = null;
};
els.stage.addEventListener('pointerup', endDrag);
els.stage.addEventListener('pointercancel', endDrag);
els.stage.addEventListener('lostpointercapture', endDrag);

// Clavier : flèches pour déplacer la pipette (accessibilité).
els.reticle.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? KEY_STEP * 5 : KEY_STEP;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  const m = moves[e.key];
  if (!m) return;
  e.preventDefault();
  state.fx = clamp01(state.fx + m[0]);
  state.fy = clamp01(state.fy + m[1]);
  placeReticle();
});

// --- Démarrage ------------------------------------------------------------

resetReadout();
placeReticle();
setPhase('idle'); // la caméra n'est JAMAIS lancée automatiquement
