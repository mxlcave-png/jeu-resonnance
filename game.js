const canvas = document.getElementById("jeu");
const ctx = canvas.getContext("2d");

// ----- Animation idle (feuille de 6 poses) -----
const imageIdle = new Image();
imageIdle.src = "idle.png";
const IDLE_FRAMES = 6;
const IDLE_CELLE_W = 288;
const IDLE_CELLE_H = 427;
const IDLE_VITESSE = 8;
const IDLE_ECHELLE = 0.23;      // personnage affiché à ~98 px de haut

// ----- Animation marche (feuille de 8 poses) -----
const imageMarche = new Image();
imageMarche.src = "marche.png";
const MARCHE_FRAMES = 8;
const MARCHE_CELLE_W = 160;
const MARCHE_CELLE_H = 247;
const MARCHE_VITESSE = 10;           // poses par seconde en marchant
const MARCHE_ECHELLE = 0.40;         // même taille à l'écran que l'idle
const VITESSE_COURSE = 340;          // vitesse en courant (la marche reste à 200)
const MARCHE_VITESSE_COURSE = 16;    // poses par seconde en courant

// ----- Animation saut (feuille de 8 poses) -----
const imageSaut = new Image();
imageSaut.src = "saut.png";
const SAUT_FRAMES = 8;
const SAUT_CELLE_W = 2172 / 8;       // 271.5 px par pose (feuille de 2172 px)
const SAUT_CELLE_H = 724;            // hauteur réelle de la feuille
const SAUT_PIEDS = 573;              // ligne des pieds dans la feuille (commune à toutes les poses)
const SAUT_ECHELLE = 0.365;          // même taille à l'écran que l'idle
const DUREE_DECOLLAGE = 0.08;        // pose 2 juste après le saut
const DUREE_RECUPERATION = 0.12;     // pose 8 juste après l'atterrissage

// ----- Réglages repris du projet Godot « fracture » -----
const TAILLE_TUILE = 16;
const GRAVITE = 980;
const VITESSE = 200;
const FORCE_SAUT = -300;
const SAUTS_MAX = 2;
const VITESSE_DASH = 500;
const DUREE_DASH = 0.2;
const ZONE_MORT_Y = 1253 - 1568 / 2;
const DEPART_X = -16;
const DEPART_Y = -42;

// ----- Vie et combat -----
const PV_MAX = 3;
const DUREE_INVULNERABLE = 1.0;
const RECUL_JOUEUR = 220;
const DUREE_RECUL = 0.2;
const PORTEE_DETECTION = 220;
const PORTEE_DAGUES = 170;
const VITESSE_CHARGE = 130;
const VITESSE_PATROUILLE = 50;
const DUREE_ETOURDISSEMENT = 0.6;
const RECUL_ENNEMI = 60;
const RAYON_ECHO = 320;
const ENERGIE_MAX = 100;
const COUT_ECHO = 40;
const DRAIN_RESONANCE = 10;
const RECHARGE_ENERGIE = 8;
const GAIN_ENERGIE_COUP = 10;
const VITESSE_PLATEFORME = 60;

// ----- Niveau : chaque ligne de tuiles est [numéro de ligne, [[début, fin], ...]] -----
const LIGNES = [
  [8,  [[44, 58], [63, 72], [74, 78]]],
  [9,  [[-12, 2], [7, 21], [28, 37], [44, 58], [63, 72], [74, 78]]],
  [10, [[-12, 2], [7, 21], [28, 38], [44, 58], [63, 72], [74, 78]]],
  [11, [[-12, 2], [7, 21], [28, 38], [44, 58], [63, 72], [74, 78]]],
  [12, [[-12, 2], [7, 21], [28, 38], [45, 57], [63, 72], [74, 78]]],
  [13, [[-12, 2], [7, 21], [29, 37], [45, 50], [52, 52], [54, 56], [63, 72], [74, 78]]],
  [14, [[-11, 2], [8, 21], [29, 37], [45, 48], [54, 54]]],
  [15, [[-11, -8], [-4, 1], [8, 11], [15, 20], [29, 36]]],
  [16, [[31, 36]]],
  [18, [[37, 37]]],
  [20, [[-9, -9], [-1, -1], [15, 15]]],
  [42, [[171, 171]]]
];

