# ChromAssist

Application web **locale** qui aide à identifier les couleurs avec la caméra du téléphone (accessibilité, daltonisme) : la caméra arrière s'affiche en direct, on déplace une **pipette** au doigt, et l'application indique le **nom estimé** de la couleur, son code **HEX** et ses valeurs **RGB**.

- Aucune photo, aucun fichier à choisir : la lecture se fait directement sur le flux vidéo.
- **Traitement 100 % local** : aucun serveur distant, aucune IA, aucun suivi. La page interdit elle-même tout accès réseau (voir [Confidentialité](#confidentialité)).
- Aucune dépendance : HTML, CSS et JavaScript natifs. Node.js sert seulement à lancer un petit serveur local.
- Le nom « ChromAssist » est provisoire : il apparaît dans `public/index.html` (balises `<title>` et `<h1>`) et dans `package.json`.

> **État de validation** : la logique de calcul est testée automatiquement (voir [Tests](#tests)).
> Le fonctionnement avec une **vraie caméra** (permissions, fluidité, rotation, couleurs réelles)
> n'a **pas** pu être vérifié dans l'environnement de développement (pas de navigateur ni de caméra).
> Il reste à valider sur téléphone avec la [checklist](#checklist-de-test-manuel-android).

---

## Lancer l'application

Prérequis : [Node.js](https://nodejs.org) 18 ou plus.

```bash
node server.mjs          # ou : npm start
```

Puis ouvrir **http://localhost:8080** dans le navigateur. Arrêt : `Ctrl+C`.

Lanceurs à double-clic (pas besoin d'éditeur de code) : `lancer.bat` (Windows) ou `lancer.sh` (Linux/macOS/Termux).

Options : `--port 3000`, `--host <adresse>`, `--cert <fichier> --key <fichier>` (HTTPS, voir plus bas).

Sans Node.js, n'importe quel serveur statique convient, à condition de servir le dossier `public/` en tant que `localhost` :
`python3 -m http.server 8080 --directory public`.
(Ouvrir `index.html` directement par `file://` ne fonctionne pas : les modules JavaScript sont bloqués.)

---

## HTTPS et caméra : à lire avant d'utiliser le téléphone

Les navigateurs n'autorisent `getUserMedia()` (la caméra) que dans un **contexte sécurisé** :

| Adresse ouverte dans le navigateur | Caméra |
|---|---|
| `https://…` (certificat reconnu par l'appareil) | autorisée |
| `http://localhost:…` ou `http://127.0.0.1:…` **sur l'appareil qui exécute le navigateur** | autorisée |
| `http://192.168.x.x:…` (adresse IP du réseau local, sans HTTPS) | **généralement refusée** |

Conséquence : si le serveur tourne sur un ordinateur et que le téléphone ouvre `http://<IP-de-l'ordinateur>:8080`, la caméra sera en général **bloquée**. L'application affiche alors un message explicite. Quatre solutions, de la plus simple à la plus lourde :

### A. Tout sur le téléphone (recommandé pour un usage au quotidien)
Le serveur tourne sur le téléphone, le navigateur ouvre `http://localhost:8080` : contexte sécurisé, aucun certificat.
1. Installer [Termux](https://termux.dev) (version F-Droid), puis `pkg install nodejs`.
2. Copier le dossier du projet sur le téléphone.
3. `cd chromassist && ./lancer.sh`, puis ouvrir `http://localhost:8080` dans Chrome.

### B. Serveur sur l'ordinateur + câble USB (`localhost` redirigé)
Le téléphone voit « son » `localhost`, qui est en réalité redirigé vers l'ordinateur.
1. Activer les options pour les développeurs et le **débogage USB** sur le téléphone, le brancher.
2. Sur l'ordinateur : `adb reverse tcp:8080 tcp:8080` (outil [adb](https://developer.android.com/tools/adb)).
3. Lancer `node server.mjs` sur l'ordinateur ; ouvrir `http://localhost:8080` **sur le téléphone**.

### C. HTTPS sur le réseau local
1. Installer [mkcert](https://github.com/FiloSottile/mkcert), puis `mkcert -install`.
2. Générer un certificat pour l'adresse de l'ordinateur : `mkcert 192.168.1.20 localhost` (remplacer par votre IP).
3. Lancer : `node server.mjs --host 0.0.0.0 --cert 192.168.1.20+1.pem --key 192.168.1.20+1-key.pem`
4. Sur Android, installer l'autorité de certification de mkcert (fichier `rootCA.pem`, dossier donné par `mkcert -CAROOT`) : *Réglages › Sécurité › Chiffrement et identifiants › Installer un certificat › Certificat d'autorité*.
5. Ouvrir `https://192.168.1.20:8080` sur le téléphone.

Garder `rootCA-key.pem` secret : quiconque le possède peut émettre des certificats que vos appareils accepteront. Les fichiers `*.pem` sont exclus par `.gitignore`.

### D. Contournement de développement (à éviter)
Dans Chrome Android, `chrome://flags/#unsafely-treat-insecure-origin-as-secure` permet de déclarer une origine HTTP comme sécurisée. Cela affaiblit la protection du navigateur : à réserver à des essais.

> Les solutions B, C et D n'ont pas pu être essayées sur un appareil réel pendant le développement ; les étapes suivent la documentation des outils.

---

## Architecture

```
chromassist/
├── public/                  ← tout ce qui est servi au navigateur
│   ├── index.html           Structure de la page, CSP, textes
│   ├── css/style.css        Thème sombre bleu nuit / anthracite, responsive
│   └── js/
│       ├── app.js           Caméra, pipette, boucle d'analyse, affichage, erreurs
│       ├── geometry.js      Coordonnées écran → pixels vidéo (object-fit: cover)
│       ├── sampling.js      Fenêtre d'échantillonnage + médiane RGB
│       └── colors.js        RGB → CIELAB, ΔE2000, palette française, HEX/RGB
├── tests/                   Tests Node (logique + audit de confidentialité)
├── server.mjs               Mini serveur statique (HTTP, ou HTTPS avec --cert/--key)
├── lancer.bat / lancer.sh   Lanceurs à double-clic
└── package.json             Scripts npm (aucune dépendance)
```

`geometry.js`, `sampling.js` et `colors.js` ne touchent pas au DOM : ils sont testables sous Node. `app.js` est la seule partie liée au navigateur.

### Pourquoi ce choix
HTML/CSS/JS natifs suffisent : une seule page, pas d'état complexe, pas de dépendance à maintenir ni à auditer, et le projet reste lisible pour un étudiant. Pas de bundler (Vite) : les modules ES se chargent directement.

### Déroulement
1. Au chargement : interface seule, **la caméra n'est pas lancée**.
2. Clic sur « Activer la caméra » → `getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })`. Seule la vidéo est demandée.
3. Le flux est affiché dans `<video autoplay playsinline muted>`.
4. Une boucle `requestAnimationFrame` limitée à ~10 analyses/s lit la couleur sous la pipette.
5. « Arrêter la caméra » : arrêt de la boucle → `track.stop()` sur **toutes** les pistes → détachement de la vidéo → retour à l'état initial. Même chose si la page passe en arrière-plan, est quittée, ou si la caméra est reprise par une autre application.

Le bouton n'a **un seul** gestionnaire (`toggleCamera`) qui agit selon l'état (`idle` / `starting` / `active`). Un jeton (`state.token`) invalide les démarrages devenus obsolètes : si l'utilisateur annule pendant la demande d'autorisation, le flux arrivé en retard est immédiatement relâché.

### Coordonnées avec `object-fit: cover` (`geometry.js`)
La vidéo est agrandie pour remplir la zone puis **recadrée** au centre. Un point de l'écran ne correspond donc pas au pixel « proportionnel » de la source. Formules :

```
scale   = max(largeurZone / largeurVidéo, hauteurZone / hauteurVidéo)
offsetX = (largeurZone − largeurVidéo × scale) / 2      offsetY idem en hauteur
vidéoX  = (écranX − offsetX) / scale                    vidéoY idem
```

Exemple : une vidéo 1280×720 dans une zone portrait 400×800 : `scale ≈ 1,11`, `offsetX ≈ −511` ; le bord gauche de la zone correspond au pixel x ≈ 460 de la vidéo (et non 0). La position de la pipette est stockée en **fractions** (0 à 1) de la zone : après une rotation, elle reste au même endroit relatif, et le calcul est refait à chaque analyse avec la taille courante. `.stage` n'a volontairement ni bordure ni marge, pour que la vidéo remplisse exactement la boîte mesurée.

### Prélèvement des pixels (`sampling.js`, `app.js`)
On ne lit pas un pixel isolé : une fenêtre carrée **impaire (≈ 9×9 px pour du 1280 px de large)** est centrée sur le point visé, décalée si besoin pour rester dans l'image, et on prend la **médiane de chaque canal** (robuste aux reflets et au bruit). Seule cette petite fenêtre est copiée dans un `canvas` hors écran (`drawImage` avec rectangle source) : l'image complète n'est jamais copiée ni conservée.

### Nom de la couleur (`colors.js`)
RGB → **CIELAB**, puis distance **CIEDE2000 (ΔE00)** à une palette de 23 couleurs chromatiques et 5 niveaux de gris. Les couleurs de faible chroma sont traitées comme achromatiques (noir, gris foncé, gris, gris clair, blanc). On affiche le nom le plus proche et jusqu'à deux voisins. La palette est la liste `CHROMATIC` en haut du fichier : facile à modifier.

**Limites** : le nom est une **estimation**. L'éclairage (lumière chaude, ombre), la balance des blancs et l'exposition automatique de la caméra décalent les valeurs mesurées ; un même objet peut donner « Brun » ou « Orange » selon la lumière. Les frontières entre noms sont arbitraires (où s'arrête « Vert » et où commence « Turquoise » ?). Pour une information importante, comparer avec une autre source.

### Interface et accessibilité
- Pipette déplaçable au doigt, à la souris, ou aux **flèches du clavier** (Maj = pas plus grand). Toucher la zone y place la pipette ; saisir la pipette conserve l'écart doigt/pipette.
- Double anneau blanc/noir pour la pipette et la pastille : visibles sur fond très clair comme très sombre. Le nom et les codes sont du texte sur fond uni, jamais sur la couleur mesurée.
- L'information n'est jamais portée par la couleur seule : libellés explicites, icône texte (▶ ■ ✕), bouton plein ou contour selon l'état, erreurs préfixées de « ⚠ Erreur ».
- Pas d'animation, pas de clignotement. Polices : Aptos (titres), Consolas (texte), avec polices de secours (Android n'a généralement ni l'une ni l'autre).

### Confidentialité
- Aucun `fetch`, WebSocket, XHR ni balise externe. La page impose une *Content-Security-Policy* avec `connect-src 'none'` : le navigateur lui-même refuse toute requête réseau.
- Aucune image conservée, aucun `localStorage`, aucun enregistrement, aucune capture. Rien n'est écrit dans la console, à part le *nom* d'une erreur caméra.
- Seule la vidéo est demandée (pas le micro). Le serveur envoie `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
- `server.mjs` ne sert que `public/`, refuse la traversée de chemin et les méthodes autres que GET/HEAD, et n'écoute par défaut que sur `127.0.0.1`.

---

## Tests

```bash
npm test        # ou : node --test
```

Ce qui est **vérifié automatiquement** (16 tests) :
- conversion RGB → Lab (blanc, noir, rouge pur) ;
- ΔE2000 contre les valeurs publiées de Sharma, Wu et Dalal (2005) ;
- nommage de 18 couleurs connues ; achromatique vs chromatique ;
- conversion de coordonnées avec `object-fit: cover` : portrait, paysage, même ratio, aller-retour, coins, dimensions nulles ;
- fenêtre d'échantillonnage au centre, aux bords et aux coins ; médiane qui ignore des reflets isolés ;
- audit **statique** : pas d'API réseau, pas d'URL externe, pas de stockage ni de capture, une seule demande caméra, un seul gestionnaire de clic, présence de `track.stop()` et `cancelAnimationFrame`.

Ce qui **n'est pas** vérifié automatiquement : tout ce qui demande un navigateur et une caméra (voir ci-dessous). L'audit de confidentialité est statique et ne remplace pas un contrôle de l'onglet *Réseau* sur l'appareil.

### Checklist de test manuel (Android)

Ouvrir l'application via une des méthodes A, B ou C ci-dessus, dans Chrome.

**Caméra et permissions**
- [ ] Au chargement, aucune demande d'autorisation n'apparaît et le voyant caméra est éteint.
- [ ] « Activer la caméra » → demande d'autorisation → accepter : vidéo en direct, caméra **arrière**.
- [ ] « Arrêter la caméra » : la vidéo disparaît, le message « Caméra arrêtée » s'affiche, le **voyant/l'icône caméra du système s'éteint**.
- [ ] Répéter activer/arrêter 10 fois : aucune erreur, pas de ralentissement.
- [ ] Refuser l'autorisation : message clair, bouton de nouveau utilisable ; après avoir autorisé dans les réglages du site, ça fonctionne.
- [ ] Appuyer sur « Annuler » pendant la demande d'autorisation : retour à l'état initial, caméra non démarrée.
- [ ] Ouvrir la caméra dans une autre application pendant l'usage : message d'interruption, pas de blocage.
- [ ] Passer l'application en arrière-plan / verrouiller l'écran : caméra arrêtée, message affiché.
- [ ] Ouvrir la page en `http://<IP>` sans HTTPS : message explicite sur la page sécurisée.

**Pipette et exactitude**
- [ ] La pipette se déplace au doigt (glisser) et un simple toucher la déplace sous le doigt.
- [ ] Elle reste dans la zone vidéo en la tirant au-delà des bords et dans les 4 coins.
- [ ] **Recadrage** : placer un objet de couleur distincte tout au bord de l'image affichée ; la pipette dessus doit donner la couleur de cet objet, pas celle de la zone voisine. Comparer portrait et paysage.
- [ ] Rotation portrait ↔ paysage : l'interface reste utilisable, la pipette reste dans la zone, les lectures restent cohérentes.
- [ ] Utilisation à une seule main confortable (bouton large, pipette atteignable).

**Couleurs**
- [ ] Surface unie (mur, feuille colorée, écran affichant une couleur pleine) : HEX/RGB stables à quelques unités près, nom plausible.
- [ ] Papier blanc, objet noir, gris : « Blanc », « Noir », « Gris… » (et non une couleur chromatique).
- [ ] Faible luminosité et reflet : les valeurs bougent, l'application ne plante pas, le nom reste présenté comme estimation.
- [ ] Pastille et texte lisibles pour une couleur très claire et très sombre.
- [ ] Fluidité : la lecture suit la pipette sans à-coups ni échauffement notable du téléphone.

**Confidentialité**
- [ ] Avec `chrome://inspect` (débogage USB) ou les outils de développement du bureau : onglet *Réseau* vide après le chargement initial, pendant tout l'usage.

**Accessibilité**
- [ ] Au clavier (ordinateur) : Tab atteint le bouton et la pipette ; flèches déplacent la pipette ; focus visible.
- [ ] Lecteur d'écran (TalkBack) : le bouton est annoncé avec son libellé courant ; les erreurs sont annoncées.

---

## Pistes d'évolution (non réalisées)

Volontairement laissées de côté tant que les bases ne sont pas validées sur téléphone : loupe autour de la pipette, bouton pour figer la lecture, copie HEX/RGB, historique local (sur activation explicite), bascule caméra avant/arrière, moyenne temporelle pour stabiliser les valeurs.
