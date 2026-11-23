const canvas = document.getElementById("jeu");
const ctx = canvas.getContext("2d");

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

// ----- Combat et résonance -----
const PORTEE_DETECTION = 220;
const PORTEE_DAGUES = 170;
const VITESSE_CHARGE = 130;
const VITESSE_PATROUILLE = 50;
const RAYON_ECHO = 320;
const ENERGIE_MAX = 100;
const COUT_ECHO = 40;
const DRAIN_RESONANCE = 10;     // par seconde
const RECHARGE_ENERGIE = 8;     // par seconde
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
// Mur vertical très bas à gauche
SOLS.push({ x: -88 * TAILLE_TUILE, y: 363 * TAILLE_TUILE, w: 4 * TAILLE_TUILE, h: 10 * TAILLE_TUILE });
// Plateforme réactive : monte quand la résonance est active et que le joueur est proche
SOLS.push({ x: 1500, y: 250, w: 96, h: 16, reactive: true, yBas: 250, yHaut: 120 });

// ----- Le personnage -----
const joueur = {
  x: DEPART_X, y: DEPART_Y, w: 32, h: 95,
  vx: 0, vy: 0,
  auSol: false,
  sautsRestants: SAUTS_MAX,
  enDash: false,
  dashTimer: 0,
  direction: 1,
  attaqueTimer: 0
};

// ----- Silhouettes ombratiques -----
function creerEnnemis() {
  return [
    { x: 150,  y: 104, w: 32, h: 40, x0: 112,  x1: 352,  dir: 1, vx: 0, hp: 2, etourdi: 0, vivant: true },
    { x: 1050, y: 104, w: 32, h: 40, x0: 1008, x1: 1168, dir: 1, vx: 0, hp: 2, etourdi: 0, vivant: true },
    { x: 1200, y: 168, w: 32, h: 40, x0: 1184, x1: 1264, dir: 1, vx: 0, hp: 2, etourdi: 0, vivant: true }
  ];
}
let ennemis = creerEnnemis();

// ----- État des attaques et de la résonance -----
let energie = ENERGIE_MAX;
let resonanceActive = false;
const attaques = [];    // coups de dague au corps à corps
const projectiles = []; // dagues lancées
const ondes = [];       // ondes d'écho
const camera = { x: 0, y: 0 };

// ----- Contrôles -----
const touches = {};
let demandeSaut = false;
let demandeDash = false;

document.addEventListener("keydown", (e) => {
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
    enDash: false, dashTimer: 0, attaqueTimer: 0
  });
  attaques.length = 0;
  projectiles.length = 0;
  ondes.length = 0;
  ennemis = creerEnnemis();
  for (const s of SOLS) {
    if (s.reactive) s.y = s.yBas;
  }
  resonanceActive = false;
  energie = ENERGIE_MAX;
}

// ----- Dagues et résonance -----
function degatsActuels() {
  return resonanceActive ? 2 : 1;
}

function infliger(e, degats) {
  e.hp -= degats;
  e.etourdi = Math.max(e.etourdi, 0.3);
  if (e.hp <= 0) e.vivant = false;
  energie = Math.min(ENERGIE_MAX, energie + GAIN_ENERGIE_COUP);
}

function attaquerLame() {
  const d = joueur.direction;
  const x = d === 1 ? joueur.x + joueur.w : joueur.x - 40;
  attaques.push({ x: x, y: joueur.y + 30, w: 40, h: 30, duree: 0.12, touches: [] });
  joueur.attaqueTimer = 0.2;
}