const SOLS = [];
for (const [ligne, segments] of LIGNES) {
  for (const [debut, fin] of segments) {
    SOLS.push({
      x: debut * TAILLE_TUILE,
      y: ligne * TAILLE_TUILE,
      w: (fin - debut + 1) * TAILLE_TUILE,
      h: TAILLE_TUILE
    });
  }
}
SOLS.push({ x: -88 * TAILLE_TUILE, y: 363 * TAILLE_TUILE, w: 4 * TAILLE_TUILE, h: 10 * TAILLE_TUILE });
SOLS.push({ x: 1500, y: 250, w: 96, h: 16, reactive: true, yBas: 250, yHaut: 120 });

// ----- Le personnage -----
const joueur = {
  x: DEPART_X, y: DEPART_Y, w: 32, h: 95,
  vx: 0, vy: 0,
  auSol: false,
  sautsRestants: SAUTS_MAX,
  enDash: false,
  dashTimer: 0,
  reculTimer: 0,
  invulnerable: 0,
  pv: PV_MAX,
  direction: 1,
  attaqueTimer: 0
};

// ----- Animation -----
const anim = {
  echelleX: 1,
  echelleY: 1,
  marche: 0,
  decollage: 0,
  recuperation: 0,
  trainee: []
};
const particules = [];
let secousse = 0;

// ----- Silhouettes ombratiques -----
function creerEnnemis() {
  return [
    { x: 150,  y: 104, w: 32, h: 40, x0: 112,  x1: 352,  dir: 1, vx: 0, hp: 2, etourdi: 0, flash: 0, vivant: true },
    { x: 1050, y: 104, w: 32, h: 40, x0: 1008, x1: 1168, dir: 1, vx: 0, hp: 2, etourdi: 0, flash: 0, vivant: true },
    { x: 1200, y: 168, w: 32, h: 40, x0: 1184, x1: 1264, dir: 1, vx: 0, hp: 2, etourdi: 0, flash: 0, vivant: true }
  ];
}
let ennemis = creerEnnemis();

// ----- État -----
let energie = ENERGIE_MAX;
let resonanceActive = false;
const attaques = [];
const projectiles = [];
const ondes = [];
const camera = { x: 0, y: 0 };

// ----- Contrôles -----
const touches = {};
let demandeSaut = false;
let demandeDash = false;

document.addEventListener("keydown", (e) => {
  if (e.key.length === 1) e.preventDefault();

  touches[e.code] = true;

  if (!e.repeat && (e.code === "Space" || e.code === "ArrowUp")) demandeSaut = true;
  if (!e.repeat && (e.code === "ShiftLeft" || e.code === "ShiftRight")) demandeDash = true;
  if (e.code === "Space") e.preventDefault();

  if (e.repeat) return;
  if (e.key === "t" || e.key === "T") basculerResonance();
  if (e.key === "r" || e.key === "R") lancerEcho();
});
document.addEventListener("keyup", (e) => touches[e.code] = false);

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) attaquerLame();
  if (e.button === 2) lancerDague();
});

function basculerResonance() {
  if (resonanceActive) {
    resonanceActive = false;
  } else if (energie > 0) {
    resonanceActive = true;
  }
}

// ----- Particules -----
function creerParticules(x, y, couleur, n, vitesse) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const v = vitesse * (0.4 + Math.random() * 0.6);
    const vie = 0.4 + Math.random() * 0.4;
    particules.push({
      x: x, y: y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - vitesse * 0.5,
      vie: vie, vieMax: vie,
      couleur: couleur
    });
  }
}

function mettreAJourParticules(dt) {
  for (let i = particules.length - 1; i >= 0; i--) {
    const p = particules[i];
    p.vy += 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vie -= dt;
    if (p.vie <= 0) particules.splice(i, 1);
  }
}

