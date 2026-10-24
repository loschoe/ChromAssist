# ChromAssist

**ChromAssist** est une application web locale conçue pour aider à
identifier les couleurs grâce à la caméra d'un téléphone, notamment dans
un contexte d'accessibilité et de daltonisme.

L'application affiche la caméra arrière en direct. Une pipette que l'on
déplace au doigt permet d'analyser une petite zone de l'image.
ChromAssist affiche alors : - le nom français estimé de la couleur ; -
son code HEX ; - ses valeurs RGB ; - jusqu'à deux noms de couleurs
proches.

> **À savoir :** le nom proposé est une estimation. L'éclairage et les
> réglages automatiques de la caméra peuvent modifier les couleurs
> mesurées.

## Points clés

-   **100 % local :** aucune photo n'est envoyée à un serveur distant.
-   **Pas d'IA ni de suivi :** le nom de la couleur est calculé
    directement par le code JavaScript.
-   **Pas de dépendances applicatives :** HTML, CSS et JavaScript
    natifs.
-   **Pas d'enregistrement automatique :** aucune photo, capture ou
    historique n'est conservé.
-   **Caméra activée à la demande :** elle ne démarre que lorsque
    l'utilisateur appuie sur le bouton prévu.
-   **Projet sans hébergement :** il suffit de lancer le serveur local
    lorsque l'application est nécessaire.

Le nom « ChromAssist » est provisoire. Il peut être modifié dans
`public/index.html` (balises `<title>` et `<h1>`) et dans
`package.json`.

## 1. Prérequis et démarrage

### Prérequis

-   Node.js **18 ou plus récent**.
-   Un navigateur compatible avec l'accès à la caméra, par exemple
    Chrome.

### Lancer le serveur

À la racine du projet :

``` bash
node server.mjs
```

Ou, avec npm :

``` bash
npm start
```

Puis ouvrir cette adresse dans le navigateur :

**http://localhost:8080**

Pour arrêter le serveur, utiliser `Ctrl+C` dans le terminal.

### Lanceurs rapides

Il est également possible de démarrer le projet sans ouvrir un éditeur
de code :

-   Windows : `lancer.bat`
-   Linux, macOS ou Termux : `lancer.sh`

### Options du serveur

Le serveur accepte les options suivantes :

``` bash
node server.mjs --port 3000
node server.mjs --host 0.0.0.0
node server.mjs --cert certificat.pem --key cle.pem
```

-   `--port` : choisit le port d'écoute.
-   `--host` : choisit l'adresse réseau sur laquelle le serveur écoute.
-   `--cert` et `--key` : activent HTTPS avec un certificat et sa clé
    privée.

Sans Node.js, un autre serveur statique peut servir le dossier `public/`
:

``` bash
python3 -m http.server 8080 --directory public
```

Il faut ouvrir le site via `localhost`. Ouvrir directement `index.html`
avec une adresse `file://` ne fonctionne pas, car les modules JavaScript
sont alors bloqués par le navigateur.

## 2. Utiliser la caméra sur téléphone

Les navigateurs limitent l'accès à la caméra pour des raisons de
sécurité. L'API `getUserMedia()` fonctionne généralement uniquement dans
un **contexte sécurisé**.

  -----------------------------------------------------------------------
  Adresse utilisée                    Accès à la caméra
  ----------------------------------- -----------------------------------
  `https://…` avec un certificat      Autorisé
  reconnu par l'appareil              

  `http://localhost:8080` sur         Autorisé
  l'appareil qui utilise le           
  navigateur                          

  `http://127.0.0.1:8080` sur         Autorisé
  l'appareil qui utilise le           
  navigateur                          

  `http://192.168.x.x:8080` sans      Généralement refusé
  HTTPS                               
  -----------------------------------------------------------------------

**Important :** si le serveur tourne sur un ordinateur et que le
téléphone ouvre `http://<IP-de-l-ordinateur>:8080`, le navigateur du
téléphone risque de bloquer la caméra. Le fait que le site soit
accessible ne signifie pas que l'accès à la caméra sera autorisé.

### Solution A --- Tout faire tourner sur le téléphone (recommandée)

Le serveur et le navigateur fonctionnent sur le même téléphone.
L'adresse `http://localhost:8080` est alors considérée comme sécurisée.