function lancerDague() {
  const d = joueur.direction;
  projectiles.push({
    x: joueur.x + joueur.w / 2,
    y: joueur.y + 40,
    vx: d * 700,
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
      e.etourdi = 1.5;
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

  // Contact avec une silhouette : le niveau recommence
  for (const e of ennemis) {
    if (e.vivant && chevauche(joueur, e)) {
      reinitialiser();
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

    // Le joueur debout sur la plateforme est emporté avec elle
    if (delta !== 0 &&
        joueur.x + joueur.w > p.x && joueur.x < p.x + p.w &&
        Math.abs(joueur.y + joueur.h - ancien) < 1) {
      joueur.y += delta;
    }
  }
}

function mettreAJourAttaques(dt) {
  // Coups de dague
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

  // Dagues lancées
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.duree -= dt;
    p.x += p.vx * dt;
    let supprimer = p.duree <= 0 || toucheUnSol(p.x, p.y);
    for (const e of ennemis) {
      if (!supprimer && e.vivant && chevauche(p, e)) {
        infliger(e, degatsActuels());
        supprimer = true;
      }
    }
    if (supprimer) projectiles.splice(i, 1);
  }

  // Ondes d'écho
  for (let i = ondes.length - 1; i >= 0; i--) {
    ondes[i].duree -= dt;
    if (ondes[i].duree <= 0) ondes.splice(i, 1);
  }
}

function mettreAJour(dt) {
  // Dash
  if (demandeDash && !joueur.enDash) {
    joueur.enDash = true;
    joueur.dashTimer = DUREE_DASH;
    joueur.vx = joueur.direction * VITESSE_DASH;
    joueur.vy = 0;
  }
  demandeDash = false;

  if (joueur.enDash) {
    joueur.dashTimer -= dt;
    deplacer(dt);
    if (joueur.dashTimer <= 0) {
      joueur.enDash = false;
      joueur.vx = 0;
    }
  } else {
    let dir = 0;
    if (touches["ArrowLeft"] || touches["KeyA"]) dir -= 1;
    if (touches["ArrowRight"] || touches["KeyD"]) dir += 1;
    joueur.vx = dir * VITESSE;
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
    }

    deplacer(dt);
  }
  demandeSaut = false;

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

  // Zone de mort : on recommence au départ
  if (joueur.y + joueur.h > ZONE_MORT_Y) reinitialiser();

  // Caméra
  camera.x = joueur.x + joueur.w / 2 - canvas.width / 2;
  camera.y = joueur.y + joueur.h / 2 - canvas.height / 2;
}

// ----- Dessin -----
function dessinerDagues() {
  const d = joueur.direction;
  const xBase = d === 1 ? joueur.x + joueur.w + 2 : joueur.x - 2;
  ctx.strokeStyle = "#dfe6ef";
  ctx.lineWidth = 3;
  for (const decalage of [42, 54]) {
    const y = joueur.y + decalage;
    ctx.beginPath();
    ctx.moveTo(xBase, y);
    ctx.lineTo(xBase + d * 16, y - 2);
    ctx.stroke();
  }
}

function dessiner() {
  ctx.fillStyle = "#0d1020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  // Tuiles et plateformes
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

  // Ondes d'écho
  for (const o of ondes) {
    const avancement = 1 - o.duree / o.dureeMax;
    ctx.strokeStyle = "rgba(155, 231, 255, " + (1 - avancement) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(o.x, o.y, avancement * RAYON_ECHO, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Silhouettes ombratiques (légère vibration, effet glitch)
  for (const e of ennemis) {
    if (!e.vivant) continue;
    const tremble = (Math.random() - 0.5) * 3;
    ctx.fillStyle = "#07070c";
    ctx.fillRect(e.x + tremble, e.y, e.w, e.h);
  }

  // Coups de dague
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  for (const a of attaques) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + a.h / 2);
    ctx.lineTo(a.x + a.w, a.y + a.h / 2);
    ctx.stroke();
  }

  // Dagues lancées
  for (const p of projectiles) {
    const s = Math.sign(p.vx);
    ctx.beginPath();
    ctx.moveTo(p.x - 8 * s, p.y);
    ctx.lineTo(p.x + 8 * s, p.y);
    ctx.stroke();
  }

  // Personnage
  ctx.fillStyle = "#4da6ff";
  ctx.fillRect(joueur.x, joueur.y, joueur.w, joueur.h);

  // Dagues dans les mains (apparaissent près d'une silhouette)
  if (daguesVisibles()) dessinerDagues();

  ctx.restore();

  // Affichage fixe à l'écran
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Arial";
  ctx.fillText("Résonance : " + (resonanceActive ? "ON" : "OFF") + "   (T)", 10, 25);
  ctx.fillText("Écho : R   (coût " + COUT_ECHO + ")", 10, 47);

  // Barre d'énergie
  ctx.fillStyle = "#222838";
  ctx.fillRect(10, 60, 200, 10);
  ctx.fillStyle = "#9be7ff";
  ctx.fillRect(10, 60, 200 * energie / ENERGIE_MAX, 10);

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