function dessinerParticules() {
  for (const p of particules) {
    ctx.globalAlpha = Math.max(0, p.vie / p.vieMax);
    ctx.fillStyle = p.couleur;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

// ----- Collisions -----
function chevauche(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function toucheUnSol(x, y) {
  for (const s of SOLS) {
    if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true;
  }
  return false;
}

function estAuSol() {
  const bas = joueur.y + joueur.h;
  for (const s of SOLS) {
    if (joueur.x < s.x + s.w && joueur.x + joueur.w > s.x && Math.abs(bas - s.y) < 0.5) {
      return true;
    }
  }
  return false;
}

function deplacer(dt) {
  joueur.x += joueur.vx * dt;
  for (const s of SOLS) {
    if (chevauche(joueur, s)) {
      if (joueur.vx > 0) joueur.x = s.x - joueur.w;
      else if (joueur.vx < 0) joueur.x = s.x + s.w;
      joueur.vx = 0;
    }
  }

  joueur.y += joueur.vy * dt;
  for (const s of SOLS) {
    if (chevauche(joueur, s)) {
      if (joueur.vy > 0) joueur.y = s.y - joueur.h;
      else if (joueur.vy < 0) joueur.y = s.y + s.h;
      joueur.vy = 0;
    }
  }

  joueur.auSol = estAuSol();
}

function reinitialiser() {
  Object.assign(joueur, {
    x: DEPART_X, y: DEPART_Y, vx: 0, vy: 0,
    auSol: false, sautsRestants: SAUTS_MAX,
    enDash: false, dashTimer: 0, reculTimer: 0,
    invulnerable: 0, pv: PV_MAX, attaqueTimer: 0
  });
  attaques.length = 0;
  projectiles.length = 0;
  ondes.length = 0;
  particules.length = 0;
  anim.trainee.length = 0;
  anim.echelleX = 1;
  anim.echelleY = 1;
  anim.marche = 0;
  anim.decollage = 0;
  anim.recuperation = 0;
  secousse = 0;
  ennemis = creerEnnemis();
  for (const s of SOLS) {
    if (s.reactive) s.y = s.yBas;
  }
  resonanceActive = false;
  energie = ENERGIE_MAX;
}

// ----- Dégâts et attaques -----
function degatsActuels() {
  return resonanceActive ? 2 : 1;
}

function infliger(e, degats) {
  e.hp -= degats;
  e.etourdi = DUREE_ETOURDISSEMENT;
  e.flash = 0.12;
  const sens = (e.x + e.w / 2) < (joueur.x + joueur.w / 2) ? -1 : 1;
  e.x += sens * RECUL_ENNEMI;
  if (e.x < e.x0) e.x = e.x0;
  if (e.x + e.w > e.x1) e.x = e.x1 - e.w;

  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  if (e.hp <= 0) {
    e.vivant = false;
    creerParticules(cx, cy, "#07070c", 14, 220);
    creerParticules(cx, cy, "#9be7ff", 6, 160);
  } else {
    creerParticules(cx, cy, "#9be7ff", 6, 150);
  }
  secousse = Math.max(secousse, 0.25);
  energie = Math.min(ENERGIE_MAX, energie + GAIN_ENERGIE_COUP);
}

function attaquerLame() {
  const d = joueur.direction;
  const ox = d === 1 ? joueur.x + joueur.w + 2 : joueur.x - 2;
  const oy = joueur.y + 45;
  attaques.push({
    x: d === 1 ? joueur.x + joueur.w : joueur.x - 50,
    y: joueur.y + 25,
    w: 50, h: 40,
    ox: ox, oy: oy,
    d: d,
    rayon: 42,
    duree: 0.15, dureeMax: 0.15,
    touches: []
  });
  joueur.attaqueTimer = 0.2;
}

function lancerDague() {
  const d = joueur.direction;
  projectiles.push({
    x: joueur.x + joueur.w / 2,
    y: joueur.y + 40,
    vx: d * 700,
    angle: 0,
    w: 12, h: 4,
    duree: 1.2
  });
  joueur.attaqueTimer = 0.2;
}

function lancerEcho() {
  if (!resonanceActive || energie < COUT_ECHO) return;
  energie -= COUT_ECHO;
  const cx = joueur.x + joueur.w / 2;
  const cy = joueur.y + joueur.h / 2;
  ondes.push({ x: cx, y: cy, duree: 0.6, dureeMax: 0.6 });
  for (const e of ennemis) {
    if (!e.vivant) continue;
    const dx = cx - (e.x + e.w / 2);
    const dy = cy - (e.y + e.h / 2);
    if (Math.hypot(dx, dy) < RAYON_ECHO) {
      infliger(e, degatsActuels());
    }
  }
}

function daguesVisibles() {
  if (joueur.attaqueTimer > 0) return true;
  const cx = joueur.x + joueur.w / 2;
  const cy = joueur.y + joueur.h / 2;
  return ennemis.some(e =>
    e.vivant &&
    Math.abs(cx - (e.x + e.w / 2)) < PORTEE_DAGUES &&
    Math.abs(cy - (e.y + e.h / 2)) < 120
  );
}

// ----- Mise à jour des entités -----
function mettreAJourEnnemis(dt) {
  const cx = joueur.x + joueur.w / 2;
  const cy = joueur.y + joueur.h / 2;

  for (const e of ennemis) {
    if (!e.vivant) continue;
    if (e.etourdi > 0) e.etourdi -= dt;
    if (e.flash > 0) e.flash -= dt;

    const dx = cx - (e.x + e.w / 2);
    const dy = cy - (e.y + e.h / 2);

    if (e.etourdi > 0) {
      e.vx = 0;
    } else if (Math.abs(dx) < PORTEE_DETECTION && Math.abs(dy) < 120) {
      e.vx = Math.sign(dx) * VITESSE_CHARGE;
    } else {
      if (e.x <= e.x0) e.dir = 1;
      if (e.x + e.w >= e.x1) e.dir = -1;
      e.vx = e.dir * VITESSE_PATROUILLE;
    }

    e.x += e.vx * dt;
    if (e.x < e.x0) e.x = e.x0;
    if (e.x + e.w > e.x1) e.x = e.x1 - e.w;
  }

  if (joueur.invulnerable > 0) return;
  for (const e of ennemis) {
    if (e.vivant && chevauche(joueur, e)) {
      joueur.pv--;
      joueur.invulnerable = DUREE_INVULNERABLE;
      joueur.reculTimer = DUREE_RECUL;
      joueur.vx = ((joueur.x + joueur.w / 2) < (e.x + e.w / 2) ? -1 : 1) * RECUL_JOUEUR;
      joueur.vy = -200;
      secousse = 0.6;
      creerParticules(cx, cy, "#ff6b6b", 10, 200);
      if (joueur.pv <= 0) {
        reinitialiser();
      }
      return;
    }
  }
}

function mettreAJourPlateformesReactives(dt) {
  const cxJoueur = joueur.x + joueur.w / 2;

  for (const p of SOLS) {
    if (!p.reactive) continue;

    const cxPlat = p.x + p.w / 2;
    const proche = resonanceActive && Math.abs(cxJoueur - cxPlat) < 220;
    const cible = proche ? p.yHaut : p.yBas;

    const ancien = p.y;
    if (p.y > cible) p.y = Math.max(cible, p.y - VITESSE_PLATEFORME * dt);
    else if (p.y < cible) p.y = Math.min(cible, p.y + VITESSE_PLATEFORME * dt);
    const delta = p.y - ancien;

    if (delta !== 0 &&
        joueur.x + joueur.w > p.x && joueur.x < p.x + p.w &&
        Math.abs(joueur.y + joueur.h - ancien) < 1) {
      joueur.y += delta;
    }
  }
}

function mettreAJourAttaques(dt) {
  for (let i = attaques.length - 1; i >= 0; i--) {
    const a = attaques[i];
    a.duree -= dt;
    for (const e of ennemis) {
      if (e.vivant && !a.touches.includes(e) && chevauche(a, e)) {
        a.touches.push(e);
        infliger(e, degatsActuels());
      }
    }
    if (a.duree <= 0) attaques.splice(i, 1);
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.duree -= dt;
    p.x += p.vx * dt;
    p.angle += dt * 25;
    let supprimer = p.duree <= 0 || toucheUnSol(p.x, p.y);
    for (const e of ennemis) {
      if (!supprimer && e.vivant && chevauche(p, e)) {
        infliger(e, degatsActuels());
        supprimer = true;
      }
    }
    if (supprimer) projectiles.splice(i, 1);
  }

  for (let i = ondes.length - 1; i >= 0; i--) {
    ondes[i].duree -= dt;
    if (ondes[i].duree <= 0) ondes.splice(i, 1);
  }
}

// ----- Mise à jour générale -----
function mettreAJour(dt) {
  const etaitAuSol = joueur.auSol;
  const court = touches["ControlLeft"] || touches["ControlRight"];

  // Dash
  if (demandeDash && !joueur.enDash && joueur.reculTimer <= 0) {
    joueur.enDash = true;
    joueur.dashTimer = DUREE_DASH;
    joueur.vx = joueur.direction * VITESSE_DASH;
    joueur.vy = 0;
  }
  demandeDash = false;

  if (joueur.enDash) {
    joueur.dashTimer -= dt;
    anim.trainee.push({ x: joueur.x, y: joueur.y, vie: 0.25, vieMax: 0.25 });
    deplacer(dt);
    if (joueur.dashTimer <= 0) {
      joueur.enDash = false;
      joueur.vx = 0;
    }
  } else if (joueur.reculTimer > 0) {
    joueur.reculTimer -= dt;
    joueur.vy += GRAVITE * dt;
    deplacer(dt);
  } else {
    let dir = 0;
    if (touches["ArrowLeft"] || touches["KeyA"]) dir -= 1;
    if (touches["ArrowRight"] || touches["KeyD"]) dir += 1;
    joueur.vx = dir * (court ? VITESSE_COURSE : VITESSE);
    if (dir !== 0) joueur.direction = dir;

    if (!joueur.auSol) {
      joueur.vy += GRAVITE * dt;
    } else {
      joueur.sautsRestants = SAUTS_MAX;
    }

    if (demandeSaut && joueur.sautsRestants > 0) {
      joueur.vy = FORCE_SAUT;
      joueur.sautsRestants--;
      joueur.auSol = false;
      anim.decollage = DUREE_DECOLLAGE;
    }

    deplacer(dt);
  }
  demandeSaut = false;

  // Atterrissage : légère compression, poussière et pose de réception
  if (!etaitAuSol && joueur.auSol) {
    anim.echelleX = 1.1;
    anim.echelleY = 0.9;
    anim.recuperation = DUREE_RECUPERATION;
    creerParticules(joueur.x + joueur.w / 2, joueur.y + joueur.h, "#5a5266", 6, 90);
  }

  // Retour progressif des échelles vers la normale
  const k = Math.min(1, 10 * dt);
  anim.echelleX += (1 - anim.echelleX) * k;
  anim.echelleY += (1 - anim.echelleY) * k;

  // Durées des poses de décollage et de réception
  if (anim.decollage > 0) anim.decollage -= dt;
  if (anim.recuperation > 0) anim.recuperation -= dt;

  // Avance du cycle de marche (seulement au sol et en mouvement)
  if (joueur.auSol && Math.abs(joueur.vx) > 0 && !joueur.enDash) {
    anim.marche += dt * (court ? MARCHE_VITESSE_COURSE : MARCHE_VITESSE);
  } else {
    anim.marche = 0;
  }

  // Traînée du dash
  for (let i = anim.trainee.length - 1; i >= 0; i--) {
    anim.trainee[i].vie -= dt;
    if (anim.trainee[i].vie <= 0) anim.trainee.splice(i, 1);
  }

  if (joueur.invulnerable > 0) joueur.invulnerable -= dt;
  secousse = Math.max(0, secousse - dt * 2);

  // Énergie de résonance
  if (resonanceActive) {
    energie -= DRAIN_RESONANCE * dt;
    if (energie <= 0) {
      energie = 0;
      resonanceActive = false;
    }
  } else {
    energie = Math.min(ENERGIE_MAX, energie + RECHARGE_ENERGIE * dt);
  }

  if (joueur.attaqueTimer > 0) joueur.attaqueTimer -= dt;

  mettreAJourEnnemis(dt);
  mettreAJourPlateformesReactives(dt);
  mettreAJourAttaques(dt);
  mettreAJourParticules(dt);

  if (joueur.y + joueur.h > ZONE_MORT_Y) reinitialiser();

  camera.x = joueur.x + joueur.w / 2 - canvas.width / 2;
  camera.y = joueur.y + joueur.h / 2 - canvas.height / 2;
}

// ----- Choix de la pose de saut selon la phase du saut -----
function poseSaut() {
  if (anim.recuperation > 0) return 7;   // atterrissage
  if (anim.decollage > 0) return 1;      // décollage
  if (joueur.vy < -200) return 2;        // montée rapide
  if (joueur.vy < -60) return 3;         // montée
  if (joueur.vy <= 60) return 4;         // sommet
  if (joueur.vy <= 250) return 5;        // descente
  return 6;                              // chute
}

// ----- Dessin -----
function dessinerPose(image, frame, cellW, cellH, pieds, echelle) {
  const largeur = cellW * echelle;
  const hauteur = cellH * echelle;
  ctx.drawImage(
    image,
    frame * cellW, 0, cellW, cellH,
    -largeur / 2, -pieds * echelle, largeur, hauteur
  );
}

function dessinerJoueur() {
  const cx = joueur.x + joueur.w / 2;
  const pieds = joueur.y + joueur.h;
  const enMarche = joueur.auSol && Math.abs(joueur.vx) > 0 && !joueur.enDash;

  ctx.save();
  ctx.globalAlpha = (joueur.invulnerable > 0 && Math.floor(joueur.invulnerable * 10) % 2 === 0) ? 0.3 : 1;
  ctx.translate(cx, pieds);
  ctx.scale(anim.echelleX, anim.echelleY);
  ctx.scale(joueur.direction, 1);

  if (!joueur.auSol && imageSaut.complete && imageSaut.naturalWidth > 0) {
    // En l'air : poses de saut selon la phase
    dessinerPose(imageSaut, poseSaut(), SAUT_CELLE_W, SAUT_CELLE_H, SAUT_PIEDS, SAUT_ECHELLE);
  } else if (joueur.auSol && anim.recuperation > 0 && imageSaut.complete && imageSaut.naturalWidth > 0) {
    // Atterrissage : pose de réception
    dessinerPose(imageSaut, 7, SAUT_CELLE_W, SAUT_CELLE_H, SAUT_PIEDS, SAUT_ECHELLE);
  } else if (enMarche && imageMarche.complete && imageMarche.naturalWidth > 0) {
    // Marche ou course : une des 8 poses, en boucle
    const frame = Math.floor(anim.marche) % MARCHE_FRAMES;
    dessinerPose(imageMarche, frame, MARCHE_CELLE_W, MARCHE_CELLE_H, MARCHE_CELLE_H, MARCHE_ECHELLE);
  } else if (imageIdle.complete && imageIdle.naturalWidth > 0) {
    // Repos : une des 6 poses idle, en boucle
    const frame = Math.floor(performance.now() / 1000 * IDLE_VITESSE) % IDLE_FRAMES;
    dessinerPose(imageIdle, frame, IDLE_CELLE_W, IDLE_CELLE_H, IDLE_CELLE_H, IDLE_ECHELLE);
  } else {
    // Secours tant que les images ne sont pas chargées
    ctx.fillStyle = "#2a2f3d";
    ctx.fillRect(-joueur.w / 2, -joueur.h, joueur.w, joueur.h);
  }

  ctx.restore();
}

function dessinerDagues() {
  const d = joueur.direction;
  const xBase = d === 1 ? joueur.x + joueur.w + 2 : joueur.x - 2;
  const oscillation = Math.sin(performance.now() / 180) * 0.15;
  ctx.strokeStyle = "#dfe6ef";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const [decalage, angle] of [[42, 0.25 + oscillation], [54, -0.25 - oscillation]]) {
    ctx.save();
    ctx.translate(xBase, joueur.y + decalage);
    ctx.rotate(angle * d);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(d * 18, 0);
    ctx.stroke();
    ctx.restore();
  }
}

function dessinerAttaques() {
  for (const a of attaques) {
    const avancement = 1 - a.duree / a.dureeMax;
    const base = a.d === 1 ? 0 : Math.PI;
    const debut = base - 1.1;
    const fin = debut + 2.2 * avancement;
    ctx.save();
    ctx.translate(a.ox, a.oy);
    ctx.strokeStyle = "rgba(255, 255, 255, " + (1 - avancement * 0.6) + ")";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, a.rayon, debut, fin);
    ctx.stroke();
    ctx.restore();
  }
}

function dessinerEnnemis() {
  for (const e of ennemis) {
    if (!e.vivant) continue;
    let couleur = "#07070c";
    if (e.flash > 0) couleur = "#c9d6ff";
    else if (e.etourdi > 0) couleur = "#2a2a3a";
    ctx.fillStyle = couleur;

    const tranches = 4;
    const hauteurTranche = e.h / tranches;
    for (let i = 0; i < tranches; i++) {
      const decalage = e.etourdi > 0 ? 0 : (Math.random() - 0.5) * 4;
      ctx.fillRect(e.x + decalage, e.y + i * hauteurTranche, e.w, hauteurTranche - 1);
    }
  }
}

function dessinerProjectiles() {
  for (const p of projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    if (resonanceActive) {
      ctx.shadowColor = "#9be7ff";
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = resonanceActive ? "#9be7ff" : "#dfe6ef";
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }
}

function dessiner() {
  ctx.fillStyle = "#0d1020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const decalX = (Math.random() - 0.5) * secousse * 12;
  const decalY = (Math.random() - 0.5) * secousse * 12;

  ctx.save();
  ctx.translate(-Math.round(camera.x) + decalX, -Math.round(camera.y) + decalY);

  for (const s of SOLS) {
    if (s.reactive) {
      ctx.fillStyle = "#1f5f6e";
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = "#9be7ff";
      ctx.fillRect(s.x, s.y, s.w, 2);
    } else {
      ctx.fillStyle = "#3a3142";
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
  }

  for (const o of ondes) {
    const avancement = 1 - o.duree / o.dureeMax;
    ctx.strokeStyle = "rgba(155, 231, 255, " + (1 - avancement) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(o.x, o.y, avancement * RAYON_ECHO, 0, Math.PI * 2);
    ctx.stroke();
  }

  dessinerEnnemis();
  dessinerAttaques();
  dessinerProjectiles();

  for (const t of anim.trainee) {
    ctx.globalAlpha = 0.35 * (t.vie / t.vieMax);
    ctx.fillStyle = "#2a2f3d";
    ctx.fillRect(t.x, t.y, joueur.w, joueur.h);
  }
  ctx.globalAlpha = 1;

  dessinerJoueur();

  // Les dagues ne s'affichent qu'au sol, pour ne pas se décoller du corps en l'air
  if (joueur.auSol && daguesVisibles()) dessinerDagues();

  dessinerParticules();

  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Arial";
  ctx.fillText("PV : " + joueur.pv + " / " + PV_MAX, 10, 25);
  ctx.fillText("Résonance : " + (resonanceActive ? "ON" : "OFF") + "   (T)", 10, 47);
  ctx.fillText("Écho : R   (coût " + COUT_ECHO + ")", 10, 69);

  ctx.fillStyle = "#222838";
  ctx.fillRect(10, 80, 200, 10);
  ctx.fillStyle = "#9be7ff";
  ctx.fillRect(10, 80, 200 * energie / ENERGIE_MAX, 10);

  ctx.fillStyle = "#ffffff";
  ctx.fillText("Clic gauche : coup de dague   Clic droit : lancer", 10, canvas.height - 12);
}

// ----- Boucle de jeu -----
let dernier = performance.now();
function boucle(t) {
  const dt = Math.min((t - dernier) / 1000, 1 / 30);
  dernier = t;
  mettreAJour(dt);
  dessiner();
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);