1.  Installer [Termux](https://termux.dev), de préférence depuis
    F-Droid.

2.  Installer Node.js dans Termux :

    ``` bash
    pkg install nodejs
    ```

3.  Copier le dossier du projet sur le téléphone.

4.  Entrer dans le dossier du projet, puis lancer :

    ``` bash
    cd chromassist
    ./lancer.sh
    ```

5.  Ouvrir `http://localhost:8080` dans Chrome.

### Solution B --- Utiliser l'ordinateur via USB

Le téléphone accède au serveur de l'ordinateur à travers son propre
`localhost`, grâce à une redirection USB.

1.  Activer les options pour les développeurs et le débogage USB sur le
    téléphone.

2.  Brancher le téléphone à l'ordinateur.

3.  Installer l'outil `adb` si nécessaire.

4.  Sur l'ordinateur, exécuter :

    ``` bash
    adb reverse tcp:8080 tcp:8080
    ```

5.  Lancer `node server.mjs` sur l'ordinateur.

6.  Sur le téléphone, ouvrir `http://localhost:8080`.

### Solution C --- Utiliser HTTPS sur le réseau local

Cette méthode demande de créer un certificat HTTPS reconnu par le
téléphone.

1.  Installer [mkcert](https://github.com/FiloSottile/mkcert).

2.  Installer l'autorité locale de mkcert :

    ``` bash
    mkcert -install
    ```

3.  Générer un certificat en remplaçant l'adresse IP par celle de
    l'ordinateur :

    ``` bash
    mkcert 192.168.1.20 localhost
    ```

4.  Démarrer le serveur en indiquant le certificat et la clé générés :

    ``` bash
    node server.mjs --host 0.0.0.0 --cert 192.168.1.20+1.pem --key 192.168.1.20+1-key.pem
    ```

5.  Sur Android, installer le certificat d'autorité `rootCA.pem`. Le
    dossier où il se trouve peut être obtenu avec :

    ``` bash
    mkcert -CAROOT
    ```

    Dans les réglages Android, rechercher la section permettant
    d'installer un certificat d'autorité.

6.  Ouvrir `https://192.168.1.20:8080` sur le téléphone.

**Sécurité :** conserver `rootCA-key.pem` secret. Toute personne qui le
possède peut créer des certificats que les appareils faisant confiance à
cette autorité pourraient accepter. Les fichiers `*.pem` sont exclus de
Git grâce à `.gitignore`.

### Solution D --- Contournement réservé aux essais

Chrome Android propose un réglage expérimental permettant de traiter une
adresse HTTP comme une origine sécurisée :

`chrome://flags/#unsafely-treat-insecure-origin-as-secure`

Ce réglage réduit les protections du navigateur. Il est déconseillé pour
un usage courant.

> Les solutions B, C et D n'ont pas été testées sur un appareil réel
> pendant le développement. Leurs étapes s'appuient sur la documentation
> des outils concernés.

## 3. Organisation des fichiers

``` text
chromassist/
├── public/                  # Fichiers accessibles au navigateur
│   ├── index.html           # Structure HTML, CSP et textes
│   ├── css/
│   │   └── style.css        # Thème sombre et mise en page responsive
│   └── js/
│       ├── app.js           # Caméra, pipette, analyse et interface
│       ├── geometry.js      # Coordonnées écran vers coordonnées vidéo
│       ├── sampling.js      # Zone d’échantillonnage et médiane RGB
│       └── colors.js        # RGB, CIELAB, ΔE2000, palette, HEX et RGB
├── tests/                   # Tests automatisés
├── server.mjs               # Serveur statique HTTP/HTTPS
├── lancer.bat               # Lanceur Windows
├── lancer.sh                # Lanceur Linux/macOS/Termux
└── package.json             # Métadonnées et scripts npm
```

Les fichiers `geometry.js`, `sampling.js` et `colors.js` ne dépendent
pas du DOM du navigateur : leur logique peut être testée avec Node.js.
`app.js` gère les éléments propres au navigateur.

### Pourquoi HTML, CSS et JavaScript natifs ?

Le projet tient dans une page et quelques modules. Les technologies
natives permettent de limiter les dépendances, de faciliter la lecture
du code et de simplifier l'audit de confidentialité. Aucun outil de
compilation tel que Vite n'est nécessaire : les modules ES sont chargés
directement par le navigateur.

## 4. Fonctionnement technique

### 4.1 Démarrage et arrêt de la caméra

1.  Au chargement de la page, l'interface apparaît, mais **la caméra
    reste arrêtée**.

2.  Quand l'utilisateur appuie sur « Activer la caméra », l'application
    demande l'accès à la vidéo avec :

    ``` javascript
    getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    })
    ```

    `facingMode: "environment"` demande de préférence la caméra arrière.
    Aucun accès au microphone n'est demandé.

3.  Le flux vidéo est affiché dans un élément
    `<video autoplay playsinline muted>`.

4.  Une boucle `requestAnimationFrame`, limitée à environ **10 analyses
    par seconde**, lit la couleur sous la pipette.

5.  À l'arrêt, la boucle est annulée, toutes les pistes vidéo sont
    stoppées avec `track.stop()`, le flux est détaché de la vidéo et
    l'interface revient à son état initial.

La caméra est également arrêtée si la page passe en arrière-plan, est
quittée ou si une autre application reprend la caméra.

Le bouton de contrôle utilise un seul gestionnaire, `toggleCamera`, qui
tient compte des états `idle`, `starting` et `active`. Un jeton
`state.token` invalide les demandes de démarrage devenues obsolètes.
Ainsi, si l'utilisateur annule pendant la demande d'autorisation, un
flux qui arrive ensuite est immédiatement libéré.

### 4.2 Replacer correctement la pipette (`geometry.js`)

La vidéo peut être agrandie pour remplir la zone d'affichage, puis
recadrée au centre par `object-fit: cover`. Les coordonnées affichées à
l'écran ne correspondent donc pas directement aux coordonnées des pixels
de la vidéo.

Le calcul utilise les dimensions de la zone visible et celles de la
vidéo :

``` text
scale   = max(largeurZone / largeurVidéo, hauteurZone / hauteurVidéo)
offsetX = (largeurZone − largeurVidéo × scale) / 2
offsetY = (hauteurZone − hauteurVidéo × scale) / 2

vidéoX = (écranX − offsetX) / scale
vidéoY = (écranY − offsetY) / scale
```

**Exemple :** une vidéo de 1280 × 720 affichée dans une zone portrait de
400 × 800 est agrandie et recadrée sur les côtés. Le bord gauche affiché
correspond environ au pixel `x = 460` de la vidéo, et non au pixel
`x = 0`.

La position de la pipette est conservée sous forme de fractions
comprises entre 0 et 1 de la zone d'affichage. Après une rotation
portrait/paysage, elle garde ainsi la même position relative. Les
coordonnées sont recalculées à chaque analyse avec les dimensions
actuelles.

L'élément `.stage` ne possède volontairement ni bordure ni marge : la
vidéo remplit exactement la zone mesurée.

### 4.3 Échantillonner les pixels (`sampling.js` et `app.js`)

L'application ne lit pas un seul pixel, car celui-ci pourrait être
affecté par un reflet ou du bruit.

-   Une fenêtre carrée de taille impaire est centrée sous la pipette.
-   Pour une vidéo de 1280 pixels de large, la fenêtre fait environ **9
    × 9 pixels**.
-   Si elle arrive près d'un bord, elle est décalée pour rester dans
    l'image.
-   La médiane de chaque canal RGB est calculée séparément. Cette
    méthode réduit l'influence des valeurs aberrantes, comme un reflet
    isolé.
-   Seule la petite zone utile est copiée dans un `canvas` hors écran
    avec `drawImage` et un rectangle source.

L'image vidéo complète n'est ni copiée dans un canvas ni conservée comme
capture.

### 4.4 Reconnaître le nom de la couleur (`colors.js`)

Le calcul suit trois étapes :

1.  **RGB → CIELAB :** conversion des valeurs rouge, vert et bleu vers
    un espace colorimétrique conçu pour mieux représenter les
    différences perçues.
2.  **Comparaison CIEDE2000 (ΔE00) :** calcul de la distance
    perceptuelle entre la couleur mesurée et chaque référence de la
    palette.
3.  **Sélection du nom :** tri des références par distance croissante,
    puis affichage du nom le plus proche et, si possible, de jusqu'à
    deux alternatives proches.

La palette est définie dans le tableau `CHROMATIC` en haut de
`colors.js`. Les niveaux de gris sont gérés séparément dans
`ACHROMATIC`. La chroma permet de distinguer les couleurs considérées
comme chromatiques de celles traitées comme noir, gris ou blanc.

La fonction `nameColor(r, g, b)` renvoie notamment : - `name` : nom
principal ; - `alternatives` : jusqu'à deux noms proches ; - `deltaE` :
distance ΔE00 avec la référence principale ; - `achromatic` : indique si
la couleur a été classée comme achromatique.

Les fonctions `toHex(r, g, b)` et `formatRgb(r, g, b)` formattent
respectivement le code HEX et les valeurs RGB.

**Limites de la reconnaissance :** - L'éclairage, les ombres,
l'exposition automatique et la balance des blancs peuvent modifier la
mesure. - Les noms de couleurs n'ont pas de frontières universelles :
certaines nuances se situent entre deux catégories. - La palette est
limitée aux références qui y sont définies. - Une distance ΔE00 faible
signifie que la référence est proche de la mesure ; elle ne constitue
pas, à elle seule, un pourcentage de confiance.

Le nom affiché reste donc une estimation, même si le calcul
colorimétrique est précis.

## 5. Interface et accessibilité

-   La pipette peut être déplacée au doigt, à la souris ou au clavier.
-   Les flèches du clavier déplacent la pipette ; `Maj` permet un
    déplacement plus grand.
-   Un toucher dans la zone vidéo place la pipette sous le doigt. Lors
    d'un glissement, l'écart entre le doigt et la pipette est conservé.
-   Un double anneau noir et blanc rend la pipette et la pastille
    visibles sur les fonds clairs comme foncés.
-   Le nom et les codes sont affichés sous forme de texte sur un fond
    uni, et non directement sur la couleur mesurée.
-   L'information ne dépend jamais de la couleur seule : libellés
    explicites, symboles textuels, styles de bouton distincts et
    messages d'erreur préfixés par « ⚠ Erreur ».
-   L'interface n'utilise ni animation ni clignotement.
-   Les titres utilisent Aptos et le texte Consolas, avec des polices de
    secours si celles-ci ne sont pas disponibles sur l'appareil.

## 6. Confidentialité et sécurité

ChromAssist est conçu pour fonctionner localement.

-   Aucun `fetch`, WebSocket, XHR ou élément externe n'est utilisé.

-   La politique CSP (*Content Security Policy*) inclut
    `connect-src 'none'`, qui interdit les connexions réseau initiées
    par la page.

-   Aucune photo, capture, donnée de couleur ou historique n'est
    enregistré.

-   Aucun `localStorage` n'est utilisé.

-   Rien n'est écrit dans la console, à l'exception du nom d'une erreur
    de caméra.

-   Seule la vidéo est demandée : pas de microphone ni de
    géolocalisation.

-   Le serveur envoie l'en-tête :

    ``` text
    Permissions-Policy: camera=(self), microphone=(), geolocation=()
    ```

-   `server.mjs` ne sert que le dossier `public/`, refuse les chemins
    permettant de sortir de ce dossier et les méthodes autres que `GET`
    et `HEAD`.

-   Par défaut, le serveur écoute uniquement sur `127.0.0.1`.

L'audit statique du code est utile, mais ne remplace pas un contrôle du
trafic réseau dans le navigateur sur un appareil réel.

## 7. Tests automatisés

Lancer les tests depuis la racine du projet :

``` bash
npm test
```

Ou directement avec Node.js :

``` bash
node --test
```

Les **16 tests** prévus vérifient :

-   la conversion RGB vers CIELAB pour le blanc, le noir et le rouge pur
    ;
-   la distance ΔE2000 à partir de valeurs de référence publiées par
    Sharma, Wu et Dalal (2005) ;
-   le nommage de 18 couleurs connues et la distinction entre couleurs
    chromatiques et achromatiques ;
-   la conversion des coordonnées avec `object-fit: cover` : portrait,
    paysage, même ratio, aller-retour, coins et dimensions nulles ;
-   le placement de la fenêtre d'échantillonnage au centre, aux bords et
    dans les coins ;
-   la robustesse de la médiane face aux reflets isolés ;
-   un audit statique de confidentialité et de gestion de la caméra :
    absence d'API réseau, d'URL externe, de stockage et de capture,
    présence d'une seule demande caméra, d'un seul gestionnaire de clic,
    de `track.stop()` et de `cancelAnimationFrame`.

Ces tests ne vérifient pas le comportement d'une caméra réelle. Les
permissions, la fluidité, la rotation et le rendu doivent être testés
manuellement sur téléphone.

## 8. Checklist de test manuel sur Android

Ouvrir l'application dans Chrome avec l'une des méthodes A, B ou C de la
section « Utiliser la caméra sur téléphone ».

### Caméra et permissions

-   [ ] Au chargement, aucune autorisation n'est demandée et le voyant
    caméra reste éteint.
-   [ ] Appuyer sur « Activer la caméra », accepter l'autorisation et
    vérifier l'affichage de la caméra arrière.
-   [ ] Appuyer sur « Arrêter la caméra » : la vidéo disparaît, le
    message « Caméra arrêtée » apparaît et le voyant caméra du système
    s'éteint.
-   [ ] Répéter l'activation et l'arrêt dix fois : aucune erreur ni
    baisse de fluidité.
-   [ ] Refuser l'autorisation : un message clair apparaît et le bouton
    reste réutilisable. Autoriser ensuite la caméra dans les réglages du
    site et réessayer.
-   [ ] Annuler pendant la demande d'autorisation : la caméra ne doit
    pas démarrer.
-   [ ] Ouvrir une autre application qui utilise la caméra : ChromAssist
    doit gérer l'interruption sans rester bloqué.
-   [ ] Mettre la page en arrière-plan ou verrouiller l'écran : la
    caméra doit s'arrêter et un message doit l'indiquer.
-   [ ] Ouvrir le site avec `http://<IP>` sans HTTPS : un message
    explicite doit expliquer le problème de contexte sécurisé.

### Pipette et coordonnées

-   [ ] Déplacer la pipette au doigt et vérifier qu'un simple toucher la
    positionne correctement.
-   [ ] La tirer vers les bords et les quatre coins : elle doit rester
    dans la zone vidéo.
-   [ ] Placer un objet d'une couleur distincte au bord de l'image : la
    pipette doit lire cet objet, pas la zone voisine.
-   [ ] Refaire le test en portrait et en paysage.
-   [ ] Tourner le téléphone entre les orientations portrait et paysage
    : l'interface et la pipette doivent rester cohérentes.
-   [ ] Vérifier qu'une utilisation à une seule main reste confortable.

### Couleurs et affichage

-   [ ] Sur une surface unie, vérifier que les valeurs HEX et RGB
    restent stables à quelques unités près et que le nom paraît
    plausible.
-   [ ] Tester du papier blanc, un objet noir et des surfaces grises :
    les résultats doivent être achromatiques plutôt que classés comme
    des couleurs chromatiques.
-   [ ] Tester en faible luminosité et avec des reflets : les valeurs
    peuvent varier, mais l'application ne doit pas planter.
-   [ ] Vérifier la lisibilité de la pastille et du texte sur les
    couleurs très claires et très sombres.
-   [ ] Vérifier que la pipette suit le doigt sans à-coups et que le
    téléphone ne chauffe pas de façon notable.

### Confidentialité

-   [ ] Avec `chrome://inspect` et le débogage USB, ou avec les outils
    de développement sur ordinateur, ouvrir l'onglet **Réseau**.
-   [ ] Vérifier qu'aucune requête réseau n'est effectuée pendant le
    chargement et l'utilisation, en tenant compte des éventuelles
    requêtes propres aux outils de développement.

### Accessibilité

-   [ ] Au clavier, vérifier que `Tab` permet d'atteindre le bouton et
    la pipette, que les flèches déplacent la pipette et que le focus
    reste visible.
-   [ ] Avec TalkBack, vérifier que le bouton annonce son libellé actuel
    et que les erreurs sont annoncées.

## 9. Évolutions possibles

Les fonctionnalités suivantes ne sont **pas encore réalisées**. Elles
pourront être envisagées après validation des bases sur téléphone :

-   ajouter une loupe autour de la pipette ;
-   figer temporairement la lecture d'une couleur ;
-   ajouter un bouton de copie HEX/RGB ;
-   proposer un historique local, uniquement après activation explicite
    ;
-   permettre de basculer entre la caméra avant et arrière ;
-   stabiliser les mesures grâce à une moyenne temporelle.

## Licence et état du projet

Aucune information de licence n'est définie dans ce README.

**État de validation :** la logique de calcul dispose de tests
automatisés. Le fonctionnement avec une caméra réelle --- permissions,
fluidité, rotation et couleurs mesurées --- reste à valider sur
téléphone à l'aide de la checklist ci-dessus.
